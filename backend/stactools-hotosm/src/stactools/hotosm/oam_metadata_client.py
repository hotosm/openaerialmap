"""Client for the OAM metadata API."""

from __future__ import annotations

import datetime as dt
import logging
from dataclasses import dataclass
from typing import ClassVar, Iterator

import requests

from stactools.hotosm.oam_metadata import OamMetadata

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class OamMetadataClient:
    """OpenAerialMap metadata API client."""

    DEFAULT_API_ROOT: ClassVar[str] = "https://api.openaerialmap.org/meta"

    session: requests.Session
    api_root: str

    @classmethod
    def new(
        cls, session: requests.Session | None = None, api_root: str = DEFAULT_API_ROOT
    ) -> OamMetadataClient:
        """Create a new OamMetadataClient."""
        return cls(
            session=session or requests.Session(),
            api_root=api_root.rstrip("/"),
        )

    def _parse_result(self, result: dict) -> OamMetadata:
        """Parse a metadata API result into our data class."""
        uploaded_at = result.get("uploaded_at")
        if uploaded_at:
            uploaded_at = dt.datetime.fromisoformat(result["uploaded_at"])

        return OamMetadata(
            id=result["_id"],
            title=result["title"],
            contact=result["contact"],
            provider=result["provider"],
            platform=result["platform"],
            sensor=result["properties"].get("sensor"),
            license=result["properties"].get("license"),
            acquisition_start=dt.datetime.fromisoformat(result["acquisition_start"]),
            acquisition_end=dt.datetime.fromisoformat(result["acquisition_end"]),
            uploaded_at=uploaded_at,
            geojson=result["geojson"],
            bbox=result["bbox"],
            footprint_wkt=result["footprint"],
            projection_wkt=result["projection"],
            gsd=result["gsd"],
            image_url=result["uuid"],
            image_file_size=result["file_size"],
            thumbnail_url=result["properties"]["thumbnail"],
            metadata_url=result["meta_uri"],
        )

    def get_count(self) -> int:
        """Return the total count of items in the catalog."""
        resp = self.session.get(
            self.api_root,
            params={
                "limit": 1,
            },
        )
        resp.raise_for_status()
        return resp.json()["meta"]["found"]

    def get_item(
        self,
        item_id: str,
    ) -> OamMetadata:
        """Retrieve one OAM metadata item.

        Args:
            item_id: Unique identifier for an OAM catalog entry.

        Returns:
            The OamMetadata for the catalog entry requested.
        """
        resp = self.session.get(
            f"{self.api_root}/{item_id}",
        )
        resp.raise_for_status()
        result = resp.json()["results"]
        return self._parse_result(result)

    def get_items(
        self,
        uploaded_after: dt.datetime | None = None,
        limit: int = 100,
        page_number: int = 1,
        raise_on_error: bool = False,
    ) -> list[OamMetadata]:
        """List OAM metadata items.

        Args:
            uploaded_after: If provided, filter to only return items uploaded after this
                datetime. The datetime should be timezone aware.
            limit: Number of items to retrieve.
            page_number: Offset `limit` pages into the catalog, beginning with page 1.
            raise_on_error: Raise an exception if an item cannot be parsed instead of
                simply logging the exception. Defaults to False.

        Returns:
            At most `limit` metadata items.
        """
        resp = self.session.get(
            self.api_root,
            params={
                "order_by": "uploaded_at",
                "sort": "desc",
                "limit": str(limit),
                "page": str(page_number),
            },
        )
        resp.raise_for_status()

        results = []
        for result in resp.json()["results"]:
            # Some OAM metadata entries have null start/end times, so log these
            # as errors and keep moving
            try:
                parsed = self._parse_result(result)
            except Exception as e:
                logger.exception(f"Could not parse id={result['_id']}")
                if raise_on_error:
                    raise e
            else:
                if uploaded_after is not None:
                    if (
                        parsed.uploaded_at is not None
                        and parsed.uploaded_at >= uploaded_after
                    ):
                        results.append(parsed)
                else:
                    results.append(parsed)

        return results

    def get_all_items(
        self, uploaded_after: dt.datetime | None = None, limit: int = 500
    ) -> Iterator[OamMetadata]:
        """Iterate through all images in the catalog.

        Args:
            uploaded_after: If provided, filter to only return items uploaded after this
                date
            limit: Number of items to retrieve.
            raise_on_error: Raise an exception if an item cannot be parsed instead of
                simply logging the exception. Defaults to False.

        Returns:
            At most `limit` metadata items.
        """
        page = 1
        while True:
            items = self.get_items(
                uploaded_after=uploaded_after, limit=limit, page_number=page
            )
            if not items:
                break
            page += 1
            yield from items
