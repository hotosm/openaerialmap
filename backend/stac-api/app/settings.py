from stac_fastapi.pgstac.config import Settings as _Settings
from enum import Enum

class MonitoringTypes(str, Enum):
    NONE = ""
    PROMETHEUS = "prometheus"

class Settings(_Settings):
    """Settings specific to this deployment of STAC FastAPI PgSTAC"""
    monitoring: MonitoringTypes = MonitoringTypes.NONE
