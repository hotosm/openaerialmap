"""Submitting a workflow exactly once.

The name is derived from the upload rather than generated, so a resubmit is a
409 we can read as "yes, it is already running" instead of a second workflow
processing the same imagery.
"""

import uuid

import pytest
from kubernetes.client.api_client import ApiClient
from kubernetes.client.exceptions import ApiException

from app.config import settings
from app.uploads import argo

SUBMIT = dict(
    s3_path="s3://oam/u-abc/id/",
    filename="o.tif",
    key="u-abc/id/o.tif",
    upload_id="0f4e2a1c-1111-4222-8333-444455556666",
    user_sub="sub",
    callback_token="token",
)
NAME = f"geotiff-{SUBMIT['upload_id']}"


class _Api:
    def __init__(self, on_create=None):
        self.on_create = on_create
        self.created = []

    def create_namespaced_custom_object(self, **kwargs):
        self.created.append(kwargs)
        if self.on_create is not None:
            raise self.on_create
        return {"metadata": {"name": kwargs["body"]["metadata"]["name"]}}


@pytest.fixture
def api(monkeypatch):
    def _install(**kwargs):
        fake = _Api(**kwargs)
        monkeypatch.setattr(argo, "_api", lambda: fake)
        return fake

    return _install


def test_the_name_comes_from_the_upload():
    assert argo.workflow_name_for(SUBMIT["upload_id"]) == NAME
    # Argo puts this in a label on every pod, and a label value stops at 63.
    assert len(NAME) <= 63


def test_a_submission_uses_that_name(api):
    fake = api()
    assert argo.submit_geotiff_workflow(**SUBMIT) == NAME
    (call,) = fake.created
    assert call["body"]["metadata"] == {"name": NAME}
    assert call["_request_timeout"] == argo.REQUEST_TIMEOUT_SECONDS


def test_an_already_submitted_workflow_is_not_an_error(api):
    api(on_create=ApiException(status=409))
    assert argo.submit_geotiff_workflow(**SUBMIT) == NAME


def test_a_real_rejection_is_not_swallowed(api):
    """403 or a malformed spec has to surface, not look like success."""
    api(on_create=ApiException(status=403))
    with pytest.raises(ApiException):
        argo.submit_geotiff_workflow(**SUBMIT)


def params(call) -> dict:
    """The workflow parameters as a name -> value map."""
    return {
        p["name"]: p["value"] for p in call["body"]["spec"]["arguments"]["parameters"]
    }


def test_the_asset_base_url_names_the_bucket_once(api, monkeypatch):
    """
    The metadata step hangs asset hrefs straight off this value. It used to
    append the bucket itself, which doubled it for every base that already
    addressed one - which is every base the charts produce.
    """
    monkeypatch.setattr(
        settings, "PUBLIC_ASSET_BASE_URL", "https://s3.example.org/oam/"
    )
    fake = api()
    argo.submit_geotiff_workflow(**SUBMIT)
    (call,) = fake.created
    assert params(call)["externalaws"] == "https://s3.example.org/oam"


def test_a_bare_endpoint_gets_the_bucket_appended(api, monkeypatch):
    """Without a public base the store's own address has to name the bucket."""
    monkeypatch.setattr(settings, "PUBLIC_ASSET_BASE_URL", None)
    monkeypatch.setattr(settings, "S3_EXTERNAL_ENDPOINT", "http://localhost:9000")
    monkeypatch.setattr(settings, "S3_BUCKET", "oam")
    fake = api()
    argo.submit_geotiff_workflow(**SUBMIT)
    (call,) = fake.created
    assert params(call)["externalaws"] == "http://localhost:9000/oam"


def test_a_uuid_upload_id_still_submits(api):
    """`uploads.id` is a UUID column, so psycopg hands the row back a UUID.

    It reached `obj.openapi_types` in the client and 500'd the completion.
    """
    fake = api()
    upload_id = uuid.UUID(SUBMIT["upload_id"])
    argo.submit_geotiff_workflow(**{**SUBMIT, "upload_id": upload_id})
    (call,) = fake.created

    assert params(call)["id"] == SUBMIT["upload_id"]
    # The sanitizer is what actually broke; a fake api never reaches it.
    ApiClient().sanitize_for_serialization(call["body"])


def test_every_parameter_value_is_a_string(api):
    """Argo parameters are strings, and the client chokes on anything else."""
    fake = api()
    argo.submit_geotiff_workflow(**SUBMIT)
    (call,) = fake.created

    assert all(isinstance(v, str) for v in params(call).values())


# Workspace sizing. Every run used to take a 300Gi volume whatever it was
# processing, and the ceiling that volume implies was a constant in validate.


def _claim(call) -> dict:
    (claim,) = call["body"]["spec"]["volumeClaimTemplates"]
    return claim


def test_a_small_upload_gets_a_small_volume(api):
    fake = api()
    argo.submit_geotiff_workflow(**SUBMIT, size_bytes=40 * argo.GIB)
    storage = _claim(fake.created[0])["spec"]["resources"]["requests"]["storage"]
    assert storage == f"{int(40 * settings.WORKSPACE_MULTIPLIER)}Gi"


def test_a_tiny_upload_still_clears_the_floor(api):
    """A COG plus GDAL's temp files needs room a 50 MB ortho would not imply."""
    fake = api()
    argo.submit_geotiff_workflow(**SUBMIT, size_bytes=50 * 1024**2)
    storage = _claim(fake.created[0])["spec"]["resources"]["requests"]["storage"]
    assert storage == f"{settings.WORKSPACE_MIN_GIB}Gi"


