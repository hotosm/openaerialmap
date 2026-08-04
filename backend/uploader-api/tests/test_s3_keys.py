"""Tests for the upload-id S3 key scheme (blocker #1)."""

from app.uploads.s3 import (
    build_key,
    key_owner_prefix,
    safe_filename,
    upload_id_from_key,
)


def test_key_roundtrips_the_upload_id():
    key = build_key("hotosm|42", "abc-123", "ortho.tif")
    assert upload_id_from_key(key) == "abc-123"


def test_same_title_and_filename_do_not_collide():
    # Different upload ids -> distinct keys even for an identical filename,
    # so two uploads can never overwrite each other's objects.
    k1 = build_key("u", "id1", "ortho.tif")
    k2 = build_key("u", "id2", "ortho.tif")
    assert k1 != k2
    assert upload_id_from_key(k1) == "id1"
    assert upload_id_from_key(k2) == "id2"


def test_safe_filename_strips_shell_and_path_chars():
    fn = safe_filename("../a b; rm -rf /.tif")
    assert "/" not in fn
    assert " " not in fn
    assert ";" not in fn
    assert fn.endswith(".tif")


def test_key_owner_prefix_is_stable_and_nonempty():
    p = key_owner_prefix("hotosm|42")
    assert p and p == key_owner_prefix("hotosm|42")  # deterministic


def test_distinct_subjects_do_not_collide():
    # Lossy-slug collisions (e.g. "hotosm|42" vs "hotosm-42") must not map to the
    # same prefix, or one user could reach another's uploads.
    assert key_owner_prefix("hotosm|42") != key_owner_prefix("hotosm-42")
