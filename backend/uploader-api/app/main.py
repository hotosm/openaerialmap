"""OAM uploader API and HTMX UI."""

import html
import logging
from pathlib import Path

from litestar import Litestar, Request, Response, Router, get
from litestar import status_codes as status
from litestar.config.cors import CORSConfig
from litestar.contrib.jinja import JinjaTemplateEngine
from litestar.di import Provide
from litestar.exceptions import HTTPException
from litestar.logging import LoggingConfig
from litestar.openapi import OpenAPIConfig
from litestar.plugins.htmx import HTMXPlugin
from litestar.response import Redirect
from litestar.static_files import create_static_files_router
from litestar.template.config import TemplateConfig
from psycopg import AsyncConnection

from app.__version__ import __version__
from app.auth.auth_deps import setup_auth
from app.config import AuthProvider, MonitoringTypes, settings
from app.db.database import (
    close_db_connection_pool,
    db_conn,
    get_db_connection_pool,
)
from app.htmx.page_routes import page_router
from app.monitoring import (
    add_endpoint_profiler,
    get_otel_plugin,
    set_otel_logger,
    set_otel_tracer,
    set_sentry_otel_tracer,
)
from app.uploads.upload_routes import upload_router

log = logging.getLogger(__name__)

STATIC_DIR = Path(__file__).parent / "static"
TEMPLATE_DIR = Path(__file__).parent / "templates"

_HEALTHCHECK_PATHS = ("/__lbheartbeat__", "/__heartbeat__")


class _HealthCheckAccessFilter(logging.Filter):
    """Hide successful health-check access logs.

    Uvicorn stores the path at ``record.args[2]``. Failures remain visible.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        args = record.args
        if isinstance(args, tuple) and len(args) >= 5:
            path, status_code = str(args[2]), args[4]
            if path in _HEALTHCHECK_PATHS and str(status_code).startswith(("2", "3")):
                return False
        return True


def _silence_healthcheck_logs() -> None:
    """Attach the healthcheck filter to uvicorn's access logger."""
    logging.getLogger("uvicorn.access").addFilter(_HealthCheckAccessFilter())


def _htmx_exception_handler(request: Request, exc: Exception) -> Response:
    """Return a swappable <wa-callout> for htmx requests; JSON otherwise."""
    if isinstance(exc, HTTPException):
        status_code = exc.status_code
        detail = str(exc.detail) if exc.detail else "Request failed."
    else:
        status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        detail = "An unexpected error occurred."
    if status_code >= status.HTTP_500_INTERNAL_SERVER_ERROR:
        log.exception(f"Server error: {exc}")

    if request.headers.get("HX-Request") == "true":
        return Response(
            content=(
                f'<wa-callout variant="danger"><span>{html.escape(detail)}'
                "</span></wa-callout>"
            ),
            media_type="text/html",
            status_code=status_code,
            headers={"Vary": "HX-Request"},
        )
    return Response(
        content={"detail": detail},
        status_code=status_code,
        media_type="application/json",
    )


def _configure_templates(engine: JinjaTemplateEngine) -> None:
    """Expose shared auth settings to templates.

    The auth component handles login; templates only need its URLs.
    """
    engine.engine.globals.update(
        app_name=settings.APP_NAME,
        auth_enabled=settings.AUTH_PROVIDER != AuthProvider.DISABLED,
        hanko_public_url=settings.HANKO_PUBLIC_URL or settings.HANKO_API_URL or "",
        frontend_url=settings.frontend_url,
        main_site_url=settings.OAM_FRONTEND_URL.rstrip("/"),
    )


