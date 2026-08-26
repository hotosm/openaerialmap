"""Rewriting share links into something the fetch step can download."""

import base64

import pytest
from litestar.exceptions import HTTPException

from app.uploads import service
from app.uploads.source_links import is_odm_archive, normalise
from app.uploads.url_guard import UrlRejected

DRIVE_DIRECT = (
    "https://drive.usercontent.google.com/download"
    "?id=1AbC_dEf-123&export=download&confirm=t"
)
NODEODM_ARCHIVE = "https://node.example.org/task/9f8e7d6c/download/all.zip"


@pytest.mark.parametrize(
    "url",
    [
        "https://drive.google.com/file/d/1AbC_dEf-123/view?usp=sharing",
        "https://drive.google.com/file/d/1AbC_dEf-123/edit",
        "https://drive.google.com/open?id=1AbC_dEf-123",
        "https://drive.google.com/uc?export=download&id=1AbC_dEf-123",
        # Already on the download endpoint, but without the confirm that gets
        # a large file past the virus-scan page.
        "https://drive.usercontent.google.com/download?id=1AbC_dEf-123",
    ],
)
def test_drive_links_become_the_download_endpoint(url):
    assert normalise(url) == DRIVE_DIRECT


def test_a_drive_resource_key_survives_the_rewrite():
    assert (
        normalise(
            "https://drive.google.com/file/d/1AbC_dEf-123/view?resourcekey=0-secret"
        )
        == f"{DRIVE_DIRECT}&resourcekey=0-secret"
    )


@pytest.mark.parametrize(
    "url",
    [
        "https://drive.google.com/drive/folders/1AbC_dEf-123",
        "https://drive.google.com/drive/u/0/my-drive",
        "https://docs.google.com/document/d/1AbC_dEf-123/edit",
        # No file ID to work with.
        "https://drive.google.com/file/d//view",
        "https://drive.google.com/",
    ],
)
def test_drive_links_we_cannot_use_are_named_as_such(url):
    with pytest.raises(UrlRejected):
        normalise(url)


@pytest.mark.parametrize(
    "url",
    [
        "https://www.dropbox.com/scl/fi/abc123/ortho.tif?rlkey=xyz&dl=0",
        "https://www.dropbox.com/scl/fi/abc123/ortho.tif?rlkey=xyz&dl=1",
        # `raw=1` does the same job; the two together are ambiguous.
        "https://www.dropbox.com/scl/fi/abc123/ortho.tif?rlkey=xyz&raw=1",
        "https://www.dropbox.com/scl/fi/abc123/ortho.tif?rlkey=xyz",
    ],
)
def test_a_dropbox_link_is_forced_to_a_direct_download(url):
    result = normalise(url)
    assert result.startswith("https://www.dropbox.com/scl/fi/abc123/ortho.tif?")
    assert "dl=1" in result
    assert "raw=" not in result
    assert "rlkey=xyz" in result


def test_a_dropbox_folder_is_refused():
    with pytest.raises(UrlRejected, match="folder"):
        normalise("https://www.dropbox.com/scl/fo/abc123/AAA?rlkey=xyz&dl=0")


def test_a_dropbox_content_host_link_is_left_alone():
    """Already the direct form; nothing to fix."""
    url = "https://uc123.dl.dropboxusercontent.com/cd/0/get/abc/ortho.tif"
    assert normalise(url) == url


def test_a_consumer_onedrive_link_goes_through_the_shares_api():
    share = "https://1drv.ms/u/s!AbCdEf-123"
    token = base64.urlsafe_b64encode(share.encode()).decode().rstrip("=")
    assert normalise(share) == (
        f"https://api.onedrive.com/v1.0/shares/u!{token}/root/content"
    )
    assert "=" not in normalise(share).split("u!")[1].split("/")[0]


def test_a_sharepoint_file_link_is_given_download_1():
    result = normalise(
        "https://contoso-my.sharepoint.com/:u:/g/personal/sam/AbC123?e=xYz"
    )
    assert result.startswith(
        "https://contoso-my.sharepoint.com/:u:/g/personal/sam/AbC123?"
    )
    assert "download=1" in result
    # The share token has to survive, or the link stops resolving.
    assert "e=xYz" in result


