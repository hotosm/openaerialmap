"""Register STAC items through the uploader API.

The API validates the per-upload token and keeps pgstac credentials out of this
workflow pod.
"""

import json
import logging
import os
import sys
import urllib.error
import urllib.request

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s [register] %(message)s",
)
log = logging.getLogger("register")


def register(item_path: str) -> None:
    """POST the STAC item to the uploader-api register endpoint."""
    log.info("Reading STAC item from %s", item_path)
    with open(item_path) as f:
        item = json.load(f)

    item_id = item.get("id")
    front_url = os.environ["FRONT_URL"].rstrip("/")
    token = os.environ.get("INTERNAL_TOKEN", "")
    url = f"{front_url}/api/v1/register"
    log.info("Registering item %s -> POST %s", item_id, url)
    log.debug("Item keys=%s, token set=%s", sorted(item.keys()), bool(token))

    req = urllib.request.Request(
        url,
        data=json.dumps(item).encode(),
        headers={"Content-Type": "application/json", "X-Internal-Token": token},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            log.info("Registered item %s (HTTP %s)", item_id, resp.status)
    except urllib.error.HTTPError as exc:
        log.error(
            "Register rejected for %s: HTTP %s: %s",
            item_id,
            exc.code,
            exc.read().decode(),
        )
        raise
    except urllib.error.URLError as exc:
        log.error("Register could not reach %s for %s: %s", url, item_id, exc.reason)
        raise


if __name__ == "__main__":
    try:
        register(sys.argv[1])
    except Exception:
        log.exception("Registration failed")
        sys.exit(1)
