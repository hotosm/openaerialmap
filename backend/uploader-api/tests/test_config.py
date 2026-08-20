"""What ENVIRONMENT=production refuses to start with.

The defaults are the development ones, so this guard is what stops a
half-configured deployment from being a public, writable service.
"""

import pytest
from pydantic import ValidationError

from app.auth import auth_deps
from app.config import AuthProvider, Environment, Settings
from app.main import create_app

PROD = {
    "ENVIRONMENT": Environment.PRODUCTION,
    "AUTH_PROVIDER": AuthProvider.HOTOSM,
    "COOKIE_SECRET": "x" * 32,
    "DEBUG": False,
    "FETCH_ALLOW_PRIVATE_HOSTS": False,
}


def _settings(**overrides) -> Settings:
    return Settings(**{**PROD, **overrides})


def test_a_real_production_config_starts():
    assert _settings().AUTH_PROVIDER is AuthProvider.HOTOSM


def test_debug_disables_authentication(monkeypatch):
    """Why DEBUG belongs in the guard rather than being a logging switch."""
    monkeypatch.setattr(auth_deps.settings, "AUTH_PROVIDER", AuthProvider.HOTOSM)
    monkeypatch.setattr(auth_deps.settings, "DEBUG", True)
    assert auth_deps._auth_disabled()


@pytest.mark.parametrize(
    ("overrides", "expected"),
    [
        ({"DEBUG": True}, "DEBUG is on"),
        ({"AUTH_PROVIDER": AuthProvider.DISABLED}, "AUTH_PROVIDER is 'disabled'"),
        ({"COOKIE_SECRET": "change-me-32-characters-long-xxx"}, "COOKIE_SECRET"),
        ({"FETCH_ALLOW_PRIVATE_HOSTS": True}, "FETCH_ALLOW_PRIVATE_HOSTS"),
    ],
)
def test_production_refuses_an_open_config(overrides, expected):
    with pytest.raises(ValidationError) as err:
        _settings(**overrides)
    assert expected in str(err.value)


def test_it_reports_every_problem_at_once():
    """One restart per misconfiguration is a bad way to find them all."""
    with pytest.raises(ValidationError) as err:
        _settings(
            DEBUG=True,
            AUTH_PROVIDER=AuthProvider.DISABLED,
            FETCH_ALLOW_PRIVATE_HOSTS=True,
        )
    message = str(err.value)
    assert all(
        key in message
        for key in ("DEBUG", "AUTH_PROVIDER", "FETCH_ALLOW_PRIVATE_HOSTS")
    )


# Plausible values that are not the two we accept. Deliberately not a
# misspelling: codespell is in pre-commit and would quietly correct one.
@pytest.mark.parametrize("value", ["staging", "prod", "PRODUCTION", ""])
def test_an_unrecognised_environment_refuses_to_boot(value):
    """A wrong value has to fail, not quietly pick one side or the other."""
    with pytest.raises(ValidationError):
        _settings(ENVIRONMENT=value)


def test_development_keeps_its_defaults():
    assert _settings(
        ENVIRONMENT=Environment.DEVELOPMENT,
        AUTH_PROVIDER=AuthProvider.DISABLED,
        DEBUG=True,
        FETCH_ALLOW_PRIVATE_HOSTS=True,
    ).DEBUG


def test_the_app_refuses_to_be_framed():
    """The upload page holds a presigned source URL in a form field."""
    headers = {h.name: h.value for h in create_app().response_headers}
    assert headers["Content-Security-Policy"] == "frame-ancestors 'none'"
    assert headers["X-Frame-Options"] == "DENY"
    assert headers["Referrer-Policy"] == "no-referrer"
