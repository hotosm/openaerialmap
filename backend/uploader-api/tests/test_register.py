"""The register pipeline's HTTP request configuration."""

import importlib
import json
import os
import sys

import pytest


@pytest.fixture
def register_module(monkeypatch):
    register_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)), "pipeline", "register"
    )
    sys.modules.pop("register", None)
    monkeypatch.syspath_prepend(register_path)
    module = importlib.import_module("register")
    yield module
    sys.modules.pop("register", None)


class FakeResponse:
    status = 200

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def test_register_uses_a_60_second_http_timeout(register_module, monkeypatch, tmp_path):
    item_path = tmp_path / "item.json"
    item_path.write_text(json.dumps({"id": "item-1"}))
    calls = []

    def fake_urlopen(request, **kwargs):
        calls.append((request, kwargs))
        return FakeResponse()

    monkeypatch.setenv("FRONT_URL", "https://api.example.org")
    monkeypatch.setattr(register_module.urllib.request, "urlopen", fake_urlopen)

    register_module.register(str(item_path))

    assert len(calls) == 1
    assert calls[0][1]["timeout"] == 60
