"""Submit Argo Workflows through the Kubernetes API.

The service account is restricted to the configured namespace.
"""

import logging

from kubernetes import client, config

from app.config import settings

log = logging.getLogger(__name__)


def _api() -> client.CustomObjectsApi:
    """Load in-cluster config (falls back to local kubeconfig for dev)."""
    try:
        config.load_incluster_config()
    except config.ConfigException:
        config.load_kube_config()
    return client.CustomObjectsApi()


def submit_geotiff_workflow(
    *,
    s3_path: str,
    filename: str,
    key: str,
    upload_id: str,
    user_sub: str,
    callback_token: str,
) -> str:
    """Submit a GeoTIFF processing Workflow; return its generated name."""
    manifest = {
        "apiVersion": "argoproj.io/v1alpha1",
        "kind": "Workflow",
        "metadata": {"generateName": "geotiff-run-"},
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
                        "value": (
                            settings.PUBLIC_ASSET_BASE_URL
                            or settings.S3_EXTERNAL_ENDPOINT
                            or ""
                        ),
                    },
                    {"name": "awsurl", "value": settings.S3_ENDPOINT or ""},
                    {"name": "fronturl", "value": settings.WF_CALLBACK_URL},
                    {"name": "image-tag", "value": settings.PIPELINE_IMAGE_TAG},
                ]
            },
        },
    }
    created = _api().create_namespaced_custom_object(
        group="argoproj.io",
        version="v1alpha1",
        namespace=settings.ARGO_NAMESPACE,
        plural="workflows",
        body=manifest,
    )
    name = created["metadata"]["name"]
    log.info(f"Submitted Argo workflow {name} for upload {upload_id}")
    return name
