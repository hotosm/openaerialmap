"""Submitting a workflow exactly once.

The name is derived from the upload rather than generated, so a resubmit is a
409 we can read as "yes, it is already running" instead of a second workflow
processing the same imagery.
"""

import pytest
from kubernetes.client.exceptions import ApiException

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
