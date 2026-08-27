"""A prefill handoff has to survive an expired session.

A partner sends the user to /#title=...&source_url=..., and a fragment is only
ever readable by the page it lands on. If the login round trip returns to the
bare origin instead of the URL the user arrived at, the entire handoff is gone
and they get a blank uploader with no way back.
"""

import re
from pathlib import Path

TEMPLATES = Path(__file__).resolve().parent.parent / "app" / "templates"
LAYOUT = (TEMPLATES / "layout.html").read_text()
UPLOAD = (TEMPLATES / "upload.html").read_text()
UPLOADER_JS = (
    Path(__file__).resolve().parent.parent / "app" / "static" / "js" / "uploader.js"
).read_text()


def test_login_does_not_pin_a_redirect_target():
    """Unset, hotosm-auth returns to window.location.href, fragment and all.

    Any value here replaces that default and drops everything after the '#'.
    """
    assert "redirect-after-login=" not in LAYOUT


def test_logout_still_lands_on_the_app():
    """The opposite case: after logging out there is no handoff worth keeping."""
    assert 'redirect-after-logout="{{ frontend_url }}"' in LAYOUT


def test_the_form_is_withheld_until_login():
    """So the prefill is not scrubbed from a URL the user still has to return to.

    applyPrefill, which clears the fragment, only runs when the form exists.
    """
    assert re.search(r"{%\s*if auth_enabled and not logged_in\s*%}", UPLOAD)
    assert 'id="upload-form"' in UPLOAD
    assert "if (!form) return;" in UPLOADER_JS
