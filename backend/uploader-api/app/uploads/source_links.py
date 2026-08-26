"""Rewrite share links into direct downloads, and reject those with no direct form.

Runs in the API ahead of `url_guard`, so the URL we store, vet and fetch is one URL.
Not a security control: `url_guard` vets whatever comes out, and fetch vets each
redirect after that.
"""

import base64
import re
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from app.uploads.url_guard import UrlRejected

DRIVE_HOSTS = frozenset(
    {"drive.google.com", "docs.google.com", "drive.usercontent.google.com"}
)
DRIVE_DOWNLOAD_HOST = "drive.usercontent.google.com"
DROPBOX_HOSTS = frozenset({"www.dropbox.com", "dropbox.com"})
ONEDRIVE_HOSTS = frozenset({"1drv.ms", "onedrive.live.com"})
SHAREPOINT_SUFFIX = ".sharepoint.com"
ODM_ORTHO_ASSET = "orthophoto.tif"
ODM_ARCHIVE_ASSET = "all.zip"

_DRIVE_FILE_PATH = re.compile(r"^/file/d/([A-Za-z0-9_-]+)")
_ODM_ASSET_PATH = re.compile(r"^/task/[A-Za-z0-9_-]+/download/(?P<asset>[^/]+)$")
_WEBODM_ASSET_PATH = re.compile(
    r"^/api/projects/\d+/tasks/[^/]+/download/(?P<asset>[^/]+)/?$"
)
# SharePoint puts the share kind in the path; ":f:" is a folder, ":u:" a file.
_SHAREPOINT_FOLDER = re.compile(r"^/:f:/")


def _query(parts) -> dict[str, str]:
    """Read the query as a dict; a repeated key keeps its last value."""
    return dict(parse_qsl(parts.query, keep_blank_values=True))


def _rebuilt(parts, host: str, path: str, query: dict[str, str]) -> str:
    """Reassemble a URL from the pieces we changed, dropping the fragment."""
    return urlunsplit((parts.scheme, host, path, urlencode(query), ""))


def _drive_direct(parts) -> str:
    """Rewrite a Drive link to the download endpoint that skips the scan page."""
    query = _query(parts)
    path = parts.path

    if path.startswith(("/drive/folders/", "/drive/u/")):
        raise UrlRejected(
            "That is a link to a Google Drive folder, not a file. Open the "
            "GeoTIFF itself, then share and copy that file's link."
        )
    if path.startswith(("/document/", "/spreadsheets/")):
        raise UrlRejected("That is a Google Docs link, not a link to a file.")

    matched = _DRIVE_FILE_PATH.match(path)
    file_id = matched.group(1) if matched else query.get("id", "").strip()
    if not file_id:
        raise UrlRejected(
            "Could not find a file ID in that Google Drive link. Use the link "
            "from the file's own Share button."
        )
    # `confirm=t` suppresses the "can't scan this file" page for a large file.
    direct_query = {"id": file_id, "export": "download", "confirm": "t"}
    # Some link-shared files require this extra capability. Drive includes it
    # in webViewLink/webContentLink, so dropping it can turn a public link into
    # an access-denied page for a first-time visitor.
    resource_key = query.get("resourcekey", "").strip()
    if resource_key:
        direct_query["resourcekey"] = resource_key
    return _rebuilt(
        parts,
        DRIVE_DOWNLOAD_HOST,
        "/download",
        direct_query,
    )


def _dropbox_direct(parts) -> str:
    """Force `dl=1` on a Dropbox share link so it serves bytes, not a page."""
    if parts.path.startswith("/scl/fo/"):
        raise UrlRejected(
            "That is a link to a Dropbox folder, not a file. Share the GeoTIFF "
            "on its own and copy that link."
        )
    query = _query(parts)
    # `raw=1` does the same job, and the two together are ambiguous.
    query.pop("raw", None)
    query["dl"] = "1"
    return _rebuilt(parts, parts.netloc, parts.path, query)