def _root_router() -> Router:
    @get("/__heartbeat__", dependencies={"db": Provide(db_conn)})
    async def heartbeat(db: AsyncConnection) -> dict:
        """Liveness + DB connectivity check."""
        async with db.cursor() as cur:
            await cur.execute("SELECT 1;")
        return {"status": "ok"}

    @get("/__lbheartbeat__", sync_to_thread=False)
    def lb_heartbeat() -> dict:
        """Liveness check (no dependencies)."""
        return {"status": "ok"}

    @get("/__version__", sync_to_thread=False)
    def version() -> dict:
        """Deployment metadata."""
        return {"version": __version__, "app": settings.APP_NAME}

    @get("/favicon.ico", sync_to_thread=False, include_in_schema=False)
    def favicon() -> Redirect:
        """Redirect browser favicon probes to the SVG.

        Browsers request this path even when templates declare another icon.
        """
        return Redirect(path="/static/openaerialmap.svg")

    return Router(
        path="/",
        tags=["root"],
        route_handlers=[heartbeat, lb_heartbeat, version, favicon],
    )


def _get_logging_config() -> LoggingConfig:
    """Configure server logging."""
    # Keep verbose Sentry transport logs at warning level.
    quiet_loggers = ("urllib3", "urllib3.connectionpool", "sentry_sdk")
    return LoggingConfig(
        root={"level": settings.LOG_LEVEL, "handlers": ["queue_listener"]},
        formatters={
            "standard": {
                "format": "%(asctime)s.%(msecs)03d | %(levelname)-8s | "
                "%(name)s:%(funcName)s:%(lineno)d | %(message)s",
                "datefmt": "%Y-%m-%d %H:%M:%S",
            }
        },
        loggers={
            name: {
                "level": "WARNING",
                "handlers": ["queue_listener"],
                "propagate": False,
            }
            for name in quiet_loggers
        },
        log_exceptions="always",
        # Avoid stack traces for routine 404 and 405 responses.
        disable_stack_trace={
            status.HTTP_404_NOT_FOUND,
            status.HTTP_405_METHOD_NOT_ALLOWED,
        },
    )


def _ensure_s3_lifecycle() -> None:
    """Set the S3 abort-incomplete-multipart rule at startup (best-effort)."""
    from app.uploads.s3 import ensure_bucket_lifecycle

    ensure_bucket_lifecycle()


def create_app() -> Litestar:
    """Build and configure the Litestar app."""
    _silence_healthcheck_logs()

    route_handlers: list = [
        _root_router(),
        page_router,
        upload_router,
        create_static_files_router(path="/static", directories=[STATIC_DIR]),
    ]

    if settings.AUTH_PROVIDER != AuthProvider.DISABLED and setup_auth is not None:
        deps, auth_route_handlers = setup_auth()
        route_handlers.insert(
            0, Router(path="/", route_handlers=auth_route_handlers, dependencies=deps)
        )

    plugins: list = [HTMXPlugin()]
    if settings.MONITORING == MonitoringTypes.SENTRY:
        log.info("Adding Sentry OpenTelemetry monitoring config")
        set_sentry_otel_tracer(settings.monitoring_config.SENTRY_DSN)
        plugins.append(get_otel_plugin())
    elif settings.MONITORING == MonitoringTypes.OPENOBSERVE:
        log.info("Adding OpenObserve OpenTelemetry monitoring config")
        plugins.append(get_otel_plugin())

    app = Litestar(
        route_handlers=route_handlers,
        plugins=plugins,
        on_startup=[get_db_connection_pool, _ensure_s3_lifecycle],
        on_shutdown=[close_db_connection_pool],
        cors_config=CORSConfig(
            allow_origins=[settings.frontend_url, *settings.EXTRA_CORS_ORIGINS],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        ),
        template_config=TemplateConfig(
            directory=TEMPLATE_DIR,
            engine=JinjaTemplateEngine,
            engine_callback=_configure_templates,
        ),
        openapi_config=OpenAPIConfig(title=settings.APP_NAME, version=__version__),
        logging_config=_get_logging_config(),
        exception_handlers={
            HTTPException: _htmx_exception_handler,
            Exception: _htmx_exception_handler,
        },
        debug=settings.DEBUG,
    )

    # In debug mode, add ?profile=1 to profile a request.
    if settings.DEBUG:
        add_endpoint_profiler(app)

    if settings.MONITORING == MonitoringTypes.OPENOBSERVE:
        otel_endpoint = settings.monitoring_config.otel_exporter_otpl_endpoint
        set_otel_tracer(app, otel_endpoint)
        set_otel_logger(otel_endpoint)

    return app


app = create_app()
