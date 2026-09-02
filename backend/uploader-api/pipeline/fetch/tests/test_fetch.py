"""What the fetch step will and will not download.

The server is plain HTTP on loopback, so these run with `allow_private`, the
same switch local compose uses. Which URLs the rules accept is `url_guard`'s
own test; what is here is the streaming, the limits, and the fact that every
redirect goes back through those rules instead of being followed blindly.
"""

import http.server
import io
import threading
import zipfile
from pathlib import Path

import botocore.exceptions
import fetch
import httpx
import pytest
import url_guard
from fetch import (
    FetchError,
    _fetch_from_bucket,
    _fetch_from_url,
    clear_workspace,
    download,
    extract_odm_orthophoto,
    is_odm_archive_url,
    looks_like_tiff,
    redacted,
)

TIFF = b"II*\x00" + bytes(2048)
BIG_TIFF_CHUNK = b"II+\x00" + bytes(1024 * 1024)
HTML = b"<!DOCTYPE html><html><body>Sign in to download this file</body></html>"


def _archive(member="odm_orthophoto/odm_orthophoto.tif", content=TIFF):
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as zipped:
        zipped.writestr(member, content)
    return output.getvalue()


ODM_ARCHIVE = _archive()


class _Handler(http.server.BaseHTTPRequestHandler):
    # Connection-close framing, so a body with no Content-Length still ends.
    protocol_version = "HTTP/1.0"

    def log_message(self, *args):
        pass

    def _send(self, status, body=b"", headers=(), length=None):
        self.send_response(status)
        for name, value in headers:
            self.send_header(name, value)
        self.send_header("Content-Length", str(length if length else len(body)))
        self.end_headers()
        if body:
            self.wfile.write(body)

    def do_GET(self):  # noqa: N802 - BaseHTTPRequestHandler's interface
        routes = {
            "/tif": lambda: self._send(200, TIFF),
            "/html": lambda: self._send(200, HTML),
            "/all.zip": lambda: self._send(200, ODM_ARCHIVE),
            "/task/abc/download/all.zip": lambda: self._send(200, ODM_ARCHIVE),
            "/empty": lambda: self._send(200, b""),
            "/redirect": lambda: self._send(302, headers=[("Location", "/tif")]),
            "/relative": lambda: self._send(302, headers=[("Location", "tif")]),
            "/loop": lambda: self._send(302, headers=[("Location", "/loop")]),
            "/nowhere": lambda: self._send(302),
            "/to-file": lambda: self._send(
                302, headers=[("Location", "file:///etc/passwd")]
            ),
            "/to-credentials": lambda: self._send(
                302, headers=[("Location", "http://user:pass@example.org/a.tif")]
            ),
            "/lies-about-size": lambda: self._send(200, TIFF, length=100 * 1024**3),
            "/huge": self._send_huge,
            "/missing": lambda: self._send(404),
            "/broken": lambda: self._send(503),
        }
        routes.get(self.path, lambda: self._send(404))()

    def _send_huge(self):
        self.send_response(200)
        self.end_headers()
        for _ in range(8):
            self.wfile.write(BIG_TIFF_CHUNK)


class _Server(http.server.HTTPServer):
    def handle_error(self, *args):
        # A test that stops reading mid-body is the point, not a failure.
        pass


