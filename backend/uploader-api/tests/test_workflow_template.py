"""What the WorkflowTemplate promises about the pods that touch a stranger's file.

The template is applied with kubectl rather than rendered by the chart, so
nothing else checks it: a step that runs as root, a step that keeps a
Kubernetes token, a rejected upload left in a public bucket.
"""

import re
from pathlib import Path

import pytest
import yaml

from app.db.models import UploadStatus
from app.uploads import argo

TEMPLATE = yaml.safe_load(
    (
        Path(__file__).resolve().parent.parent / "pipeline" / "workflow-template.yaml"
    ).read_text()
)
SPEC = TEMPLATE["spec"]
TEMPLATES = {t["name"]: t for t in SPEC["templates"]}
STEPS = {name: t for name, t in TEMPLATES.items() if "container" in t}
TASKS = {t["name"]: t for t in TEMPLATES["entry"]["dag"]["tasks"]}


def _dag_tasks(template: dict) -> list[dict]:
    """Every DAG task in a template."""
    return template.get("dag", {}).get("tasks", [])


def _exit_handler_steps() -> list[dict]:
    """The exit handler's steps, flattened out of their parallel groups."""
    return [step for group in TEMPLATES["exit-handler"]["steps"] for step in group]


# The steps that hand a caller's bytes to GDAL.
RASTER_STEPS = ("validate-geotiff", "convert-cog", "build-metadata")


def _pod_security() -> dict:
    return yaml.safe_load(SPEC["podSpecPatch"])["securityContext"]


# Hardening. GDAL parsing an upload is the largest attack surface here.


def test_no_step_runs_as_root():
    security = _pod_security()
    assert security["runAsNonRoot"] is True
    assert security["runAsUser"] == security["runAsGroup"] == 1000


def test_a_stuck_workflow_gives_its_volume_back():
    """volumeClaimGC only runs on completion, and each run holds 300Gi."""
    assert SPEC["activeDeadlineSeconds"] > 0
    assert SPEC["volumeClaimGC"]["strategy"] == "OnWorkflowCompletion"


def test_pods_do_not_outlive_the_workflow():
    assert SPEC["podGC"]["strategy"] == "OnWorkflowCompletion"


def test_a_failed_pod_survives_long_enough_to_read_its_logs():
    """`argo logs` reads live pods, and podGC deletes them on completion."""
    assert SPEC["podGC"]["deleteDelayDuration"]


def test_a_failure_outlives_a_success():
    ttl = SPEC["ttlStrategy"]
    assert ttl["secondsAfterFailure"] >= 86400
    assert ttl["secondsAfterSuccess"] < ttl["secondsAfterFailure"]
    assert ttl.get("secondsAfterCompletion", 0) >= ttl["secondsAfterFailure"]


def test_step_logs_are_archived():
    assert SPEC["archiveLogs"] is True


def test_the_exit_handler_leaves_the_reason_to_the_api():
    steps = {step["name"]: step for step in _exit_handler_steps()}
    params = {
        p["name"]: p["value"]
        for p in steps["report-failure"]["arguments"]["parameters"]
    }
    assert params["step-id"] == "Failed"
    assert params["message"] == ""


def test_the_workspace_volume_is_writable_without_root():
    """Non-root plus a ReadWriteOnce PVC needs an fsGroup or nothing can write."""
    assert _pod_security()["fsGroup"] == 1000


def test_seccomp_stays_on():
    assert _pod_security()["seccompProfile"]["type"] == "RuntimeDefault"


@pytest.mark.parametrize("step", sorted(STEPS))
def test_every_step_drops_its_capabilities(step):
    security = STEPS[step]["container"]["securityContext"]
    assert security["allowPrivilegeEscalation"] is False
    assert security["capabilities"]["drop"] == ["ALL"]


def test_steps_do_not_carry_a_kubernetes_token():
    """The executor needs one; the container running GDAL does not."""
    assert SPEC["automountServiceAccountToken"] is False
    assert SPEC["executor"]["serviceAccountName"]


