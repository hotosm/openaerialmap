"""Upload progress and error feedback tests."""

import re
from pathlib import Path

APP = Path(__file__).resolve().parent.parent / "app"
UPLOAD = (APP / "templates" / "upload.html").read_text()
UPLOADER_JS = (APP / "static" / "js" / "uploader.js").read_text()


def test_the_source_inputs_do_not_rely_on_native_required():
    """A failed native check blocks submit here without rendering a message.

    The submit control is a custom element, so the browser has nowhere to anchor
    its bubble. Submit validates these two in JS instead, where it can report.
    """
    file_input = re.search(r"<input type=\"file\"[^>]*>", UPLOAD)
    assert file_input and "required" not in file_input[0]
    assert ".required =" not in UPLOADER_JS


def test_an_empty_file_picker_is_reported():
    """A discarded tab restores every field except the file it cannot reattach."""
    assert not re.search(r"if \(!remoteMode && !file\) return;", UPLOADER_JS)
    assert "Choose a GeoTIFF to upload" in UPLOADER_JS


def test_an_expired_session_says_so():
    """The page only renders the form for a signed-in user, so a 401 is expiry."""
    assert "resp.status === 401" in UPLOADER_JS
    assert "Your session has expired" in UPLOADER_JS


def test_a_dead_request_cannot_hang_the_bar():
    """Without a timeout the progress bar spins on an idle network forever."""
    assert "signal: AbortSignal.timeout(REQUEST_TIMEOUT)" in UPLOADER_JS
    assert "Could not reach the server" in UPLOADER_JS


def test_an_anonymous_upload_is_told_where_to_watch():
    """Point anonymous uploaders to their status list."""
    assert "'Anonymous uploads'" in UPLOADER_JS
    assert 'id="anon-uploads"' in UPLOAD


def test_both_ingest_paths_keep_the_id_they_just_created():
    """Retain tracking IDs for both ingest paths."""
    assert "rememberAnonymous(result.upload_id)" in UPLOADER_JS
    assert "rememberAnonymous(created.id)" in UPLOADER_JS
    assert "localStorage.setItem(ANON_STORE" in UPLOADER_JS


def test_the_file_path_is_tracked_before_any_bytes_move():
    """Track multipart uploads before transferring bytes."""
    body = UPLOADER_JS.split("async function uploadFile")[1]
    assert body.index("rememberAnonymous(") < body.index("for (let n = 1;")


def test_the_ids_outlive_a_storage_failure_for_this_page():
    """Retain IDs in memory when persistent storage fails."""
    remember = UPLOADER_JS.split("function rememberAnonymous")[1].split("\n}")[0]
    assert remember.index("anonIds = [") < remember.index("localStorage.setItem")


def test_the_tracker_polls_only_while_something_can_change():
    """Stop polling after every upload reaches a terminal state."""
    assert 'dataset.pending === "true"' in UPLOADER_JS
    wrapper = APP / "templates" / "partials" / "anonymous_uploads.html"
    assert "data-pending" in wrapper.read_text()


def test_the_outcome_survives_a_reload_and_a_lapsed_session():
    """Restore tracking without requiring an active login."""
    listener = UPLOADER_JS.split('document.addEventListener("DOMContentLoaded"')[1]
    assert listener.index("refreshAnonymous();") < listener.index("if (!form) return;")
    before = UPLOAD[: UPLOAD.index('<section id="anon-uploads"')]
    assert before.count("{% if") == before.count("{% endif %}")


def test_a_transient_part_failure_does_not_lose_the_upload():
    """A 5xx mid-upload cost the whole run; a 100 MiB part is too dear for that."""
    body = UPLOADER_JS.split("async function uploadPart")[1].split("\n}")[0]
    assert body.count("/api/v1/s3/signedurl") == 1
    assert "await sleep(RETRY_DELAY_MS)" in body
    # One retry, so exactly two sends: the first and the one after the backoff.
    assert body.count("send()") == 2


def test_only_a_failure_that_could_land_next_time_is_retried():
    """Cancellation and a malformed request must fail at once, not twice."""
    load = UPLOADER_JS.split('xhr.addEventListener("load"')[1].split("});")[0]
    assert "xhr.status === 403" in load
    assert "xhr.status >= 500" in load
    assert 'partError("Upload cancelled", false)' in UPLOADER_JS
    assert 'partError("Network error while uploading", true)' in UPLOADER_JS
