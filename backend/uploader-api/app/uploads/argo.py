"""Submit Argo Workflows through the Kubernetes API.

The service account is restricted to the configured namespace.
"""

import logging

from kubernetes import client, config
from kubernetes.client.exceptions import ApiException

from app.config import settings

log = logging.getLogger(__name__)

# An unreachable apiserver should fail the request, not hold a worker thread.
REQUEST_TIMEOUT_SECONDS = 30


def _api() -> client.CustomObjectsApi:
    """Load in-cluster config (falls back to local kubeconfig for dev)."""
    try:
        config.load_incluster_config()
    except config.ConfigException:
        config.load_kube_config()
    return client.CustomObjectsApi()


def workflow_name_for(upload_id: str) -> str:
    """Name the workflow for an upload, derived so a resubmit is not a second run."""
    return f"geotiff-{upload_id}"


def _public_asset_base_url() -> str:
    """Absolute base the pipeline hangs STAC asset hrefs off, bucket included.

    Every other consumer of a public base URL - the seed job, the tilepack API -
    treats it as addressing the bucket already, so a bare endpoint has to have
    the bucket appended here rather than in the metadata step.
    """
    if settings.PUBLIC_ASSET_BASE_URL:
        return settings.PUBLIC_ASSET_BASE_URL.rstrip("/")
    if settings.S3_EXTERNAL_ENDPOINT:
        return f"{settings.S3_EXTERNAL_ENDPOINT.rstrip('/')}/{settings.S3_BUCKET}"
    return ""


def submit_geotiff_workflow(
    *,
    s3_path: str,
    filename: str,
    key: str,
    upload_id: str,
    user_sub: str,
    callback_token: str,
    remote_source: bool = False,
) -> str:
    """Submit a GeoTIFF processing Workflow; return its name.

    `remote_source` selects the fetch-from-URL branch. The URL itself is not
    passed here: the workflow reads it back over its callback token, so a
    credential-bearing URL never lands in a Workflow spec that anyone with Argo
    read access could see.
    """
    name = workflow_name_for(upload_id)
    manifest = {
        "apiVersion": "argoproj.io/v1alpha1",
        "kind": "Workflow",
        "metadata": {"name": name},
        "spec": {
            "workflowTemplateRef": {"name": settings.ARGO_WORKFLOW_TEMPLATE},
            "arguments": {
                "parameters": [
                    {"name": "s3-path", "value": s3_path},
                    {"name": "filename", "value": filename},
                    {"name": "bucket", "value": settings.S3_BUCKET},
                    {"name": "key", "value": key},
                    {"name": "id", "value": upload_id},
                    {"name": "uuid", "value": user_sub},
                    {"name": "state", "value": callback_token},
                    {
                        "name": "externalaws",
                        "value": _public_asset_base_url(),
                    },
                    {"name": "awsurl", "value": settings.S3_ENDPOINT or ""},
                    {"name": "fronturl", "value": settings.WF_CALLBACK_URL},
                    {"name": "image-tag", "value": settings.PIPELINE_IMAGE_TAG},
                    {"name": "source-type", "value": "url" if remote_source else "s3"},
                    {
                        "name": "max-fetch-bytes",
                        "value": str(settings.MAX_UPLOAD_BYTES),
                    },
                    # The fetch step applies the same address rules as the API,
                    # so it needs the same answer about private hosts.
                    {
                        "name": "allow-private-hosts",
                        "value": str(settings.FETCH_ALLOW_PRIVATE_HOSTS).lower(),
                    },
                ]
            },
        },
    }
    try:
        _api().create_namespaced_custom_object(
            group="argoproj.io",
            version="v1alpha1",
            namespace=settings.ARGO_NAMESPACE,
            plural="workflows",
            body=manifest,
            _request_timeout=REQUEST_TIMEOUT_SECONDS,
        )
    except ApiException as err:
        if err.status != 409:
            raise
        # Someone got here first, which is the answer we wanted anyway.
        log.info("Workflow %s already exists; treating it as submitted", name)
    log.info(f"Submitted Argo workflow {name} for upload {upload_id}")
    return name
