"""Get the imagery onto the workspace volume, whichever way it arrived.

Everything downstream reads local files, so this is the only step that knows or
cares where an upload came from. Three ways in:

  s3        the browser already put the bytes in our bucket
  url       fetch them from the caller's source URL
  archived  a retry after the source URL was consumed, so use our own copy

The url mode is the one with an adversary in it. It follows redirects, because
the places people keep imagery (Dropbox, Drive, signed-URL endpoints) all
redirect, and every hop goes through the same `url_guard` checks the API applied
to the URL the caller submitted. Bytes that are not a TIFF are dropped before
they reach our bucket or GDAL.

Exit codes: 0 success, 75 (EX_TEMPFAIL) a transient failure worth retrying, 1 a
permanent one. The WorkflowTemplate retries only 75, so a 404 or a rejected host
fails once, immediately, with a message the uploader can read.
"""

import hashlib
import logging
import os
import shutil
import sys
from urllib.parse import urljoin

import boto3
import botocore.exceptions
import httpx
import url_guard
from botocore.config import Config

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s [fetch] %(message)s",
)
log = logging.getLogger("fetch")

EXIT_PERMANENT = 1
EXIT_TRANSIENT = 75

# Classic and BigTIFF, little and big endian.
TIFF_MAGIC = (b"II*\x00", b"MM\x00*", b"II+\x00", b"MM\x00+")

SNIFF_BYTES = 64
CHUNK_BYTES = 1024 * 1024

# No data for this long ends the transfer: a stalled connection is not
# distinguishable from a very slow one, and neither deserves a 300Gi volume.
READ_TIMEOUT_SECONDS = 60.0
CONNECT_TIMEOUT_SECONDS = 30.0
API_TIMEOUT_SECONDS = 60.0


class FetchError(Exception):
    """A fetch that failed. `transient` decides whether a retry could help."""

    def __init__(self, message: str, *, transient: bool = False):
        super().__init__(message)
        self.message = message
        self.transient = transient


def redacted(url: str) -> str:
    """Render a URL without its query, which is where signatures live."""
    return url.split("?", maxsplit=1)[0]


def looks_like_tiff(head: bytes) -> bool:
    """Return whether these first bytes open a TIFF."""
    return head.startswith(TIFF_MAGIC)


def clear_workspace(data_dir: str) -> None:
    """Empty the workspace without failing on what we may not delete.

    A retried step starts from a used volume, and an ext4 PVC has a root-owned
    lost+found that this step, running unprivileged, cannot remove.
    """
    for name in os.listdir(data_dir):
        path = os.path.join(data_dir, name)
        try:
            if os.path.isdir(path) and not os.path.islink(path):
                shutil.rmtree(path)
            else:
                os.unlink(path)
        except OSError as err:
            log.info("fetch: leaving %s in place (%s)", path, err)


def _stream_to_file(response: httpx.Response, dest: str, max_bytes: int) -> int:
    """Write a response body to disk, checking the first bytes and the size."""
    written = 0
    head = b""
    with open(dest, "wb") as out:
        for chunk in response.iter_bytes(CHUNK_BYTES):
            if len(head) < SNIFF_BYTES:
                head = (head + chunk)[:SNIFF_BYTES]
                if len(head) >= 4 and not looks_like_tiff(head):
                    raise FetchError(
                        "The source URL did not return a GeoTIFF. Link straight "
                        "to the file rather than to a preview or download page."
                    )
            written += len(chunk)
            if written > max_bytes:
                raise FetchError(
                    f"The source file is larger than the {max_bytes}-byte limit."
                )
            out.write(chunk)
    if written == 0:
        raise FetchError("The source URL returned no data.")
    if not looks_like_tiff(head):
        raise FetchError("The source URL did not return a GeoTIFF.")
    return written


