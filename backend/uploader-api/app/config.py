"""Application configuration via environment variables (pydantic-settings)."""

import os
from enum import Enum
from functools import lru_cache
from typing import Optional

from psycopg.conninfo import make_conninfo
from pydantic import (
    Field,
    SecretStr,
    ValidationInfo,
    computed_field,
    field_validator,
    model_validator,
)
from pydantic_settings import BaseSettings, SettingsConfigDict


class AuthProvider(str, Enum):
    """Authentication providers."""

    DISABLED = "disabled"
    HOTOSM = "hotosm"
    BUNDLED = "bundled"
    CUSTOM = "custom"


_PLACEHOLDER_COOKIE_SECRET = "change-me-32-characters-long-xxx"


class Environment(str, Enum):
    """Deployment environments. Anything else refuses to boot, see Settings."""

    DEVELOPMENT = "development"
    PRODUCTION = "production"


class MonitoringTypes(str, Enum):
    """Monitoring backends."""

    NONE = ""
    SENTRY = "sentry"
    OPENOBSERVE = "openobserve"


_OTEL_EXCLUDED_URLS = (
    "__heartbeat__,__lbheartbeat__,__version__,favicon.ico,schema,^/static/.*"
)


class OtelSettings(BaseSettings):
    """Shared OpenTelemetry settings; exports the env vars the OTEL SDK reads."""

    OAM_UPLOAD_DOMAIN: str | None = Field(default=None, exclude=True)
    LOG_LEVEL: str | None = Field(default=None, exclude=True)

    @computed_field
    @property
    def otel_log_level(self) -> str:
        """Set the OpenTelemetry log level (kept at info to avoid DEBUG spam)."""
        os.environ["OTEL_LOG_LEVEL"] = "info"
        return "info"

    @computed_field
    @property
    def otel_service_name(self) -> str:
        """Set the OpenTelemetry service name for traces."""
        service_name = "unknown"
        if self.OAM_UPLOAD_DOMAIN:
            service_name = self.OAM_UPLOAD_DOMAIN.replace(".", "_")
            os.environ["OTEL_SERVICE_NAME"] = service_name
        return service_name

    @computed_field
    @property
    def otel_python_excluded_urls(self) -> str:
        """Exclude health-check pings + noise from instrumentation."""
        os.environ["OTEL_PYTHON_EXCLUDED_URLS"] = _OTEL_EXCLUDED_URLS
        return _OTEL_EXCLUDED_URLS

    @computed_field
    @property
    def otel_python_log_correlation(self) -> str:
        """Enable trace/log correlation for OpenTelemetry Python spans."""
        os.environ["OTEL_PYTHON_LOG_CORRELATION"] = "true"
        return "true"


class SentrySettings(OtelSettings):
    """Sentry-specific OpenTelemetry settings."""

    SENTRY_DSN: str


class OpenObserveSettings(OtelSettings):
    """OTLP collector (OpenObserve) specific settings."""

    OTEL_ENDPOINT: str = Field(exclude=True)
    OTEL_AUTH_TOKEN: SecretStr | None = Field(default=None, exclude=True)

    @computed_field
    @property
    def otel_exporter_otpl_endpoint(self) -> str:
        """Set the OTLP exporter endpoint."""
        os.environ["OTEL_EXPORTER_OTLP_ENDPOINT"] = str(self.OTEL_ENDPOINT)
        return self.OTEL_ENDPOINT

    @computed_field
    @property
    def otel_exporter_otlp_headers(self) -> str | None:
        """Set the OTLP exporter auth header (URL-encoded: space=%20)."""
        if not self.OTEL_AUTH_TOKEN:
            return None
        auth_header = f"Authorization=Basic%20{self.OTEL_AUTH_TOKEN.get_secret_value()}"
        os.environ["OTEL_EXPORTER_OTLP_HEADERS"] = auth_header
        return auth_header