def _onedrive_direct(parts) -> str:
    """Resolve a consumer OneDrive share link through the public shares API."""
    share = urlunsplit(parts._replace(fragment=""))
    # Microsoft's share-ID encoding: "u!" plus unpadded base64url of the URL.
    token = base64.urlsafe_b64encode(share.encode()).decode().rstrip("=")
    return f"https://api.onedrive.com/v1.0/shares/u!{token}/root/content"


def _sharepoint_direct(parts) -> str:
    """Add `download=1` to a SharePoint or OneDrive for Business share link."""
    if _SHAREPOINT_FOLDER.match(parts.path):
        raise UrlRejected(
            "That is a link to a SharePoint folder, not a file. Share the "
            "GeoTIFF on its own and copy that link."
        )
    query = _query(parts)
    query["download"] = "1"
    return _rebuilt(parts, parts.netloc, parts.path, query)


def _odm_asset(parts) -> str:
    """Turn a legacy NodeODM asset link into its supported all.zip endpoint."""
    asset = _ODM_ASSET_PATH.match(parts.path).group("asset")
    if asset.lower() == ODM_ARCHIVE_ASSET:
        return urlunsplit(parts._replace(fragment=""))
    if asset.lower() == ODM_ORTHO_ASSET:
        # NodeODM 2 removed direct asset downloads; only all.zip remains. The
        # fetch step extracts just odm_orthophoto/odm_orthophoto.tif from it.
        path = parts.path[: -len(asset)] + ODM_ARCHIVE_ASSET
        return urlunsplit(parts._replace(path=path, fragment=""))
    raise UrlRejected(
        f"'{asset}' is not an orthophoto. Use the NodeODM '{ODM_ARCHIVE_ASSET}' "
        "download link instead."
    )


def _webodm_asset(parts) -> str:
    """Accept a public WebODM orthophoto or assets archive URL.

    Private projects still return 401/403 because the fetcher deliberately does
    not accept a WebODM login token. A public task can serve the same endpoint
    without credentials.
    """
    asset = _WEBODM_ASSET_PATH.match(parts.path).group("asset")
    if asset.lower() in (ODM_ORTHO_ASSET, ODM_ARCHIVE_ASSET):
        return urlunsplit(parts._replace(fragment=""))
    raise UrlRejected(
        f"'{asset}' is not an orthophoto. Use '{ODM_ORTHO_ASSET}' or "
        f"'{ODM_ARCHIVE_ASSET}' from the WebODM task."
    )


# Ordered; the first host or path that matches decides. Add a source here.
_REWRITERS = (
    (lambda host, path: host in DRIVE_HOSTS, _drive_direct),
    (lambda host, path: host in DROPBOX_HOSTS, _dropbox_direct),
    (lambda host, path: host in ONEDRIVE_HOSTS, _onedrive_direct),
    (lambda host, path: host.endswith(SHAREPOINT_SUFFIX), _sharepoint_direct),
    (lambda host, path: bool(_WEBODM_ASSET_PATH.match(path)), _webodm_asset),
    (lambda host, path: bool(_ODM_ASSET_PATH.match(path)), _odm_asset),
)


def is_odm_archive(url: str) -> bool:
    """Return whether a normalised URL is an ODM/WebODM all.zip download."""
    path = urlsplit(url).path
    node = _ODM_ASSET_PATH.match(path)
    web = _WEBODM_ASSET_PATH.match(path)
    matched = node or web
    return bool(matched and matched.group("asset").lower() == ODM_ARCHIVE_ASSET)


def normalise(url: str) -> str:
    """Return the direct-download form of a source URL, else raise `UrlRejected`.

    An unrecognised URL comes back unchanged: a presigned object-storage URL, or
    any plain link to a file, already serves bytes and needs no help.
    """
    candidate = (url or "").strip()
    if not candidate:
        # url_guard says this better, and says it for every caller.
        return candidate

    try:
        parts = urlsplit(candidate)
    except ValueError:
        # A malformed authority; url_guard is the one that reports on those.
        return candidate
    try:
        host = (parts.hostname or "").lower()
    except ValueError:
        # A malformed authority; url_guard is the one that reports on those.
        return candidate

    for matches, rewrite in _REWRITERS:
        if matches(host, parts.path):
            return rewrite(parts)
    return candidate