@pytest.mark.parametrize("step", RASTER_STEPS)
def test_gdal_does_not_go_looking_for_sidecar_files(step):
    env = {e["name"]: e.get("value") for e in STEPS[step]["container"]["env"]}
    assert env["GDAL_DISABLE_READDIR_ON_OPEN"] == "EMPTY_DIR"


# The fetch step, which is the one talking to an address a caller chose.


def test_the_fetch_step_runs_the_fetch_image():
    assert "/uploader/fetch:" in STEPS["fetch-source"]["container"]["image"]


def test_the_source_url_is_not_in_the_workflow_spec():
    """It is read back over the callback token instead: a presigned URL is a
    credential, and a Workflow spec is readable by anyone with Argo access."""
    parameters = {p["name"] for p in SPEC["arguments"]["parameters"]}
    assert not {p for p in parameters if "url" in p and "aws" not in p} - {
        "fronturl",
        "awsurl",
    }
    env = {e["name"] for e in STEPS["fetch-source"]["container"]["env"]}
    assert "SOURCE_URL" not in env
    assert "INTERNAL_TOKEN" in env


def test_private_hosts_are_off_unless_a_deployment_asks():
    defaults = {p["name"]: p.get("value") for p in SPEC["arguments"]["parameters"]}
    assert defaults["allow-private-hosts"] == "false"


def test_only_a_transient_fetch_failure_is_retried():
    """A 404 or a rejected host fails the same way every time, and retrying it
    only delays the message the uploader is waiting for."""
    retry = TEMPLATES["fetch-source"]["retryStrategy"]
    assert "asInt(lastRetry.exitCode) == 75" in retry["expression"]


def test_the_fetch_step_gets_the_size_limit_it_has_to_enforce():
    env = {e["name"]: e.get("value") for e in STEPS["fetch-source"]["container"]["env"]}
    assert env["MAX_FETCH_BYTES"] == "{{workflow.parameters.max-fetch-bytes}}"


# Sizing.


def test_the_validate_step_takes_its_size_guards_from_parameters():
    """Otherwise retuning them for a deployment means editing Python."""
    env = {
        e["name"]: e.get("value") for e in STEPS["validate-geotiff"]["container"]["env"]
    }
    assert (
        env["OAM_VALIDATE_MAX_DECODED_GB"] == "{{workflow.parameters.max-decoded-gb}}"
    )
    assert (
        env["OAM_VALIDATE_MAX_GIGAPIXELS"] == "{{workflow.parameters.max-gigapixels}}"
    )


def test_pixels_are_not_capped():
    """100 GiB of compressed imagery is tens of gigapixels; a pixel cap would
    reject the uploads this service exists to take."""
    defaults = {p["name"]: p.get("value") for p in SPEC["arguments"]["parameters"]}
    assert defaults["max-gigapixels"] == "0"


def test_the_fallback_ceiling_fits_the_fallback_workspace():
    """uploader-api computes both per upload; these are the manual-submit
    defaults, and they have to agree the same way."""
    defaults = {p["name"]: p.get("value") for p in SPEC["arguments"]["parameters"]}
    storage = SPEC["volumeClaimTemplates"][0]["spec"]["resources"]["requests"]
    usable = (
        float(storage["storage"].removesuffix("Gi")) * 2**30 * argo.WORKSPACE_USABLE
    )
    input_bytes = float(defaults["max-fetch-bytes"])
    output = float(defaults["max-decoded-gb"]) * 1e9 * argo.COG_TEMP_FACTOR
    assert input_bytes + output <= usable


def test_a_rebuilt_step_image_actually_reaches_the_node():
    """PIPELINE_IMAGE_TAG is mutable, and only `latest` defaults to Always."""
    for name, step in STEPS.items():
        container = step["container"]
        if "{{workflow.parameters.image-tag}}" not in container["image"]:
            continue
        assert container.get("imagePullPolicy") == "Always", name


# Rejected bytes must not outlive the workflow that rejected them.


