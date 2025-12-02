from typing import Optional
from stac_fastapi.pgstac.config import Settings as _Settings


class Settings(_Settings):
    """Settings specific to this deployment of STAC FastAPI PgSTAC with optional Hanko auth"""

    # Authentication Provider Switch
    # Options: "none" (no auth, default) or "hanko" (Hanko SSO)
    auth_provider: str = "none"

    # Hanko SSO Configuration (when auth_provider="hanko")
    hanko_api_url: Optional[str] = None
    jwt_issuer: Optional[str] = None
    cookie_secret: Optional[str] = None
    cookie_domain: Optional[str] = None
    cookie_secure: bool = True
    cookie_samesite: str = "none"

    # OSM OAuth (optional, when auth_provider="hanko")
    osm_client_id: Optional[str] = None
    osm_client_secret: Optional[str] = None
