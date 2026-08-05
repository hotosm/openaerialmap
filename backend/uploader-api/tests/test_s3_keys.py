"""Tests for upload S3 keys."""

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
    assert p and p == key_owner_prefix("hotosm|42")


def test_distinct_subjects_do_not_collide():
    assert key_owner_prefix("hotosm|42") != key_owner_prefix("hotosm-42")
