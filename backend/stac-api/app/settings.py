from enum import Enum

from stac_fastapi.pgstac.config import Settings as _Settings


class MonitoringTypes(str, Enum):
    NONE = ""
    PROMETHEUS = "prometheus"


class Settings(_Settings):
    """Settings specific to this deployment of STAC FastAPI PgSTAC"""

    # Keep deployment-specific monitoring configuration alongside the base settings.
    monitoring: MonitoringTypes = MonitoringTypes.NONE
