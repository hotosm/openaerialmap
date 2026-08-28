"""Registry of third-party catalogs synced to OAM."""

from stactools.hotosm.maxar.stac import CATALOG as MAXAR
from stactools.hotosm.opendata import OpenDataCatalog
from stactools.hotosm.vantor.stac import CATALOG as VANTOR

CATALOGS: dict[str, OpenDataCatalog] = {
    catalog.key: catalog for catalog in (MAXAR, VANTOR)
}