def test_a_sharepoint_folder_is_refused():
    with pytest.raises(UrlRejected, match="folder"):
        normalise("https://contoso.sharepoint.com/:f:/g/personal/sam/AbC123")


def test_a_legacy_nodeodm_orthophoto_link_becomes_the_assets_archive():
    url = "https://node.example.org/task/9f8e7d6c/download/orthophoto.tif?token=secret"
    assert normalise(url) == f"{NODEODM_ARCHIVE}?token=secret"


def test_a_nodeodm_archive_link_passes_through_with_its_token():
    assert normalise(f"{NODEODM_ARCHIVE}?token=secret") == (
        f"{NODEODM_ARCHIVE}?token=secret"
    )


@pytest.mark.parametrize(
    "url",
    [
        NODEODM_ARCHIVE,
        "https://webodm.example/api/projects/7/tasks/abc/download/all.zip/",
    ],
)
def test_odm_archives_are_identified_for_a_tiff_storage_name(url):
    assert is_odm_archive(url)


def test_a_direct_orthophoto_is_not_misnamed_as_an_archive():
    assert not is_odm_archive(
        "https://webodm.example/api/projects/7/tasks/abc/download/orthophoto.tif"
    )


@pytest.mark.parametrize(
    ("asset", "expected"),
    [
        ("georeferenced_model.laz", "not an orthophoto"),
        ("orthophoto.png", "not an orthophoto"),
    ],
)
def test_other_odm_assets_point_at_the_orthophoto_instead(asset, expected):
    with pytest.raises(UrlRejected, match=expected):
        normalise(f"https://node.example.org/task/9f8e7d6c/download/{asset}")


@pytest.mark.parametrize("asset", ["orthophoto.tif", "all.zip"])
def test_a_public_webodm_download_link_is_accepted(asset):
    url = f"https://webodm.example.org/api/projects/7/tasks/abc/download/{asset}"
    assert normalise(url) == url


def test_an_unrelated_webodm_asset_is_refused():
    with pytest.raises(UrlRejected, match="not an orthophoto"):
        normalise(
            "https://webodm.example.org/api/projects/7/tasks/abc/download/"
            "textured_model.zip"
        )


@pytest.mark.parametrize(
    "url",
    [
        # Object storage already serves bytes; a rewrite could only break the
        # signature. This is the ScaleODM path, and S3-compatible generally.
        "https://bucket.s3.eu-west-1.amazonaws.com/ortho.tif"
        "?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=abc&X-Amz-Expires=900",
        "https://storage.googleapis.com/bucket/ortho.tif"
        "?X-Goog-Signature=abc&X-Goog-Expires=900",
        "https://acct.blob.core.windows.net/c/ortho.tif?sv=2024-11-04&sig=abc",
        "https://acct.r2.cloudflarestorage.com/bucket/ortho.tif?X-Amz-Signature=abc",
        "https://s3.us-west-000.backblazeb2.com/bucket/ortho.tif",
        "https://minio.example.org/bucket/ortho.tif",
        "https://imagery.example.org/ortho.tif",
        # url_guard rejects these; normalising is not the place to duplicate it.
        "http://imagery.example.org/ortho.tif",
        "not a url at all",
        "https://[not-an-ipv6-address/ortho.tif",
        "",
        "   ",
    ],
)
def test_an_unrecognised_url_is_returned_as_it_came(url):
    assert normalise(url) == url.strip()


@pytest.mark.asyncio
async def test_the_api_vets_the_rewritten_url_not_the_pasted_one(monkeypatch):
    """The stored URL and the checked URL have to be the same one."""
    seen = []
    monkeypatch.setattr(
        service.url_guard, "check_url", lambda url, **kw: seen.append(url) or url
    )

    stored = await service._checked_source_url(
        "  https://drive.google.com/file/d/1AbC_dEf-123/view?usp=sharing  "
    )
    assert seen == [DRIVE_DIRECT]
    assert stored == DRIVE_DIRECT

    # And a link with no direct form never reaches the guard at all.
    seen.clear()
    with pytest.raises(HTTPException, match="folder"):
        await service._checked_source_url(
            "https://www.dropbox.com/scl/fo/abc123/AAA?dl=0"
        )
    assert seen == []
