"""FastAPI application using PGStac.

Enables the extensions specified as a comma-delimited list in
the ENABLED_EXTENSIONS environment variable (e.g. `transactions,sort,query`).
If the variable is not set, enables all extensions.
"""

import os
from contextlib import asynccontextmanager

from brotli_asgi import BrotliMiddleware
from fastapi import FastAPI
from fastapi.responses import ORJSONResponse
from stac_fastapi.api.app import StacApi
from stac_fastapi.api.middleware import CORSMiddleware, ProxyHeaderMiddleware
from stac_fastapi.api.models import (
    EmptyRequest,
    ItemCollectionUri,
    create_get_request_model,
    create_post_request_model,
    create_request_model,
)
from stac_fastapi.extensions.core import (
    CollectionSearchExtension,
    CollectionSearchFilterExtension,
    FieldsExtension,
    FreeTextExtension,
    ItemCollectionFilterExtension,
    OffsetPaginationExtension,
    SearchFilterExtension,
    SortExtension,
    TokenPaginationExtension,
    TransactionExtension,
)
from stac_fastapi.extensions.core.fields import FieldsConformanceClasses
from stac_fastapi.extensions.core.free_text import FreeTextConformanceClasses
from stac_fastapi.extensions.core.query import QueryConformanceClasses
from stac_fastapi.extensions.core.sort import SortConformanceClasses
from stac_fastapi.extensions.third_party import BulkTransactionExtension
from starlette.middleware import Middleware

from stac_fastapi.pgstac.core import CoreCrudClient
from stac_fastapi.pgstac.db import close_db_connection, connect_to_db
from stac_fastapi.pgstac.extensions import QueryExtension
from stac_fastapi.pgstac.extensions.filter import FiltersClient
from stac_fastapi.pgstac.transactions import BulkTransactionsClient, TransactionsClient
from stac_fastapi.pgstac.types.search import PgstacSearch

from app.settings import Settings

settings = Settings()

# search extensions
search_extensions_map = {
    "query": QueryExtension(),
    "sort": SortExtension(),
    "fields": FieldsExtension(),
    "filter": SearchFilterExtension(client=FiltersClient()),
    "pagination": TokenPaginationExtension(),
}

# collection_search extensions
cs_extensions_map = {
    "query": QueryExtension(conformance_classes=[QueryConformanceClasses.COLLECTIONS]),
    "sort": SortExtension(conformance_classes=[SortConformanceClasses.COLLECTIONS]),
    "fields": FieldsExtension(
        conformance_classes=[FieldsConformanceClasses.COLLECTIONS]
    ),
    "filter": CollectionSearchFilterExtension(client=FiltersClient()),
    "free_text": FreeTextExtension(
        conformance_classes=[FreeTextConformanceClasses.COLLECTIONS],
    ),
    "pagination": OffsetPaginationExtension(),
}

# item_collection extensions
itm_col_extensions_map = {
    "query": QueryExtension(
        conformance_classes=[QueryConformanceClasses.ITEMS],
    ),
    "sort": SortExtension(
        conformance_classes=[SortConformanceClasses.ITEMS],
    ),
    "fields": FieldsExtension(conformance_classes=[FieldsConformanceClasses.ITEMS]),
    "filter": ItemCollectionFilterExtension(client=FiltersClient()),
    "pagination": TokenPaginationExtension(),
}

enabled_extensions = {
    *search_extensions_map.keys(),
    *cs_extensions_map.keys(),
    *itm_col_extensions_map.keys(),
    "collection_search",
}

application_extensions = []

if os.environ.get("ENABLE_TRANSACTIONS_EXTENSIONS", "").lower() in ["yes", "true", "1"]:
    application_extensions.append(
        TransactionExtension(
            client=TransactionsClient(),
            settings=settings,
            response_class=ORJSONResponse,
        ),
    )

    application_extensions.append(
        BulkTransactionExtension(client=BulkTransactionsClient()),
    )

# /search models
search_extensions = [
    extension
    for key, extension in search_extensions_map.items()
    if key in enabled_extensions
]
post_request_model = create_post_request_model(
    search_extensions, base_model=PgstacSearch
)
get_request_model = create_get_request_model(search_extensions)
application_extensions.extend(search_extensions)

# /collections/{collectionId}/items model
items_get_request_model = ItemCollectionUri
itm_col_extensions = [
    extension
    for key, extension in itm_col_extensions_map.items()
    if key in enabled_extensions
]
if itm_col_extensions:
    items_get_request_model = create_request_model(
        model_name="ItemCollectionUri",
        base_model=ItemCollectionUri,
        extensions=itm_col_extensions,
        request_type="GET",
    )
    application_extensions.extend(itm_col_extensions)

# /collections model
collections_get_request_model = EmptyRequest
if "collection_search" in enabled_extensions:
    cs_extensions = [
        extension
        for key, extension in cs_extensions_map.items()
        if key in enabled_extensions
    ]
    collection_search_extension = CollectionSearchExtension.from_extensions(
        cs_extensions
    )
    collections_get_request_model = collection_search_extension.GET
    application_extensions.append(collection_search_extension)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI Lifespan."""
    await connect_to_db(app)

    # Initialize Hanko auth if enabled
    if settings.auth_provider == "hanko":
        try:
            from hotosm_auth import AuthConfig
            from hotosm_auth.integrations.fastapi import init_auth

            auth_config = AuthConfig.from_env()
            init_auth(auth_config)
            print("✅ Hanko auth initialized")
        except ImportError:
            print("⚠️ hotosm_auth not available - auth disabled")
        except Exception as e:
            print(f"⚠️ Failed to initialize auth: {e}")

    yield
    await close_db_connection(app)


api = StacApi(
    app=FastAPI(
        openapi_url=settings.openapi_url,
        docs_url=settings.docs_url,
        redoc_url=None,
        root_path=settings.root_path,
        title=settings.stac_fastapi_title,
        version=settings.stac_fastapi_version,
        description=settings.stac_fastapi_description,
        lifespan=lifespan,
    ),
    settings=settings,
    extensions=application_extensions,
    client=CoreCrudClient(pgstac_search_model=post_request_model),
    response_class=ORJSONResponse,
    items_get_request_model=items_get_request_model,
    search_get_request_model=get_request_model,
    search_post_request_model=post_request_model,
    collections_get_request_model=collections_get_request_model,
    middlewares=[
        Middleware(BrotliMiddleware),
        Middleware(ProxyHeaderMiddleware),
        Middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins,
            allow_methods=settings.cors_methods,
        ),
    ],
)
app = api.app

# Note: OSM OAuth routes are centralized in Login service at https://login.hotosm.test/api/auth/osm
# Frontend will call Login service directly for OSM operations


def run():
    """Run app from command line using uvicorn if available."""
    try:
        import uvicorn

        uvicorn.run(
            "app.main:app",
            host=settings.app_host,
            port=settings.app_port,
            log_level="info",
            reload=settings.reload,
            root_path=os.getenv("UVICORN_ROOT_PATH", ""),
        )
    except ImportError as e:
        raise RuntimeError("Uvicorn must be installed in order to use command") from e


if __name__ == "__main__":
    run()
