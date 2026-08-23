"""The address rules the API and the pipeline's fetch step both apply."""

import pytest

from app.uploads.url_guard import MAX_SOURCE_URL_LENGTH, UrlRejected, check_url

PUBLIC = ["93.184.216.34"]


@pytest.mark.parametrize(
    "url",
    [
        "",
        "   ",
        "ftp://example.org/a.tif",
        "file:///etc/passwd",
        "javascript:alert(1)",
        "http://example.org/a.tif",  # plaintext
        "https://user:pass@example.org/a.tif",
        "https:///a.tif",
        "https://[not-an-ipv6-address/a.tif",
        "https://example.org:notaport/a.tif",
        "https://example.org/" + "a" * MAX_SOURCE_URL_LENGTH,
    ],
)
def test_rejected_before_any_lookup(url):
    with pytest.raises(UrlRejected):
        check_url(url, resolver=lambda host: PUBLIC)


@pytest.mark.parametrize(
    "addresses",
    [
        [],
        ["127.0.0.1"],
        ["10.0.0.5"],
        ["169.254.169.254"],
        ["::1"],
        ["::ffff:127.0.0.1"],
        # One private answer among public ones is still a way in.
        ["93.184.216.34", "10.0.0.5"],
    ],
)
def test_non_public_hosts_are_rejected(addresses):
    with pytest.raises(UrlRejected):
        check_url("https://example.org/a.tif", resolver=lambda host: addresses)


def test_resolution_failure_is_rejected():
    def _boom(host):
        raise OSError("no such host")

    with pytest.raises(UrlRejected):
        check_url("https://nope.example/a.tif", resolver=_boom)


def test_a_public_url_is_returned_without_its_fragment():
    url = check_url("https://example.org/a.tif#frag", resolver=lambda host: PUBLIC)
    assert url == "https://example.org/a.tif"


def test_allow_private_skips_the_address_check():
    """Local compose and the Talos e2e run point at an in-network bucket."""
    url = check_url("http://minio:9000/oam/a.tif", allow_private=True)
    assert url == "http://minio:9000/oam/a.tif"


def test_a_message_never_names_the_addresses():
    """Otherwise this is a network scanner with a nice error format."""
    with pytest.raises(UrlRejected) as err:
        check_url("https://example.org/a.tif", resolver=lambda host: ["10.1.2.3"])
    assert "10.1.2.3" not in str(err.value)
