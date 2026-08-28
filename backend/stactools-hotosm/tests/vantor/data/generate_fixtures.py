#!/usr/bin/env python
"""Generate files for fixtures."""

import json
from pathlib import Path
from urllib.parse import urljoin

import requests

from stactools.hotosm.vantor.sync import VANTOR_CATALOG, VANTOR_ROOT

HERE = Path(__file__).parent

# This event has no odp:event_date and includes useful edge cases.
EVENT = "Typhoon-Gezani-Feb-2026"
ITEM_IDS = [
    "1030010122291A00",
    # Missing eo:bands and has the wrong visual role.
    "B140001100103610",
    # Uses image/jpg instead of image/jpeg.
    "B150001101B05900",
]


def save_catalog():
    """Save the Vantor root STAC Catalog."""
    catalog = requests.get(VANTOR_CATALOG).json()
    with (HERE / "catalog.json").open("w") as dst:
        json.dump(catalog, dst, indent=1)


def save_collection():
    """Save an event Collection, trimmed to the Items we keep as fixtures."""
    url = urljoin(VANTOR_ROOT, f"{EVENT}/collection.json")
    collection = requests.get(url).json()

    kept = {urljoin(VANTOR_ROOT, f"{EVENT}/{id_}.json") for id_ in ITEM_IDS}
    collection["links"] = [
        link
        for link in collection["links"]
        if link.get("rel") != "item" or link["href"] in kept
    ]

    with (HERE / "collection.json").open("w") as dst:
        json.dump(collection, dst, indent=1)


def save_items():
    """Save the example Vantor STAC Items."""
    for id_ in ITEM_IDS:
        url = urljoin(VANTOR_ROOT, f"{EVENT}/{id_}.json")
        with (HERE / f"{id_}.json").open("w") as dst:
            json.dump(requests.get(url).json(), dst, indent=1)


if __name__ == "__main__":
    save_catalog()
    save_collection()
    save_items()