def download(
    url: str,
    dest: str,
    *,
    client: httpx.Client,
    max_bytes: int,
    allow_private: bool = False,
    max_redirects: int = url_guard.MAX_REDIRECTS,
) -> int:
    """Fetch a source URL to `dest`, rechecking every redirect it follows.

    Returns the number of bytes written.
    """
    for _ in range(max_redirects + 1):
        try:
            url = url_guard.check_url(url, allow_private=allow_private)
        except url_guard.UrlRejected as err:
            raise FetchError(str(err)) from err
        try:
            response = client.send(client.build_request("GET", url), stream=True)
        except httpx.TransportError as err:
            raise FetchError(
                f"Could not connect to the source URL ({err}).", transient=True
            ) from err
        try:
            if response.status_code in url_guard.REDIRECT_STATUSES:
                location = response.headers.get("location", "").strip()
                if not location:
                    raise FetchError("The source URL redirected to nowhere.")
                url = urljoin(url, location)
                log.info("fetch: redirected to %s", redacted(url))
                continue
            if response.status_code >= 400:
                raise FetchError(
                    f"The source URL returned HTTP {response.status_code}.",
                    # 429 and 5xx are the server's problem, not the URL's.
                    transient=response.status_code == 429
                    or response.status_code >= 500,
                )
            declared = response.headers.get("content-length", "")
            if declared.isdigit() and int(declared) > max_bytes:
                raise FetchError(
                    f"The source file is larger than the {max_bytes}-byte limit."
                )
            log.info("fetch: downloading from %s", redacted(url))
            try:
                return _stream_to_file(response, dest, max_bytes)
            except httpx.TransportError as err:
                raise FetchError(
                    f"The transfer failed part way through ({err}).", transient=True
                ) from err
        finally:
            response.close()

    raise FetchError("The source URL redirected too many times.")


class _Progress:
    """Log an S3 transfer every 10%, the way the shell step used to."""

    def __init__(self, total: int, label: str):
        self._total = max(total, 1)
        self._label = label
        self._seen = 0
        self._next = 10

    def __call__(self, chunk_bytes: int) -> None:
        self._seen += chunk_bytes
        percent = self._seen * 100 // self._total
        while self._next <= 100 and percent >= self._next:
            log.info("%s: %s%%", self._label, self._next)
            self._next += 10


class Api:
    """The uploader API, reached with this upload's callback token."""

    def __init__(self, client: httpx.Client, base_url: str, upload_id: str, token: str):
        self._client = client
        self._base = f"{base_url.rstrip('/')}/api/v1"
        self._id = upload_id
        self._headers = {"X-Internal-Token": token}

    def _get(self, path: str) -> httpx.Response:
        try:
            response = self._client.get(
                f"{self._base}/uploads/{self._id}{path}", headers=self._headers
            )
            response.raise_for_status()
        except httpx.HTTPError as err:
            raise FetchError(
                f"Could not reach the API for {path}: {err}", transient=True
            ) from err
        return response

    def metadata(self) -> bytes:
        """Read the caller's metadata, as the bytes to write to meta.json."""
        return self._get("/pipeline/meta").content

    def source(self) -> str:
        """Read back the checked source URL.

        An empty body means the API has already dropped it, so the archived copy
        is all that is left.
        """
        return self._get("/pipeline/source").text.strip()

    def report_checksum(self, digest: str) -> None:
        """Report the original bytes' checksum; a failure here is not fatal."""
        try:
            self._client.post(
                f"{self._base}/uploads/{self._id}/checksum",
                # "1220" is the sha2-256 multihash prefix, matching file:checksum.
                json={"checksum": f"1220{digest}"},
                headers=self._headers,
            ).raise_for_status()
        except httpx.HTTPError as err:
            log.warning("fetch: could not report the checksum (continuing): %s", err)

    def report_failure(self, message: str) -> None:
        """Tell the uploader why their fetch failed; not fatal either.

        The API keeps the first terminal result, so this precise message
        survives the workflow's generic one.
        """
        try:
            self._client.post(
                f"{self._base}/workflowstatus",
                json={"id": self._id, "status": "Failed", "message": message},
                headers=self._headers,
            ).raise_for_status()
        except httpx.HTTPError as err:
            log.warning("fetch: could not report the failure: %s", err)


def _s3(endpoint: str, region: str):
    """Build an S3 client configured the way the API's is."""
    return boto3.client(
        "s3",
        # An empty endpoint selects standard AWS S3.
        endpoint_url=endpoint or None,
        region_name=region,
        config=Config(
            # Local S3 services require SigV4 and path-style addresses.
            signature_version="s3v4",
            s3={"addressing_style": "path"},
            request_checksum_calculation="when_required",
            response_checksum_validation="when_required",
        ),
    )


def _object_size(s3, bucket: str, key: str) -> int | None:
    """Return the archived object's size, or None if we cannot see it."""
    try:
        return s3.head_object(Bucket=bucket, Key=key)["ContentLength"]
    except botocore.exceptions.ClientError as err:
        log.info("fetch: no object at s3://%s/%s (%s)", bucket, key, err)
        return None


