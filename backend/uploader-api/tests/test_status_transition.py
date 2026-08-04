"""Tests for the workflow status state machine (blocker #5)."""

from app.db.models import status_transition


def test_forward_transition_applies():
    apply, expire = status_transition("Converting", "Uploading")
    assert apply is True
    assert expire is False


def test_regression_is_ignored():
    # A late/out-of-order hook must not move the status backwards.
    apply, _ = status_transition("Registering", "Downloading")
    assert apply is False


def test_terminal_state_is_frozen():
    # A generic terminal message can't overwrite the first (specific) one.
    apply, _ = status_transition("Failed", "Failed")
    assert apply is False


def test_reaching_terminal_expires_the_token():
    apply, expire = status_transition("Registering", "Succeeded")
    assert apply is True
    assert expire is True


def test_same_status_is_allowed():
    apply, _ = status_transition("Converting", "Converting")
    assert apply is True
