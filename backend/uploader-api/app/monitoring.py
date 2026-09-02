"""Optional OpenTelemetry configuration.

Dependencies load only when monitoring is enabled. app.config and app.main keep
health checks out of traces and logs.
"""

import logging
from typing import Any

from litestar import Litestar, Request, Response
from litestar.exceptions import HTTPException
from litestar.types import ASGIApp, Receive, Scope, Send

from app.htmx.htmx_helpers import callout

log = logging.getLogger(__name__)


def add_endpoint_profiler(app: Litestar) -> None:
    """Add the debug request profiler.

    ``?profile=1`` replaces the response with a PyInstrument report.
    """
    from urllib.parse import parse_qs

    from pyinstrument import Profiler

    def profiler_middleware(next_app: ASGIApp) -> ASGIApp:
        async def middleware(scope: Scope, receive: Receive, send: Send) -> None:
            if scope["type"] != "http":
                await next_app(scope, receive, send)
                return

            raw_qs = scope.get("query_string", b"").decode()
            params = parse_qs(raw_qs)
            raw_profile = (params.get("profile") or [""])[0].lower()
            if raw_profile not in ("1", "true", "yes"):
                await next_app(scope, receive, send)
                return

            profiler = Profiler(interval=0.001, async_mode="enabled")
            profiler.start()
            status_code = 200

            async def send_wrapper(message: dict[str, Any]) -> None:
                nonlocal status_code
                if message["type"] == "http.response.start":
                    status_code = message.get("status", status_code)
                # Drop the original body - we return the profiler HTML instead.

            await next_app(scope, receive, send_wrapper)
            profiler.stop()

            page = profiler.output_html()
            await send(
                {
                    "type": "http.response.start",
                    "status": status_code,
                    "headers": [(b"content-type", b"text/html; charset=utf-8")],
                }
            )
            await send(
                {
                    "type": "http.response.body",
                    "body": page.encode("utf-8"),
                    "more_body": False,
                }
            )

        return middleware

    app.middleware.append(profiler_middleware)


def set_sentry_otel_tracer(dsn: str) -> None:
    """Configure OpenTelemetry tracing exported to Sentry."""
    from opentelemetry import trace
    from opentelemetry.propagate import set_global_textmap
    from opentelemetry.sdk.trace import TracerProvider
    from sentry_sdk import init
    from sentry_sdk.integrations.opentelemetry import (
        SentryPropagator,
        SentrySpanProcessor,
    )

    init(
        dsn=dsn,
        enable_tracing=True,
        traces_sample_rate=1.0,
        instrumenter="otel",
    )

    provider = TracerProvider()
    provider.add_span_processor(SentrySpanProcessor())
    trace.set_tracer_provider(provider)
    set_global_textmap(SentryPropagator())


def set_otel_tracer(app: Litestar, endpoint: str) -> None:
    """Configure OpenTelemetry tracing exported to an OTLP collector."""
    from opentelemetry import trace
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor

    log.info(f"Adding OpenTelemetry tracing for url: {endpoint}")

    trace.set_tracer_provider(TracerProvider(resource=Resource.create({})))
    span_processor = BatchSpanProcessor(OTLPSpanExporter(endpoint=endpoint))
    trace.get_tracer_provider().add_span_processor(span_processor)

    async def http_exception_handler(request: Request, exc: HTTPException) -> Response:
        """Record the exception on the current span, then render it (htmx-aware)."""
        current_span = trace.get_current_span()
        current_span.set_attributes({"http.status_text": str(exc.detail)})
        current_span.record_exception(exc)

        if request.headers.get("HX-Request") == "true":
            detail = str(exc.detail) if exc.detail else "An unexpected error occurred."
            return Response(
                content=callout("danger", detail),
                media_type="text/html",
                status_code=exc.status_code,
                headers={"Vary": "HX-Request"},
            )
        return Response(
            content={"detail": str(exc.detail)},
            status_code=exc.status_code,
        )

    app.exception_handlers[HTTPException] = http_exception_handler


def set_otel_logger(endpoint: str) -> None:
    """Configure OpenTelemetry logging exported to an OTLP collector."""
    from opentelemetry._logs import set_logger_provider
    from opentelemetry.exporter.otlp.proto.grpc._log_exporter import OTLPLogExporter
    from opentelemetry.instrumentation.logging import LoggingInstrumentor
    from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
    from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
    from opentelemetry.sdk.resources import Resource

    log.info(f"Adding OpenTelemetry logging for url: {endpoint}")

    class FormattedLoggingHandler(LoggingHandler):
        def emit(self, record: logging.LogRecord) -> None:
            # The OTel handler expects the formatted text in record.msg.
            record.msg = self.format(record)
            record.args = None
            super().emit(record)

    logger_provider = LoggerProvider(resource=Resource.create({}))
    set_logger_provider(logger_provider)
    otlp_log_exporter = OTLPLogExporter(endpoint=endpoint)
    logger_provider.add_log_record_processor(BatchLogRecordProcessor(otlp_log_exporter))

    otel_log_handler = FormattedLoggingHandler(logger_provider=logger_provider)

    # Instrument first so basicConfig reads OTEL_PYTHON_LOG_FORMAT.
    LoggingInstrumentor().instrument()
    log_formatter = logging.Formatter(
        "%(asctime)s.%(msecs)03d [%(levelname)s] %(name)s | "
        "%(funcName)s:%(lineno)d | %(message)s",
        None,
    )
    otel_log_handler.setFormatter(log_formatter)
    logging.getLogger().addHandler(otel_log_handler)


def get_otel_plugin() -> Any:
    """Build the OpenTelemetry Litestar plugin.

    ``OTEL_PYTHON_EXCLUDED_URLS`` keeps health checks out of traces.
    """
    from litestar.contrib.opentelemetry import OpenTelemetryConfig, OpenTelemetryPlugin

    return OpenTelemetryPlugin(OpenTelemetryConfig())