def test_a_rejected_upload_is_purged_whatever_the_reason():
    """An unmapped validation failure must not leave the object in a
    world-readable bucket, at a URL the uploader already has."""
    task = TASKS["cleanup-on-failure"]
    assert task["depends"] == "validate.Failed"
    assert "when" not in task


def test_a_failed_fetch_is_purged_too():
    task = TASKS["cleanup-on-fetch-failure"]
    assert task["depends"] == "fetch.Failed"
    # No status report: the fetch step has already sent a specific one.
    assert "curl" not in yaml.dump(TEMPLATES[task["template"]])


def test_cleanup_deletes_only_this_upload():
    """The prefix carries the upload ID, so siblings are out of reach."""
    args = TEMPLATES["cleanup"]["container"]["args"][0]
    assert "s3 rm {{workflow.parameters.s3-path}} --recursive" in args


def test_every_validation_exit_code_has_a_message():
    """Including the one for a file that is not a GeoTIFF."""
    args = TEMPLATES["cleanup"]["container"]["args"][0]
    for code in ("5", "6", "7", "8", "75"):
        assert f'[ "$CODE" = "{code}" ]' in args


def test_a_missing_input_is_not_reported_as_a_bad_file():
    """Exit 75 means the imagery never reached the pod, which is our fault."""
    args = TEMPLATES["cleanup"]["container"]["args"][0]
    message = re.search(r'\[ "\$CODE" = "75" \] && MSG="([^"]+)"', args)
    assert message, "no message mapped for exit 75"
    assert "GeoTIFF" not in message.group(1)


# The bug this template shape exists to avoid: two pods on one workspace.


def test_no_step_combines_a_lifecycle_hook_with_a_retry():
    """The hook becomes a child of the retry node, which then completes early."""
    for template in SPEC["templates"]:
        for task in _dag_tasks(template):
            if not task.get("hooks"):
                continue
            assert "retryStrategy" not in TEMPLATES[task["template"]], task["name"]


def test_every_step_that_writes_the_workspace_announces_itself_by_a_sibling():
    """Sharing the step's `depends` runs it when a running hook would have."""
    for step, report in (
        ("fetch", "report-fetching"),
        ("validate", "report-validating"),
        ("convert", "report-converting"),
        ("upload-cog", "report-uploading"),
        ("register", "report-registering"),
    ):
        assert TASKS[report].get("depends") == TASKS[step].get("depends"), report


def test_a_dropped_status_message_does_not_fail_the_upload():
    """`continueOn` is not allowed beside `depends`, so it has to exit 0."""
    args = TEMPLATES["report-status"]["container"]["args"][0]
    assert "--retry" in args
    assert "|| echo" in args, "a failed report must not exit non-zero"


def test_a_report_pod_that_never_ran_is_retried():
    """Eviction and a failed image pull happen before the shell does."""
    retry = TEMPLATES["report-status"]["retryStrategy"]
    assert retry["retryPolicy"] == "Always"
    assert int(retry["limit"]) >= 1


def test_progress_is_reported_by_tasks_argo_will_accept():
    """`continueOn` alongside `depends` is a lint error, not a no-op."""
    for name, task in TASKS.items():
        assert not (task.get("continueOn") and task.get("depends")), name


def test_validate_retries_only_when_the_input_never_arrived():
    """Rejected imagery is rejected identically every time."""
    retry = TEMPLATES["validate-geotiff"]["retryStrategy"]
    assert "asInt(lastRetry.exitCode) == 75" in retry["expression"]


def test_cleanup_prefers_the_reason_validate_wrote():
    """The exit-code map cannot say which limit was hit, or by how much."""
    cleanup = TEMPLATES["cleanup"]["container"]
    args = cleanup["args"][0]
    assert "/data/validation-error.txt" in args
    assert '[ -n "$REASON" ] && MSG="$REASON"' in args
    # Only readable if cleanup mounts the workspace validate wrote it to.
    assert {"name": "workspace", "mountPath": "/data"} in cleanup["volumeMounts"]