class Settings(BaseSettings):
    """Main settings, loaded from environment / .env."""

    model_config = SettingsConfigDict(
        case_sensitive=True, env_file=".env", extra="allow"
    )

    APP_NAME: str = "OAM Uploader"
    OAM_UPLOAD_DOMAIN: str = "upload.imagery.hotosm.org"
    OAM_UPLOAD_DEV_PORT: str | None = None
    OAM_FRONTEND_URL: str = "https://imagery.hotosm.org"
    OAM_API_URL: str = "https://api.imagery.hotosm.org"
    # Offered wherever an upload fails. The form needs no Slack account, so a
    # contributor outside the HOT community can still reach us (issue #307).
    SUPPORT_URL: str = "https://roadmap.hotosm.org/#tech-request"
    SUPPORT_SLACK_URL: str = "https://slack.hotosm.org"
    DEBUG: bool = False
    ENVIRONMENT: Environment = Environment.DEVELOPMENT
    LOG_LEVEL: str = "INFO"

    EXTRA_CORS_ORIGINS: list[str] = Field(default_factory=list)

    # Dedicated uploader database, separate from the pgstac catalog.
    DB_HOST: str = "uploader-db"
    DB_PORT: int = 5432
    DB_USER: str = "oam"
    DB_PASSWORD: SecretStr = SecretStr("oam")
    DB_NAME: str = "oam_uploader"
    DB_URL: str | None = None

    @field_validator("DB_URL", mode="before")
    @classmethod
    def assemble_db_url(cls, v: str | None, info: ValidationInfo) -> str:
        """Build a psycopg connection string from parts if not given directly."""
        if v and isinstance(v, str):
            return v
        password = info.data.get("DB_PASSWORD")
        # make_conninfo safely quotes special characters in passwords.
        return make_conninfo(
            host=info.data.get("DB_HOST"),
            port=info.data.get("DB_PORT"),
            user=info.data.get("DB_USER"),
            password=password.get_secret_value() if password else None,
            dbname=info.data.get("DB_NAME"),
        )

    # Registration writes directly to pgstac because its transactions API is off.
    PGSTAC_DB_HOST: str = "database"
    PGSTAC_DB_PORT: int = 5432
    PGSTAC_DB_USER: str = "oam"
    PGSTAC_DB_PASSWORD: SecretStr = SecretStr("password")
    PGSTAC_DB_NAME: str = "postgis"
    PGSTAC_DB_URL: str | None = None

    @field_validator("PGSTAC_DB_URL", mode="before")
    @classmethod
    def assemble_pgstac_db_url(cls, v: str | None, info: ValidationInfo) -> str:
        """Build the pgstac connection string from parts if not given directly."""
        if v and isinstance(v, str):
            return v
        password = info.data.get("PGSTAC_DB_PASSWORD")
        return make_conninfo(
            host=info.data.get("PGSTAC_DB_HOST"),
            port=info.data.get("PGSTAC_DB_PORT"),
            user=info.data.get("PGSTAC_DB_USER"),
            password=password.get_secret_value() if password else None,
            dbname=info.data.get("PGSTAC_DB_NAME"),
        )

    # The API and browser may need different S3 endpoints.
    S3_ENDPOINT: str | None = None
    S3_EXTERNAL_ENDPOINT: str | None = None
    # This can point catalog assets at a CDN instead of the upload endpoint.
    PUBLIC_ASSET_BASE_URL: str | None = None
    S3_BUCKET: str = "oam"
    S3_REGION: str = "us-east-1"
    AWS_ACCESS_KEY_ID: str | None = None
    AWS_SECRET_ACCESS_KEY: SecretStr | None = None

    # Local setups can store uploads without running an Argo workflow.
    ARGO_ENABLED: bool = True
    ARGO_NAMESPACE: str = "oam"
    ARGO_WORKFLOW_TEMPLATE: str = "geotiff-processing-template"
    # Production should use an immutable image tag.
    PIPELINE_IMAGE_TAG: str = "latest"
    WF_CALLBACK_URL: str = "http://uploader-api.oam.svc.cluster.local:8080"

    # A workflow's final callback is one best-effort message, so the reconciler
    # asks Argo directly about uploads that have gone quiet.
    RECONCILE_ENABLED: bool = True
    RECONCILE_INTERVAL_SECONDS: int = 60
    # Reconcile before Argo's 24-hour failure TTL loses the failure detail.
    RECONCILE_QUIET_MINUTES: int = 5
    # Backstop for an upload Argo can tell us nothing about, matching the window
    # `count_active` already stops counting a stuck upload against the quota.
    RECONCILE_MAX_AGE_HOURS: int = 24

    STAC_URL: str = "http://stac-api:8082"
    STAC_COLLECTION: str = "openaerialmap"
    STAC_BROWSER_URL: str = ""
    # Strict checks fetch remote extension schemas.
    STAC_STRICT_EXTENSIONS: bool = False

    MAX_UPLOAD_BYTES: int = 100 * 1024**3  # 100 GiB
    MAX_ACTIVE_UPLOADS_PER_USER: int = 5

    # The workspace volume holds the upload, its COG and GDAL's overview temp,
    # so it scales with the upload instead of being provisioned for the largest
    # one allowed. Mirrors ScaleODM's workflow.workspace.dynamicSize.
    # Sized so the decode ratio may reach 10:1, which JPEG-in-TIFF orthos do;
    # overhead eats the rest. The cap holds that up to a 60 GiB upload.
    WORKSPACE_MULTIPLIER: float = 17.0
    WORKSPACE_MIN_GIB: int = 64
    WORKSPACE_MAX_GIB: int = 1024
    # Empty uses the cluster default. It must reclaim on delete, or every run
    # leaves its volume behind - HOTOSM's default `gp3` is Retain.
    WORKSPACE_STORAGE_CLASS: str = ""

    # Only for setups whose object store is in-network (local compose, Talos
    # e2e). Anywhere else this makes remote-source ingest an SSRF primitive.
    FETCH_ALLOW_PRIVATE_HOSTS: bool = False

    AUTH_PROVIDER: AuthProvider = AuthProvider.DISABLED
    HANKO_API_URL: str | None = None
    HANKO_PUBLIC_URL: str | None = None
    LOGIN_URL: str | None = None
    COOKIE_SECRET: SecretStr = SecretStr(_PLACEHOLDER_COOKIE_SECRET)

    MONITORING: MonitoringTypes | None = None

    @computed_field
    @property
    def monitoring_config(self) -> Optional["OpenObserveSettings | SentrySettings"]:
        """Load the backend-specific OTEL settings for the selected MONITORING."""
        if self.MONITORING == MonitoringTypes.SENTRY:
            return SentrySettings()
        if self.MONITORING == MonitoringTypes.OPENOBSERVE:
            return OpenObserveSettings()
        return None

    @computed_field
    @property
    def stac_item_url_base(self) -> str:
        """Base for a STAC Browser deep link to one published item."""
        browser = self.STAC_BROWSER_URL or f"{self.OAM_API_URL.rstrip('/')}/browser"
        return f"{browser.rstrip('/')}/stac/collections/{self.STAC_COLLECTION}/items"

    @computed_field
    @property
    def frontend_url(self) -> str:
        """Public origin of this app (used for redirect-after-login)."""
        if self.OAM_UPLOAD_DEV_PORT:
            return f"http://{self.OAM_UPLOAD_DOMAIN}:{self.OAM_UPLOAD_DEV_PORT}"
        return f"https://{self.OAM_UPLOAD_DOMAIN}"

    @model_validator(mode="after")
    def _fail_closed_in_prod(self) -> "Settings":
        """Refuse to boot a production config that is open or uses dev secrets.

        The defaults are deliberately permissive for local development, so a
        production deployment has to override them.
        """
        if self.ENVIRONMENT is Environment.DEVELOPMENT:
            return self
        problems = []
        if self.AUTH_PROVIDER == AuthProvider.DISABLED:
            problems.append("AUTH_PROVIDER is 'disabled'")
        # auth_deps treats DEBUG as auth-disabled, whatever AUTH_PROVIDER says.
        if self.DEBUG:
            problems.append("DEBUG is on, which disables authentication")
        if self.COOKIE_SECRET.get_secret_value() == _PLACEHOLDER_COOKIE_SECRET:
            problems.append("COOKIE_SECRET is the default placeholder")
        if self.FETCH_ALLOW_PRIVATE_HOSTS:
            problems.append("FETCH_ALLOW_PRIVATE_HOSTS is on")
        if problems:
            raise ValueError(
                "Refusing to start ENVIRONMENT=production with: "
                + "; ".join(problems)
                + ". These are development defaults."
            )
        return self


@lru_cache
def get_settings() -> Settings:
    """Cache settings and export the env vars hotosm-auth reads at startup."""
    _settings = Settings()
    if _settings.HANKO_API_URL:
        os.environ["HANKO_API_URL"] = _settings.HANKO_API_URL
    os.environ["COOKIE_SECRET"] = _settings.COOKIE_SECRET.get_secret_value()
    return _settings


settings = get_settings()
