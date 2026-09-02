"""Every failure offers a way to reach the OAM team (issue #307)."""

from html import escape
from pathlib import Path
from types import SimpleNamespace

import pytest
from jinja2 import Environment, FileSystemLoader
from litestar.exceptions import HTTPException

from app.config import settings
from app.htmx.htmx_helpers import callout, support_html
from app.main import _htmx_exception_handler
from app.monitoring import set_otel_tracer

APP_DIR = Path(__file__).resolve().parents[1] / "app"


class _Request:
    def __init__(self, htmx: bool = True):
        self.headers = {"HX-Request": "true"} if htmx else {}


ITEM_ID = "6a9561bcaa8c0b218b79937a"


def _render_uploads(status: str) -> str:
    env = Environment(loader=FileSystemLoader(APP_DIR / "templates"), autoescape=True)
    env.globals["support_html"] = support_html
    env.globals["item_url_base"] = settings.stac_item_url_base
    upload = {
        "id": ITEM_ID,
        "title": "NTT flight 3",
        "filename": "ortho.tif",
        "status": status,
        "message": "Invalid raster: not georeferenced (no CRS).",
        "warning": None,
        "created_at": None,
    }
    return env.get_template("partials/uploads.html").render(uploads=[upload])


def test_the_form_is_the_first_route_offered():
    """It needs no Slack account, unlike the deep link beside it."""
    html = support_html()
    slack = escape(settings.SUPPORT_SLACK_URL, quote=True)
    assert settings.SUPPORT_URL in html
    assert html.index(settings.SUPPORT_URL) < html.index(slack)


def test_only_failures_carry_the_support_line():
    assert "oam-support" in callout("danger", "Upload failed.")
    assert "oam-support" not in callout("success", "Published to the catalogue.")


def test_server_error_callout_carries_it():
    body = _htmx_exception_handler(_Request(), RuntimeError("boom")).content
    assert isinstance(body, str)
    assert settings.SUPPORT_URL in body


@pytest.mark.asyncio
async def test_the_otel_handler_carries_it_too():
    """MONITORING=openobserve swaps this in for the shared handler."""
    app = SimpleNamespace(exception_handlers={})
    set_otel_tracer(app, "http://otel.invalid")
    handler = app.exception_handlers[HTTPException]
    body = (await handler(_Request(), HTTPException(detail="boom"))).content
    assert settings.SUPPORT_URL in body


@pytest.mark.parametrize("status", ["Failed", "Error"])
def test_failed_upload_rows_carry_it(status):
    assert settings.SUPPORT_URL in _render_uploads(status)


def test_succeeded_upload_rows_do_not():
    assert "oam-support" not in _render_uploads("Succeeded")


def test_a_succeeded_row_links_to_the_published_item():
    """Issue #315: the row is where a user looks for the image's URL."""
    html = _render_uploads("Succeeded")
    assert f'href="{settings.stac_item_url_base}/{ITEM_ID}"' in html
    assert "View the image" in html
    # The status message it replaces told the user nothing they could act on.
    assert "Published to the catalogue" not in html


def test_a_borrowed_browser_is_honoured(monkeypatch):
    monkeypatch.setattr(
        settings, "STAC_BROWSER_URL", "https://api.example.org/browser/"
    )
    assert settings.stac_item_url_base.startswith(
        "https://api.example.org/browser/stac/collections/"
    )


def test_the_browser_reuses_the_served_markup():
    """One source of truth: the URLs are never rebuilt in JavaScript."""
    js = (APP_DIR / "static" / "js" / "uploader.js").read_text()
    assert 'byId("support-line")' in js
    assert "roadmap.hotosm.org" not in js


def test_a_blank_support_url_drops_the_line(monkeypatch):
    monkeypatch.setattr(settings, "SUPPORT_URL", "")
    assert support_html() == ""
    assert "oam-support" not in callout("danger", "Upload failed.")
