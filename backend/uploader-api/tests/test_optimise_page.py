"""Only the optimiser gets cross-origin isolation headers."""

from pathlib import Path

from litestar.plugins.jinja import JinjaTemplateEngine
from litestar.static_files import create_static_files_router
from litestar.template.config import TemplateConfig
from litestar.testing import create_test_client

import app
from app.htmx import page_routes
from app.main import _configure_templates


def _client(tmp_path: Path):
    (tmp_path / "oam-optimiser.js").write_text("// built bundle")
    return create_test_client(
        route_handlers=[
            page_routes.optimise_page,
            create_static_files_router(
                path="/optimiser",
                directories=[tmp_path],
                after_request=page_routes._isolate,
            ),
        ],
        template_config=TemplateConfig(
            directory=Path(app.__file__).parent / "templates",
            engine=JinjaTemplateEngine,
            engine_callback=_configure_templates,
        ),
    )


def _isolated(headers) -> bool:
    return all(headers.get(k) == v for k, v in page_routes.ISOLATION_HEADERS.items())


def test_the_page_and_its_bundle_are_cross_origin_isolated(tmp_path):
    with _client(tmp_path) as client:
        page = client.get("/optimise")
        bundle = client.get("/optimiser/oam-optimiser.js")
    assert page.status_code == 200
    assert "optimise.js" in page.text
    assert _isolated(page.headers)
    assert bundle.status_code == 200
    assert _isolated(bundle.headers)


def test_the_upload_page_is_not_isolated():
    """The headers can block CDN files, so the upload page must not get them."""
    assert page_routes.upload_page.after_request is None