def test_an_upload_at_the_ceiling_is_capped(api):
    fake = api()
    argo.submit_geotiff_workflow(**SUBMIT, size_bytes=settings.MAX_UPLOAD_BYTES)
    storage = _claim(fake.created[0])["spec"]["resources"]["requests"]["storage"]
    assert storage == f"{settings.WORKSPACE_MAX_GIB}Gi"


def test_a_remote_source_gets_the_ceiling(api):
    """Its size is not known until the fetch step has run."""
    fake = api()
    argo.submit_geotiff_workflow(**SUBMIT, remote_source=True)
    storage = _claim(fake.created[0])["spec"]["resources"]["requests"]["storage"]
    assert storage == f"{settings.WORKSPACE_MAX_GIB}Gi"


@pytest.mark.parametrize("gib", [1, 10, 40, 100])
def test_the_decoded_ceiling_fits_the_volume_it_was_sized_against(api, gib):
    """Input plus a worst-case incompressible COG plus overview temp, inside
    what the filesystem actually leaves usable."""
    fake = api()
    size = gib * argo.GIB
    argo.submit_geotiff_workflow(**SUBMIT, size_bytes=size)
    call = fake.created[0]
    workspace = int(
        _claim(call)["spec"]["resources"]["requests"]["storage"].removesuffix("Gi")
    )
    used = size + float(params(call)["max-decoded-gb"]) * 1e9 * argo.COG_TEMP_FACTOR
    assert used <= workspace * argo.GIB * argo.WORKSPACE_USABLE


def _ratio(fake, size) -> float:
    """The decode ratio the volume sized for `size` will actually tolerate."""
    return float(params(fake.created[0])["max-decoded-gb"]) * 1e9 / size


@pytest.mark.parametrize("gib", [1, 10, 40, 60])
def test_every_upload_size_admits_a_realistic_decode_ratio(api, gib):
    """The volume is sized off compressed bytes, which do not predict decoded
    ones: a JPEG-in-TIFF ortho reaches 10:1 and a 1 GiB upload is not a 1 GiB
    raster. Too tight a ratio here is the old 2-gigapixel bug again, so this
    pins the figure the multiplier is chosen for rather than a loose floor."""
    fake = api()
    size = gib * argo.GIB
    argo.submit_geotiff_workflow(**SUBMIT, size_bytes=size)
    assert _ratio(fake, size) >= 10


def test_the_biggest_uploads_trade_that_ratio_for_a_bounded_volume(api):
    """Past ~60 GiB the multiplier would ask for more than WORKSPACE_MAX_GIB, so
    the ratio degrades instead of the volume growing without limit."""
    fake = api()
    size = settings.MAX_UPLOAD_BYTES
    argo.submit_geotiff_workflow(**SUBMIT, size_bytes=size)
    assert 5 <= _ratio(fake, size) < 10


def test_the_reported_regression_would_now_pass(api):
    """A ~1 GiB upload of a strip past the old 2-gigapixel cap: 3 gigapixels of
    uint8 RGB is 9 GB decoded, and the ceiling it gets has to clear that."""
    fake = api()
    argo.submit_geotiff_workflow(**SUBMIT, size_bytes=1 * argo.GIB)
    ceiling = float(params(fake.created[0])["max-decoded-gb"])
    assert ceiling >= 3e9 * 3 / 1e9


def test_a_bigger_upload_may_decode_further(api):
    """The ceiling is per-run now, not one constant sized for the worst case."""
    fake = api()
    argo.submit_geotiff_workflow(**SUBMIT, size_bytes=10 * argo.GIB)
    argo.submit_geotiff_workflow(**SUBMIT, size_bytes=80 * argo.GIB)
    small, large = (float(params(c)["max-decoded-gb"]) for c in fake.created)
    assert large > small


def test_the_volume_is_reclaimed_when_configured(api, monkeypatch):
    """HOTOSM's default class is Retain, which leaves an EBS volume per run."""
    monkeypatch.setattr(settings, "WORKSPACE_STORAGE_CLASS", "gp3-ephemeral")
    fake = api()
    argo.submit_geotiff_workflow(**SUBMIT)
    assert _claim(fake.created[0])["spec"]["storageClassName"] == "gp3-ephemeral"


def test_no_storage_class_leaves_the_cluster_default(api, monkeypatch):
    """Local clusters have their own default and no gp3 of any kind."""
    monkeypatch.setattr(settings, "WORKSPACE_STORAGE_CLASS", "")
    fake = api()
    argo.submit_geotiff_workflow(**SUBMIT)
    assert "storageClassName" not in _claim(fake.created[0])["spec"]


def test_the_volume_keeps_room_the_arithmetic_does_not_claim(api):
    """ext4 metadata, the thumbnail, provenance JSON, GDAL's own scratch: the
    fit cannot be to the last byte, and the temp estimate is only an estimate."""
    fake = api()
    size = 40 * argo.GIB
    argo.submit_geotiff_workflow(**SUBMIT, size_bytes=size)
    call = fake.created[0]
    workspace = int(
        _claim(call)["spec"]["resources"]["requests"]["storage"].removesuffix("Gi")
    )
    used = size + float(params(call)["max-decoded-gb"]) * 1e9 * argo.COG_TEMP_FACTOR
    assert workspace * argo.GIB - used >= 0.04 * workspace * argo.GIB
