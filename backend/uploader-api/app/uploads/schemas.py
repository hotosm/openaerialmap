"""Request bodies for the upload API, and the checks that shape them."""

import datetime as dt
from urllib.parse import urlsplit

from litestar import status_codes as status
from litestar.exceptions import HTTPException
from pydantic import BaseModel, Field

from app.db.models import UploadStatus

ALLOWED_CONTENT_TYPES = {"image/tiff", "image/tif", "application/octet-stream"}

MAX_METADATA_VALUE_LENGTH = 500

# Metadata keys the pipeline understands. Anything else is dropped: this dict
# is echoed into the STAC item, not a place to stash arbitrary content.
_METADATA_FIELDS = (
    "title",
    "provider",
    "platform",
    "license",
    "acquisition_start",
    "acquisition_end",
    "sensor",
    "contact",
    "product_type",
)


class ExternalLink(BaseModel):
    """Linkage from whatever system requested the upload.

    `external_id` is an idempotency key; `external_url` is a public backlink and
    is not used to fetch anything.
    """

    external_id: str | None = Field(default=None, max_length=255)
    external_url: str | None = Field(default=None, max_length=2048)


class CreateMultipartBody(ExternalLink):
    """Start a multipart upload for a titled dataset."""

    filename: str = Field(min_length=1, max_length=255)
    title: str = Field(min_length=1, max_length=200)
    content_type: str = "image/tiff"
    # Advisory: the pipeline re-checks the assembled object against the limit.
    size_bytes: int = Field(gt=0)
    metadata: dict[str, str] = {}


class CreateRemoteUploadBody(ExternalLink):
    """Register an upload whose bytes the pipeline fetches for itself."""

    source_url: str = Field(min_length=1)
    title: str = Field(min_length=1, max_length=200)
    filename: str = Field(default="", max_length=255)
    metadata: dict[str, str] = {}


class ChecksumBody(BaseModel):
    """Checksum of the original bytes, reported by the pipeline."""

    checksum: str = Field(min_length=1, max_length=255)


class SignedUrlBody(BaseModel):
    """Request a presigned URL for one part."""

    key: str
    upload_id: str
    part_number: int


class ListPartsBody(BaseModel):
    """List already-uploaded parts (for resume)."""

    key: str
    upload_id: str


class Part(BaseModel):
    """A completed part."""

    ETag: str
    PartNumber: int


class CompleteMultipartBody(BaseModel):
    """Finish a multipart upload and kick off processing.

    No title or filename: the handler reads both from the session row.
    """

    key: str
    upload_id: str
    parts: list[Part]


class AbortMultipartBody(BaseModel):
    """Abort an in-progress multipart upload."""

    key: str
    upload_id: str


class WorkflowStatusBody(BaseModel):
    """Status update posted by an Argo workflow step.

    `status` is the enum, so an unrecognised step-id is a 400 rather than a row
    nothing will ever move again.
    """

    id: str
    status: UploadStatus
    message: str = ""


def _parse_iso(value: str | None) -> dt.datetime | None:
    """Parse an ISO-8601 date or datetime as UTC-aware, else None.

    A prefill link carries a full timestamp while the form's date input gives
    back YYYY-MM-DD, and comparing naive to aware raises TypeError.
    """
    if not value or not value.strip():
        return None
    try:
        parsed = dt.datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=dt.UTC)


def clean_metadata(
    metadata: dict[str, str], title: str, contact_default: str | None = None
) -> dict[str, str]:
    """Validate the acquisition window and keep only known metadata fields.

    `contact` falls back to the signed-in user's display name. Their email would
    be more useful but goes into a public catalogue, so it stays opt-in.
    """
    start = _parse_iso(metadata.get("acquisition_start"))
    if start is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A valid ISO-8601 acquisition start date is required.",
        )
    end = None
    end_raw = metadata.get("acquisition_end", "").strip()
    if end_raw:
        end = _parse_iso(end_raw)
        if end is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="acquisition_end is not a valid ISO-8601 date.",
            )
        if end < start:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="acquisition_end must be on or after acquisition_start.",
            )
    cleaned = {
        # Truncated, not rejected: these are free text, and the only thing that
        # matters is that a caller cannot stash a megabyte in the catalogue.
        field: metadata[field].strip()[:MAX_METADATA_VALUE_LENGTH]
        for field in _METADATA_FIELDS
        if metadata.get(field) and metadata[field].strip()
    }
    # Store the normalised form; this ends up in the STAC item.
    cleaned["acquisition_start"] = start.isoformat()
    if end is not None:
        cleaned["acquisition_end"] = end.isoformat()
    cleaned["title"] = title
    if not cleaned.get("contact") and contact_default:
        cleaned["contact"] = contact_default
    return cleaned


def clean_external(data: ExternalLink) -> tuple[str | None, str | None]:
    """Normalise the opaque linkage fields, validating only the backlink."""
    external_id = (data.external_id or "").strip() or None
    external_url = (data.external_url or "").strip() or None
    if external_url:
        parts = urlsplit(external_url)
        # Published, not fetched, but a javascript: href in a rendered
        # catalogue would be an XSS sink.
        if parts.scheme not in ("https", "http") or not parts.netloc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="external_url must be an http(s) URL.",
            )
    return external_id, external_url
