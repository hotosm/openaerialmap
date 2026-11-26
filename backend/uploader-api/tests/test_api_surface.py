"""Which routes exist, and which of them a stranger can reach.

Dropping a route from the router is a silent 404 in production; adding one to
the unauthenticated set by accident is worse.
"""

from app.main import create_app

# Everything the API serves. Update deliberately, not to make a test pass.
EXPECTED = {
    "/api/v1/register",
    "/api/v1/s3/abortmultipart",
    "/api/v1/s3/completemultipart",
    "/api/v1/s3/createmultipart",
    "/api/v1/s3/listparts",
    "/api/v1/s3/signedurl",
    "/api/v1/uploads",
    "/api/v1/uploads/lookup",
    "/api/v1/uploads/{upload_id:str}",
    "/api/v1/uploads/{upload_id:str}/checksum",
    "/api/v1/uploads/{upload_id:str}/pipeline/meta",
    "/api/v1/uploads/{upload_id:str}/pipeline/source",
    "/api/v1/workflowstatus",
}

# No session cookie: these are guarded by the per-upload callback token.
TOKEN_GUARDED = {
    "/api/v1/register",
    "/api/v1/workflowstatus",
    "/api/v1/uploads/{upload_id:str}/checksum",
    "/api/v1/uploads/{upload_id:str}/pipeline/meta",
    "/api/v1/uploads/{upload_id:str}/pipeline/source",
}
# Deliberately public, and only answers for uploads that have been published.
PUBLIC = {"/api/v1/uploads/lookup"}


def _api_handlers():
    for route in create_app().routes:
        for handler in getattr(route, "route_handlers", []):
            if "/api/v1" in route.path:
                yield route.path, handler


def test_every_route_is_registered():
    assert {path for path, _ in _api_handlers()} == EXPECTED


def test_only_the_expected_routes_skip_authentication():
    """`exclude_from_auth` is one keyword away from opening a handler up."""
    unauthenticated = {
        path
        for path, handler in _api_handlers()
        if getattr(handler, "opt", {}).get("exclude_from_auth")
    }
    assert unauthenticated == TOKEN_GUARDED | PUBLIC
