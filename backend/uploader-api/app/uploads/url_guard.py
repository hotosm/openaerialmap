"""Address rules for fetch-by-URL.

The API applies these to the URL a caller submits and the pipeline's fetch step
applies them again to every redirect it is sent to, so this module is copied
into the fetch image and must not import litestar or the app settings.
"""

import ipaddress
import socket
from urllib.parse import urlsplit, urlunsplit

MAX_SOURCE_URL_LENGTH = 4096
MAX_REDIRECTS = 5
REDIRECT_STATUSES = (301, 302, 303, 307, 308)


class UrlRejected(ValueError):
    """A URL we will not fetch. The message is safe to show the caller."""


def _resolve(host: str) -> list[str]:
    infos = socket.getaddrinfo(host, None, proto=socket.IPPROTO_TCP)
    return [info[4][0] for info in infos]


def _is_public(address: str) -> bool:
    try:
        parsed = ipaddress.ip_address(address)
    except ValueError:
        return False
    # is_global covers loopback, link-local, private, reserved and multicast.
    return (getattr(parsed, "ipv4_mapped", None) or parsed).is_global


def check_url(url: str, *, allow_private: bool = False, resolver=_resolve) -> str:
    """Return a fetchable, normalised source URL, or raise UrlRejected.

    A literal address needs no special case: getaddrinfo hands it straight back.
    """
    candidate = (url or "").strip()
    if not candidate:
        raise UrlRejected("A source URL is required.")
    if len(candidate) > MAX_SOURCE_URL_LENGTH:
        raise UrlRejected("The source URL is too long.")

    try:
        parts = urlsplit(candidate)._replace(fragment="")
    except ValueError as err:
        raise UrlRejected("The source URL is malformed.") from err
    try:
        parts.port
    except ValueError as err:
        raise UrlRejected("The source URL has an invalid port.") from err
    if parts.scheme not in ("https", "http"):
        raise UrlRejected("The source URL must be an http(s) URL.")
    if parts.username or parts.password:
        raise UrlRejected("The source URL must not embed credentials.")
    if not parts.hostname:
        raise UrlRejected("The source URL has no host.")

    if allow_private:
        return urlunsplit(parts)
    if parts.scheme != "https":
        raise UrlRejected("The source URL must use https.")

    try:
        addresses = resolver(parts.hostname)
    except OSError as err:
        raise UrlRejected(
            f"Could not resolve the source host '{parts.hostname}'."
        ) from err
    if not addresses or not all(_is_public(address) for address in addresses):
        # Don't echo the addresses back, that makes this a network scanner.
        raise UrlRejected(
            f"The source host '{parts.hostname}' does not resolve to a public "
            "address, so it cannot be fetched."
        )
    return urlunsplit(parts)