def test_a_reason_cannot_break_out_of_the_cleanup_payload():
    """It goes through shell into JSON unescaped; validate.py strips the rest."""
    args = TEMPLATES["cleanup"]["container"]["args"][0]
    assert "tr -d '\\r\\\\\"'" in args


# What the API sends has to be what the template expects.


@pytest.fixture
def submitted(monkeypatch):
    """Capture the Workflow the API would have created."""
    captured = {}

    class _FakeApi:
        def create_namespaced_custom_object(self, **kwargs):
            captured.update(kwargs)
            return {"metadata": {"name": kwargs["body"]["metadata"]["name"]}}

    monkeypatch.setattr(argo, "_api", _FakeApi)

    def _submit(**overrides) -> dict:
        argo.submit_geotiff_workflow(
            **{
                "s3_path": "s3://oam/u-abc/id/",
                "filename": "o.tif",
                "key": "u-abc/id/o.tif",
                "upload_id": "id",
                "user_sub": "sub",
                "callback_token": "token",
                **overrides,
            }
        )
        return captured["body"]["spec"]["arguments"]["parameters"]

    return _submit


def test_the_api_supplies_every_parameter_the_template_requires(submitted):
    """A parameter with no default is one the submission must carry."""
    sent = {p["name"] for p in submitted(remote_source=True)}
    required = {p["name"] for p in SPEC["arguments"]["parameters"] if "value" not in p}
    assert required <= sent, f"missing: {sorted(required - sent)}"
    declared = {p["name"] for p in SPEC["arguments"]["parameters"]}
    assert sent <= declared, f"not in the template: {sorted(sent - declared)}"


@pytest.mark.parametrize(("remote", "expected"), [(True, "url"), (False, "s3")])
def test_a_remote_upload_selects_the_url_branch(submitted, remote, expected):
    """The url branch is the one with an adversary in it; it must be opt-in."""
    parameters = {p["name"]: p["value"] for p in submitted(remote_source=remote)}
    assert parameters["source-type"] == expected


def test_the_s3_secret_matches_the_one_the_chart_expects():
    """The template is applied with kubectl, so nothing else pairs the two."""
    values = yaml.safe_load(
        (Path(__file__).resolve().parent.parent / "chart" / "values.yaml").read_text()
    )["s3Secret"]
    refs = {
        (ref["name"], ref["key"])
        for step in STEPS.values()
        for env in step["container"].get("env", [])
        for ref in [env.get("valueFrom", {}).get("secretKeyRef")]
        if ref
    }
    assert refs == {
        (values["name"], values["accessKeyIdKey"]),
        (values["name"], values["secretAccessKeyKey"]),
    }


# The step-ids in this YAML and UploadStatus are one list; Argo cannot import
# an enum, so this is what keeps them agreeing.


def test_every_status_the_workflow_reports_is_one_the_api_accepts():
    """The API refuses an unknown status, so a typo here is a failed callback."""
    reported = {
        parameter["value"]
        for template in SPEC["templates"]
        for task in _dag_tasks(template)
        for parameter in task.get("arguments", {}).get("parameters", [])
        if parameter["name"] == "step-id"
    }
    reported |= {
        parameter["value"]
        for step in _exit_handler_steps()
        for parameter in step.get("arguments", {}).get("parameters", [])
        if parameter["name"] == "step-id"
    }
    assert reported, "no step-ids found; this test is not looking where it thinks"
    assert reported <= {str(s) for s in UploadStatus}, (
        f"not in UploadStatus: {sorted(reported - {str(s) for s in UploadStatus})}"
    )


def test_the_cleanup_step_reports_a_status_the_api_accepts():
    """Cleanup posts its own payload rather than going through report-status."""
    args = TEMPLATES["cleanup"]["container"]["args"][0]
    posted = set(re.findall(r'"status":\s*"([A-Za-z]+)"', args))
    assert posted
    assert posted <= {str(s) for s in UploadStatus}
