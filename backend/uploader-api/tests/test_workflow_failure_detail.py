from app.uploads.argo import _MAX_DETAIL_CHARS, _failure_detail


def _pod(name, phase, message, node_type="Pod"):
    return {
        "displayName": name,
        "phase": phase,
        "message": message,
        "type": node_type,
    }


def test_the_failed_step_is_named_with_its_message():
    detail = _failure_detail(
        {
            "phase": "Failed",
            "message": "child 'geotiff-abc-123' failed",
            "nodes": {
                "a": _pod("fetch", "Succeeded", None),
                "b": _pod("convert", "Failed", "OOMKilled"),
            },
        }
    )
    assert detail == "convert: OOMKilled"


def test_every_failed_step_is_reported():
    detail = _failure_detail(
        {
            "phase": "Failed",
            "nodes": {
                "a": _pod("upload-cog", "Failed", "exit code 1"),
                "b": _pod("upload-meta", "Error", "pod deleted"),
            },
        }
    )
    assert detail == "upload-cog: exit code 1; upload-meta: pod deleted"


def test_a_dag_parent_is_not_mistaken_for_a_reason():
    detail = _failure_detail(
        {
            "phase": "Failed",
            "nodes": {
                "a": {
                    "displayName": "entry",
                    "phase": "Failed",
                    "message": "child 'x' failed",
                    "type": "DAG",
                }
            },
        }
    )
    assert detail is None


def test_the_workflow_message_is_the_fallback():
    detail = _failure_detail(
        {"phase": "Failed", "message": "Stopped with strategy 'Terminate'"}
    )
    assert detail == "Stopped with strategy 'Terminate'"


def test_a_running_workflow_reports_nothing():
    detail = _failure_detail(
        {
            "phase": "Running",
            "message": "Waiting for the workspace volume",
            "nodes": {"a": _pod("fetch", "Running", None)},
        }
    )
    assert detail is None


def test_a_running_workflow_still_reports_a_step_that_died():
    detail = _failure_detail(
        {
            "phase": "Running",
            "nodes": {"a": _pod("validate", "Failed", "not georeferenced")},
        }
    )
    assert detail == "validate: not georeferenced"


def test_a_long_reason_is_cut_to_something_showable():
    detail = _failure_detail(
        {"phase": "Failed", "nodes": {"a": _pod("convert", "Failed", "x" * 5000)}}
    )
    assert len(detail) <= _MAX_DETAIL_CHARS
    assert detail.endswith("…")


def test_no_status_at_all_reports_nothing():
    assert _failure_detail({}) is None
