"""Tests for production configuration checks."""

import pytest
from pydantic import ValidationError

from app.config import AuthProvider, Settings

_REAL_SECRET = "a-real-32-character-cookie-secret!"


def test_production_rejects_disabled_auth():
    with pytest.raises(ValidationError):
        Settings(
            ENVIRONMENT="production",
            AUTH_PROVIDER="disabled",
            COOKIE_SECRET=_REAL_SECRET,
        )


def test_production_rejects_default_cookie_secret():
    with pytest.raises(ValidationError):
        Settings(ENVIRONMENT="production", AUTH_PROVIDER="hotosm")


def test_production_accepts_real_config():
    s = Settings(
        ENVIRONMENT="production",
        AUTH_PROVIDER="hotosm",
        COOKIE_SECRET=_REAL_SECRET,
    )
    assert s.AUTH_PROVIDER is AuthProvider.HOTOSM


def test_development_allows_insecure_defaults():
    s = Settings(ENVIRONMENT="development")
    assert s.AUTH_PROVIDER is AuthProvider.DISABLED
