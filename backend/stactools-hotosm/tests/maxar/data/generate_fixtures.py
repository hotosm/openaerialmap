#!/usr/bin/env python
"""Generate files for fixtures."""

import json
from pathlib import Path

import pystac
import requests

HERE = Path(__file__).parent


def save_catalog():
    """Save an Maxar STAC Catalog."""
    catalog = pystac.read_file(
        "https://maxar-opendata.s3.amazonaws.com/events/catalog.json"
    )
    catalog.save(pystac.CatalogType.RELATIVE_PUBLISHED, dest_href=HERE)


def save_item():
    """Save an example Maxar STAC Item."""
    item = pystac.read_file(
        "https://maxar-opendata.s3.amazonaws.com/events/WildFires-LosAngeles-Jan-2025/ard/11/031311102001/2024-12-14/103001010A705C00.json"
    )
    # Rewrite links with absolute hrefs
    links = []
    for link in item.links:
        links.append(
            pystac.Link(
                rel=link.rel,
                target=link.get_absolute_href(),
                media_type=link.media_type,
                title=link.title,
                extra_fields=link.extra_fields,
            )
        )
    item.links = links

    with (HERE / "item.json").open("w") as dst:
        json.dump(item.to_dict(), dst)


def save_event_info():
    """Save an Maxar STAC Catalog event info."""
    info = requests.get(
        "https://maxar-opendata.s3.amazonaws.com/events/event_info.json"
    ).json()
    with open(HERE / "event_info.json", "w") as dst:
        json.dump(info, dst)


if __name__ == "__main__":
    save_catalog()
    save_item()
    save_event_info()