def _sha256(path: str) -> str:
    """Checksum a local file without reading it all into memory."""
    digest = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(CHUNK_BYTES), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _env_flag(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in ("1", "true", "yes", "on")


def _fetch_from_url(
    s3, url: str, *, dest: str, bucket: str, key: str, max_bytes: int
) -> None:
    """Download the caller's source URL and archive the bytes we accepted."""
    with httpx.Client(
        timeout=httpx.Timeout(READ_TIMEOUT_SECONDS, connect=CONNECT_TIMEOUT_SECONDS),
        trust_env=False,
        follow_redirects=False,
    ) as fetcher:
        size = download(
            url,
            dest,
            client=fetcher,
            max_bytes=max_bytes,
            allow_private=_env_flag("ALLOW_PRIVATE_HOSTS"),
        )
    log.info("fetch: retrieved %s bytes", size)
    # Archive under this upload's key, and only now that the bytes have been
    # checked: this bucket is world-readable.
    log.info("fetch: archiving the original")
    s3.upload_file(dest, bucket, key, ExtraArgs={"ContentType": "image/tiff"})


def _fetch_from_bucket(
    s3, *, dest: str, bucket: str, key: str, max_bytes: int, label: str
) -> None:
    """Copy an object we already hold onto the workspace volume."""
    total = _object_size(s3, bucket, key)
    if total is None:
        raise FetchError("The uploaded object is no longer in storage.")
    if total > max_bytes:
        raise FetchError(f"The upload is larger than the {max_bytes}-byte limit.")
    log.info("%s: starting (%s bytes)", label, total)
    s3.download_file(bucket, key, dest, Callback=_Progress(total, label))
    log.info("%s: complete", label)
    with open(dest, "rb") as f:
        if not looks_like_tiff(f.read(SNIFF_BYTES)):
            # Not fatal here: validate rejects it with an exit code the workflow
            # maps to a message, and its cleanup removes these bytes.
            log.warning("%s: this object does not start like a TIFF", label)


def run() -> None:
    """Put the imagery at /data/input.tif and the metadata at /data/meta.json."""
    data_dir = os.environ.get("DATA_DIR", "/data")
    mode = os.environ.get("SOURCE_TYPE", "s3")
    bucket = os.environ["S3_BUCKET"]
    key = os.environ["S3_KEY"]
    max_bytes = int(os.environ.get("MAX_FETCH_BYTES", str(100 * 1024**3)))
    dest = os.path.join(data_dir, "input.tif")

    os.makedirs(data_dir, exist_ok=True)
    clear_workspace(data_dir)

    s3 = _s3(
        os.environ.get("S3_ENDPOINT", ""),
        # boto3 insists on a region even against a non-AWS endpoint, and an
        # empty one is not the same as an absent one.
        os.environ.get("AWS_REGION")
        or os.environ.get("AWS_DEFAULT_REGION")
        or "us-east-1",
    )

    # No proxy from the environment: it would carry the request for us, and then
    # the host we checked is not the host that gets connected to.
    with httpx.Client(
        timeout=API_TIMEOUT_SECONDS, trust_env=False, follow_redirects=False
    ) as api_client:
        api = Api(
            api_client,
            os.environ["FRONT_URL"],
            os.environ["UPLOAD_ID"],
            os.environ.get("INTERNAL_TOKEN", ""),
        )
        try:
            with open(os.path.join(data_dir, "meta.json"), "wb") as f:
                f.write(api.metadata())

            url = api.source() if mode == "url" else ""
            if mode == "url" and not url:
                # The API drops the URL once the original is archived, so a retry
                # after that point uses the copy we already have.
                if _object_size(s3, bucket, key) is None:
                    raise FetchError("This upload has no source URL to fetch.")
                log.info("fetch: source URL already consumed; using the archive")
                mode = "archived"

            if mode == "url":
                _fetch_from_url(
                    s3, url, dest=dest, bucket=bucket, key=key, max_bytes=max_bytes
                )
            else:
                _fetch_from_bucket(
                    s3,
                    dest=dest,
                    bucket=bucket,
                    key=key,
                    max_bytes=max_bytes,
                    label="download" if mode == "s3" else "restore",
                )

            # Advisory duplicate check on the bytes we received; the API decides
            # what to do with a match.
            api.report_checksum(_sha256(dest))
        except FetchError as err:
            if not err.transient:
                api.report_failure(err.message)
            raise


if __name__ == "__main__":
    try:
        run()
        log.info("fetch: ready at /data/input.tif")
    except FetchError as exc:
        log.error("fetch: %s", exc.message)
        sys.exit(EXIT_TRANSIENT if exc.transient else EXIT_PERMANENT)
    except botocore.exceptions.BotoCoreError:
        log.exception("fetch: storage error")
        sys.exit(EXIT_TRANSIENT)
    except Exception:
        log.exception("fetch: failed")
        sys.exit(EXIT_TRANSIENT)
