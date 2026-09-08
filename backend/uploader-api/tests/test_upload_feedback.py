"""A click on 'Start upload' must never look like a dead button.

Every way the submit can fail has to say so on the page. The reported symptom
was a page left idle for 15 minutes, then a click that did nothing visible.
"""

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
