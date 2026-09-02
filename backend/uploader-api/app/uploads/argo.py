"""Submit Argo Workflows through the Kubernetes API.

The service account is restricted to the configured namespace.
"""

import logging
import math

from kubernetes import client, config
from kubernetes.client.exceptions import ApiException

from app.config import settings

log = logging.getLogger(__name__)

# An unreachable apiserver should fail the request, not hold a worker thread.
REQUEST_TIMEOUT_SECONDS = 30

GIB = 1024**3
# ext4 as the CSI driver formats it, plus masks, sidecars and rounding.
WORKSPACE_USABLE = 0.95
# GDAL puts the COG overview temp at roughly a third of the output, but calls
# that an estimate, so budget half.
COG_TEMP_FACTOR = 1.5


def workspace_gib(size_bytes: int | None) -> int:
    """Size the workspace volume for an upload of this many bytes.

    A remote source has no size until it has been fetched, so it gets the
    ceiling rather than a volume its imagery might not fit.
    """
    if not size_bytes:
        return settings.WORKSPACE_MAX_GIB
    wanted = math.ceil(size_bytes * settings.WORKSPACE_MULTIPLIER / GIB)
    return max(settings.WORKSPACE_MIN_GIB, min(wanted, settings.WORKSPACE_MAX_GIB))


def max_decoded_gb(workspace: int, size_bytes: int | None) -> int:
    """Bound what may decode into the space the input does not already hold.

    A lossless COG of incompressible pixels is the size of the decoded raster,
    so this is what validate rejects on before six hours of conversion.
    """
    free = workspace * GIB * WORKSPACE_USABLE - (
        size_bytes or settings.MAX_UPLOAD_BYTES
    )
    return max(1, int(free / COG_TEMP_FACTOR / 1e9))


def _workspace_claim(workspace: int) -> dict:
    """Build the volumeClaimTemplates entry overriding the template's fixed one."""
    spec: dict = {
        "accessModes": ["ReadWriteOnce"],
        "resources": {"requests": {"storage": f"{workspace}Gi"}},
    }
    if settings.WORKSPACE_STORAGE_CLASS:
        spec["storageClassName"] = settings.WORKSPACE_STORAGE_CLASS
    return {"metadata": {"name": "workspace"}, "spec": spec}


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
    size_bytes: int | None = None,
) -> str:
    """Submit a GeoTIFF processing Workflow; return its name.

    `remote_source` selects the fetch-from-URL branch. The URL itself is not
    passed here: the workflow reads it back over its callback token, so a
    credential-bearing URL never lands in a Workflow spec that anyone with Argo
    read access could see.
    """
    name = workflow_name_for(upload_id)
    workspace = workspace_gib(size_bytes)
    parameters = {
        "s3-path": s3_path,
        "filename": filename,
        "bucket": settings.S3_BUCKET,
        "key": key,
        "id": upload_id,
        "uuid": user_sub,
        "state": callback_token,
        "externalaws": _public_asset_base_url(),
        "awsurl": settings.S3_ENDPOINT or "",
        "fronturl": settings.WF_CALLBACK_URL,
        "image-tag": settings.PIPELINE_IMAGE_TAG,
        "source-type": "url" if remote_source else "s3",
        "max-fetch-bytes": settings.MAX_UPLOAD_BYTES,
        # The fetch step applies the same address rules as the API, so it needs
        # the same answer about private hosts.
        "allow-private-hosts": str(settings.FETCH_ALLOW_PRIVATE_HOSTS).lower(),
        "max-decoded-gb": max_decoded_gb(workspace, size_bytes),
    }
    manifest = {
        "apiVersion": "argoproj.io/v1alpha1",
        "kind": "Workflow",
        "metadata": {"name": name},
        "spec": {
            "workflowTemplateRef": {"name": settings.ARGO_WORKFLOW_TEMPLATE},
            # Overrides the template's fixed claim, which is the fallback for a
            # submission that does not come from here.
            "volumeClaimTemplates": [_workspace_claim(workspace)],
            "arguments": {
                # Argo parameters are strings, and the Kubernetes client reads
                # a stray UUID or int as one of its models and dies on it.
                "parameters": [
                    {"name": key_, "value": str(value)}
                    for key_, value in parameters.items()
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
    log.info(
        "Submitted Argo workflow %s for upload %s (%sGi workspace)",
        name,
        upload_id,
        workspace,
    )
    return name


# Keep failure details short enough to show directly to the uploader.
_MAX_DETAIL_CHARS = 300

# Prefer a failed child's reason over Argo's generic parent messages.
_UNHELPFUL_PREFIXES = ("child ", "No more retries left")


def _failure_detail(workflow_status: dict) -> str | None:
    """Summarise failure messages from failed pod nodes."""
    parts = []
    for node in (workflow_status.get("nodes") or {}).values():
        if node.get("type") != "Pod" or node.get("phase") not in ("Failed", "Error"):
            continue
        message = (node.get("message") or "").strip()
        if not message or message.startswith(_UNHELPFUL_PREFIXES):
            continue
        step = node.get("displayName") or node.get("templateName") or "step"
        parts.append(f"{step}: {message}")
    if not parts:
        message = (workflow_status.get("message") or "").strip()
        # A running workflow's status message is progress, not a failure reason.
        if workflow_status.get("phase") not in ("Failed", "Error"):
            return None
        if not message or message.startswith(_UNHELPFUL_PREFIXES):
            return None
        parts = [message]
    detail = "; ".join(sorted(parts))
    if len(detail) > _MAX_DETAIL_CHARS:
        detail = detail[: _MAX_DETAIL_CHARS - 1].rstrip() + "\u2026"
    return detail


def get_workflow_outcome(name: str) -> tuple[str | None, str | None]:
    """Return an Argo workflow's phase and best available failure detail."""
    try:
        workflow = _api().get_namespaced_custom_object(
            group="argoproj.io",
            version="v1alpha1",
            namespace=settings.ARGO_NAMESPACE,
            plural="workflows",
            name=name,
            _request_timeout=REQUEST_TIMEOUT_SECONDS,
        )
    except ApiException as err:
        if err.status == 404:
            return None, None
        raise
    workflow_status = workflow.get("status") or {}
    return workflow_status.get("phase") or "Pending", _failure_detail(workflow_status)
