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