@pytest.fixture(scope="module")
def server():
    """A local HTTP server, returning its base URL."""
    httpd = _Server(("127.0.0.1", 0), _Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{httpd.server_address[1]}"
    httpd.shutdown()


@pytest.fixture
def client():
    with httpx.Client(timeout=10, trust_env=False, follow_redirects=False) as c:
        yield c


def _download(server, client, tmp_path, path, **kwargs):
    return download(
        f"{server}{path}",
        str(tmp_path / "out.tif"),
        client=client,
        max_bytes=kwargs.pop("max_bytes", 10 * 1024**2),
        allow_private=True,
        **kwargs,
    )


@pytest.mark.parametrize("path", ["/tif", "/redirect", "/relative"])
def test_downloads_a_geotiff(server, client, tmp_path, path):
    assert _download(server, client, tmp_path, path) == len(TIFF)
    assert (tmp_path / "out.tif").read_bytes() == TIFF


def test_downloads_an_expected_odm_archive(server, client, tmp_path):
    assert _download(server, client, tmp_path, "/all.zip", expected="zip") == len(
        ODM_ARCHIVE
    )
    assert (tmp_path / "out.tif").read_bytes() == ODM_ARCHIVE


@pytest.mark.parametrize("path", ["/to-file", "/to-credentials"])
def test_a_redirect_target_goes_back_through_the_rules(server, client, tmp_path, path):
    """httpx would follow these; the point of the loop is that we do not."""
    with pytest.raises(FetchError):
        _download(server, client, tmp_path, path)


def test_gives_up_on_a_redirect_loop(server, client, tmp_path):
    with pytest.raises(FetchError, match="redirected too many times"):
        _download(server, client, tmp_path, "/loop")


def test_rejects_a_redirect_to_nowhere(server, client, tmp_path):
    with pytest.raises(FetchError, match="redirected to nowhere"):
        _download(server, client, tmp_path, "/nowhere")


def test_rejects_a_download_page_instead_of_a_file(server, client, tmp_path):
    """The common mistake: a Drive or Dropbox preview link, not the file."""
    with pytest.raises(FetchError, match="did not return a GeoTIFF"):
        _download(server, client, tmp_path, "/html")


def test_rejects_an_empty_response(server, client, tmp_path):
    with pytest.raises(FetchError, match="no data"):
        _download(server, client, tmp_path, "/empty")


def test_stops_a_body_that_runs_past_the_limit(server, client, tmp_path):
    """No Content-Length to go on, so the ceiling has to hold while streaming."""
    with pytest.raises(FetchError, match="larger than"):
        _download(server, client, tmp_path, "/huge", max_bytes=2 * 1024**2)


def test_refuses_a_declared_size_over_the_limit(server, client, tmp_path):
    """Cheaper than streaming it, when the server is honest about the size."""
    with pytest.raises(FetchError, match="larger than"):
        _download(server, client, tmp_path, "/lies-about-size", max_bytes=1024)


def test_a_missing_object_fails_for_good(server, client, tmp_path):
    with pytest.raises(FetchError) as err:
        _download(server, client, tmp_path, "/missing")
    assert not err.value.transient


@pytest.mark.parametrize("path", ["/broken"])
def test_a_server_error_is_worth_retrying(server, client, tmp_path, path):
    with pytest.raises(FetchError) as err:
        _download(server, client, tmp_path, path)
    assert err.value.transient


def test_an_unreachable_host_is_worth_retrying(client, tmp_path):
    with pytest.raises(FetchError) as err:
        download(
            "http://127.0.0.1:1/tif",
            str(tmp_path / "out.tif"),
            client=client,
            max_bytes=1024,
            allow_private=True,
        )
    assert err.value.transient


@pytest.mark.parametrize("head", [b"II*\x00", b"MM\x00*", b"II+\x00", b"MM\x00+"])
def test_accepts_every_tiff_flavour(head):
    assert looks_like_tiff(head + bytes(64))


@pytest.mark.parametrize("head", [b"<!DOCTYPE", b"\x89PNG", b"PK\x03\x04", b""])
def test_rejects_everything_else(head):
    assert not looks_like_tiff(head)


@pytest.mark.parametrize(
    "url",
    [
        "https://node.example/task/abc/download/all.zip?token=secret",
        "https://webodm.example/api/projects/1/tasks/abc/download/all.zip/",
    ],
)
def test_recognises_only_odm_archive_routes(url):
    assert is_odm_archive_url(url)


@pytest.mark.parametrize(
    "url",
    [
        "https://example/all.zip",
        "https://node.example/task/abc/download/orthophoto.tif",
        "https://webodm.example/api/projects/1/tasks/abc/download/textured.zip",
    ],
)
def test_does_not_extract_arbitrary_archive_urls(url):
    assert not is_odm_archive_url(url)


def test_extracts_only_the_odm_orthophoto(tmp_path):
    archive = tmp_path / "all.zip"
    archive.write_bytes(ODM_ARCHIVE)
    dest = tmp_path / "input.tif"
    assert extract_odm_orthophoto(str(archive), str(dest), len(TIFF)) == len(TIFF)
    assert dest.read_bytes() == TIFF


def test_nodeodm_archive_flow_stores_only_the_extracted_tiff(
    server, tmp_path, monkeypatch
):
    class _S3:
        uploaded = b""

        def upload_file(self, source, bucket, key, ExtraArgs):
            self.uploaded = Path(source).read_bytes()
            assert (bucket, key) == ("oam", "user/id/orthophoto.tif")
            assert ExtraArgs == {"ContentType": "image/tiff"}

    monkeypatch.setenv("ALLOW_PRIVATE_HOSTS", "true")
    s3 = _S3()
    dest = tmp_path / "input.tif"
    _fetch_from_url(
        s3,
        f"{server}/task/abc/download/all.zip",
        dest=str(dest),
        bucket="oam",
        key="user/id/orthophoto.tif",
        max_bytes=1024**2,
    )
    assert dest.read_bytes() == TIFF
    assert s3.uploaded == TIFF
    assert not list(tmp_path.glob("*.zip"))


@pytest.mark.parametrize(
    ("member", "content", "message"),
    [
        ("etc/passwd", TIFF, "does not contain"),
        ("odm_orthophoto/odm_orthophoto.tif", HTML, "not a GeoTIFF"),
    ],
)
def test_rejects_an_unsafe_or_wrong_archive(tmp_path, member, content, message):
    archive = tmp_path / "all.zip"
    archive.write_bytes(_archive(member, content))
    with pytest.raises(FetchError, match=message):
        extract_odm_orthophoto(str(archive), str(tmp_path / "out.tif"), 1024**2)


def test_archive_member_cannot_expand_past_the_limit(tmp_path):
    archive = tmp_path / "all.zip"
    archive.write_bytes(_archive(content=TIFF + bytes(4096)))
    with pytest.raises(FetchError, match="larger than"):
        extract_odm_orthophoto(str(archive), str(tmp_path / "out.tif"), len(TIFF))


def test_keeps_signatures_out_of_the_logs():
    url = "https://s3.example.org/o.tif?X-Amz-Signature=deadbeef"
    assert redacted(url) == "https://s3.example.org/o.tif"


def test_clearing_the_workspace_survives_what_it_cannot_delete(tmp_path, monkeypatch):
    """A retried step gets a used PVC, complete with a root-owned lost+found."""
    (tmp_path / "input.tif").write_bytes(b"old")
    (tmp_path / "lost+found").mkdir()
    real_rmtree = __import__("shutil").rmtree

    def _rmtree(path, *args, **kwargs):
        if path.endswith("lost+found"):
            raise OSError(13, "Permission denied")
        return real_rmtree(path, *args, **kwargs)

    monkeypatch.setattr("fetch.shutil.rmtree", _rmtree)
    clear_workspace(str(tmp_path))
    assert not (tmp_path / "input.tif").exists()
    assert (tmp_path / "lost+found").exists()


def test_the_redirect_limit_is_the_shared_one():
    """The API's message about too many hops has to mean the same number."""
    assert url_guard.MAX_REDIRECTS >= 2


def test_a_finished_input_survives_a_second_fetch_pod(tmp_path):
    """A duplicate fetch pod emptied /data while validate was reading it."""
    (tmp_path / "input.tif").write_bytes(TIFF)
    (tmp_path / "meta.json").write_text("{}")
    (tmp_path / "output.tif").write_bytes(b"stale COG")
    (tmp_path / "input.tif.part").write_bytes(b"half a download")
    (tmp_path / "tmp").mkdir()

    clear_workspace(str(tmp_path), keep=fetch.WORKSPACE_OUTPUTS)

    assert (tmp_path / "input.tif").read_bytes() == TIFF
    assert (tmp_path / "meta.json").exists()
    assert not (tmp_path / "output.tif").exists()
    assert not (tmp_path / "input.tif.part").exists()
    assert not (tmp_path / "tmp").exists()


def test_the_input_is_only_ever_published_whole(tmp_path, monkeypatch):
    """A reader sees the previous file or the new one, never a truncated one."""
    dest = tmp_path / "input.tif"

    class _S3:
        def head_object(self, Bucket, Key):
            return {"ContentLength": len(TIFF)}

        def download_file(self, bucket, key, path, Callback=None):
            assert path.endswith(fetch.PARTIAL_SUFFIX) and path != str(dest)
            assert not dest.exists()
            Path(path).write_bytes(TIFF)

    _fetch_from_bucket(
        _S3(),
        dest=str(dest),
        bucket="oam",
        key="k",
        max_bytes=1024**2,
        label="download",
    )
    assert dest.read_bytes() == TIFF
    assert not list(tmp_path.glob("*" + fetch.PARTIAL_SUFFIX))


def test_a_partial_removed_by_another_pod_is_not_a_failure(tmp_path):
    """A later pod unlinked our partial, having published `dest` itself."""
    dest = tmp_path / "input.tif"
    dest.write_bytes(TIFF)
    fetch._publish(str(tmp_path / ("gone" + fetch.PARTIAL_SUFFIX)), str(dest))
    assert dest.read_bytes() == TIFF


def test_a_lost_partial_with_nothing_published_still_fails(tmp_path):
    with pytest.raises(FileNotFoundError):
        fetch._publish(
            str(tmp_path / ("gone" + fetch.PARTIAL_SUFFIX)), str(tmp_path / "input.tif")
        )


def test_two_concurrent_fetches_never_publish_a_mixed_file(tmp_path):
    """Sharing one temporary file would publish a mix of both writers."""
    dest = tmp_path / "input.tif"
    bodies = {"a": TIFF + b"a" * 4096, "b": TIFF + b"b" * 4096}
    both_writing = threading.Barrier(len(bodies))
    paths: list[str] = []
    failures: list[BaseException] = []

    class _S3:
        def __init__(self, body):
            self.body = body

        def head_object(self, Bucket, Key):
            return {"ContentLength": len(self.body)}

        def download_file(self, bucket, key, path, Callback=None):
            paths.append(path)
            with open(path, "wb") as out:
                # Hold both open at once, so a shared path would interleave.
                out.write(self.body[:2048])
                out.flush()
                both_writing.wait()
                out.write(self.body[2048:])

    def _run(body):
        try:
            _fetch_from_bucket(
                _S3(body),
                dest=str(dest),
                bucket="oam",
                key="k",
                max_bytes=1024**2,
                label="download",
            )
        except BaseException as err:  # noqa: BLE001
            failures.append(err)

    threads = [threading.Thread(target=_run, args=(b,)) for b in bodies.values()]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert not failures, f"a concurrent fetch failed: {failures}"
    assert len(set(paths)) == len(bodies), f"writers shared a file: {paths}"
    assert dest.read_bytes() in bodies.values(), "published a mix of both writers"
    assert not list(tmp_path.glob("*" + fetch.PARTIAL_SUFFIX))


@pytest.mark.parametrize(
    ("local", "archived", "complete"),
    [
        (TIFF, len(TIFF), True),
        (TIFF, len(TIFF) + 1, False),  # an earlier attempt did not finish
        (TIFF, None, False),  # never archived, so nothing to trust it against
        (b"", 0, False),
        (None, len(TIFF), False),
    ],
)
def test_a_finished_download_is_not_done_twice(tmp_path, local, archived, complete):
    dest = tmp_path / "input.tif"
    if local is not None:
        dest.write_bytes(local)

    class _S3:
        def head_object(self, Bucket, Key):
            if archived is None:
                raise botocore.exceptions.ClientError({}, "HeadObject")
            return {"ContentLength": archived}

    assert fetch._complete_input(_S3(), str(dest), bucket="oam", key="k") is complete
