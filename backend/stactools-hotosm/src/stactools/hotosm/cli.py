"""Command line interface for OAM STAC creation and syncing."""

import datetime as dt
import json
from functools import partial
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any, Callable, Iterator, Literal, Protocol, TypeVar

import click
import pystac
import requests
from pypgstac.db import PgstacDB
from pypgstac.load import Loader, Methods

from stactools.hotosm import opendata
from stactools.hotosm.catalogs import CATALOGS
from stactools.hotosm.constants import COLLECTION_ID as OAM_COLLECTION_ID
from stactools.hotosm.oam_metadata import OamMetadata
from stactools.hotosm.oam_metadata_client import OamMetadataClient
from stactools.hotosm.opendata import OpenDataCatalog
from stactools.hotosm.stac import (
    create_collection as create_oam_collection,
    create_item as create_oam_item,
)

OAM_CATALOG_KEY = "OAM"

uploaded_since_sec = click.option(
    "--uploaded-since",
    type=float,
    help="Find Items uploaded in last period provided in seconds.",
)
uploaded_after_dt = click.option(
    "--uploaded-after",
    type=click.DateTime(),
    help="Find Items uploaded after this date (UTC).",
)
handle_exceptions = click.option(
    "--handle-exceptions",
    type=click.Choice(["RAISE", "IGNORE"]),
    help="Behavior for exception handling when creating STAC Items.",
    default="RAISE",
    show_default=True,
)
HandleExceptionsType = Literal["RAISE", "IGNORE"]


def parse_uploaded_since(
    uploaded_since_sec: float | None,
    uploaded_after_dt: dt.datetime | None,
) -> dt.datetime:
    """Parse mutually exclusive arguments for finding Items uploaded since some time."""
    if (uploaded_after_dt is uploaded_since_sec) or (
        uploaded_since_sec and uploaded_after_dt
    ):
        raise click.BadParameter(
            "Must provide one of --uploaded-since or --uploaded-after"
        )

    if uploaded_since_sec is not None:
        return dt.datetime.now(tz=dt.UTC) - dt.timedelta(seconds=uploaded_since_sec)

    if uploaded_after_dt is not None:
        return uploaded_after_dt.replace(tzinfo=dt.UTC)

    raise click.BadParameter("Must provide one of --uploaded-since or --uploaded-after")


def create_pgstac_from_ctx(
    ctx: click.Context,
    _: click.Parameter,
    value: Any,
) -> PgstacDB:
    """Create PgSTAC connection."""
    dsn = "postgresql://{user}:{password}@{host}:{port}/{database}".format(
        user=ctx.params["pguser"],
        password=ctx.params["pgpassword"],
        host=ctx.params["pghost"],
        port=ctx.params["pgport"],
        database=value,
    )
    ctx.obj = ctx.obj or {}
    ctx.obj["pgstac"] = PgstacDB(dsn)
    return value


pgstac_username = click.option(
    "--pguser",
    envvar="PGUSER",
    help="Username for PgSTAC",
    required=True,
)
pgstac_password = click.option(
    "--pgpassword",
    envvar="PGPASSWORD",
    help="Password for PgSTAC",
    required=True,
)
pgstac_host = click.option(
    "--pghost",
    envvar="PGHOST",
    help="Host for PgSTAC",
    required=True,
)
pgstac_port = click.option(
    "--pgport",
    envvar="PGPORT",
    help="Port for PgSTAC",
    required=True,
)
pgstac_database = click.option(
    "--pgdatabase",
    envvar="PGDATABASE",
    help="Database for PgSTAC",
    required=True,
    callback=create_pgstac_from_ctx,
)

dump_to_path = click.option(
    "--file",
    type=click.Path(
        writable=True,
        path_type=Path,
    ),
    help="Dump STAC Items to this file.",
    required=True,
)


catalog_option = click.option(
    "--catalog",
    type=click.Choice([OAM_CATALOG_KEY, *CATALOGS]),
    required=True,
    help="Sync STAC Collection definition for this dataset catalog.",
)


@click.group
def main():
    """STAC for Humanitarian OpenStreetMap Team OpenAerialMap."""


@main.command()
@dump_to_path
@catalog_option
def dump_collection(
    file: Path,
    catalog: str,
    **_pgstac_options: Any,
) -> None:
    """Dump Collection definition to JSON.

    The output of this CLI program can be used with the `pypgstac load collections` CLI
    command to bulk load STAC Items into PgSTAC.
    """
    create_and_save_collection(catalog, file)
    click.echo(f"Saved the STAC Collection definition for {catalog} to {file}.")


@main.command()
@catalog_option
@pgstac_username
@pgstac_password
@pgstac_host
@pgstac_port
@pgstac_database
@click.pass_context
def sync_collection(
    ctx: click.Context,
    catalog: str,
    **_pgstac_options: Any,
) -> None:
    """Sync Collection definition to PgSTAC."""
    loader = Loader(ctx.obj["pgstac"])

    with TemporaryDirectory() as tmp_dir:
        destination = Path(tmp_dir).joinpath("collections.json")
        create_and_save_collection(catalog, destination)
        # pypgstac reads a str or an iterable, and silently ignores a Path.
        loader.load_collections(str(destination), Methods.upsert)

    click.echo(f"Synchronized the STAC Collection definition for {catalog} to PgSTAC.")


@main.command()
@dump_to_path
@uploaded_since_sec
@uploaded_after_dt
@handle_exceptions
def dump_oam(
    file: Path,
    uploaded_since: float | None,
    uploaded_after: dt.datetime | None,
    handle_exceptions: HandleExceptionsType,
    **_pgstac_options: Any,
):
    """Dump new STAC Items from OAM metadata API to NDJSON.

    The output of this CLI program can be used with the `pypgstac load items` CLI
    command to bulk load STAC Items into PgSTAC.
    """
    uploaded_after = parse_uploaded_since(uploaded_since, uploaded_after)
    client = OamMetadataClient.new()

    click.echo(f"Looking for OAM metadata entities added since {uploaded_after}")
    items, errors = sync_handler(
        collection_id=OAM_COLLECTION_ID,
        raw_metadata_creator=partial(get_oam_items_after, client),
        stac_item_creator=create_oam_item,
        uploaded_after=uploaded_after,
        handle_exceptions=handle_exceptions,
    )
    dump_to_ndjson(file, items)
    report_errors(errors)


@main.command()
@uploaded_since_sec
@uploaded_after_dt
@handle_exceptions
@pgstac_username
@pgstac_password
@pgstac_host
@pgstac_port
@pgstac_database
@click.pass_context
def sync_oam(
    ctx: click.Context,
    uploaded_since: float | None,
    uploaded_after: dt.datetime | None,
    handle_exceptions: HandleExceptionsType,
    **_pgstac_options: Any,
):
    """Sync new STAC Items from OAM metadata API to PgSTAC."""
    uploaded_after = parse_uploaded_since(uploaded_since, uploaded_after)
    loader = Loader(ctx.obj["pgstac"])
    client = OamMetadataClient.new()

    click.echo(f"Looking for OAM metadata entities added since {uploaded_after}")
    items, errors = sync_handler(
        collection_id=OAM_COLLECTION_ID,
        raw_metadata_creator=partial(get_oam_items_after, client),
        stac_item_creator=create_oam_item,
        uploaded_after=uploaded_after,
        handle_exceptions=handle_exceptions,
        existing_ids_finder=partial(get_existing_item_ids, ctx.obj["pgstac"]),
    )
    loader.load_items(iter(items), insert_mode=Methods.upsert)
    click.echo(f"Completed ingesting {len(items)} STAC Items")
    report_errors(errors)


def dump_catalog_command(catalog: OpenDataCatalog) -> click.Command:
    """Build the `dump-<catalog>` CLI command for an open data catalog."""

    @click.command(
        name=f"dump-{catalog.key.lower()}",
        help=(
            f"Dump new {catalog.key} Items from the open data bucket to NDJSON.\n"
            "\n"
            "The output of this CLI program can be used with the "
            "`pypgstac load items` CLI command to bulk load STAC Items into PgSTAC."
        ),
    )
    @dump_to_path
    @uploaded_since_sec
    @uploaded_after_dt
    @handle_exceptions
    def dump(
        file: Path,
        uploaded_since: float | None,
        uploaded_after: dt.datetime | None,
        handle_exceptions: HandleExceptionsType,
        **_pgstac_options: Any,
    ) -> None:
        after = parse_uploaded_since(uploaded_since, uploaded_after)

        click.echo(f"Looking for STAC Items added since {after}")
        items, errors = sync_handler(
            collection_id=catalog.collection_id,
            raw_metadata_creator=partial(get_catalog_items_after, catalog),
            stac_item_creator=partial(opendata.create_item, catalog),
            uploaded_after=after,
            handle_exceptions=handle_exceptions,
            target_item_id=catalog.target_item_id,
        )
        dump_to_ndjson(file, items)
        report_errors(errors)

    return dump


def sync_catalog_command(catalog: OpenDataCatalog) -> click.Command:
    """Build the `sync-<catalog>` CLI command for an open data catalog."""

    @click.command(
        name=f"sync-{catalog.key.lower()}",
        help=f"Sync new {catalog.key} Items from the open data bucket to PgSTAC.",
    )
    @uploaded_since_sec
    @uploaded_after_dt
    @handle_exceptions
    @pgstac_username
    @pgstac_password
    @pgstac_host
    @pgstac_port
    @pgstac_database
    @click.pass_context
    def sync(
        ctx: click.Context,
        uploaded_since: float | None,
        uploaded_after: dt.datetime | None,
        handle_exceptions: HandleExceptionsType,
        **_pgstac_options: Any,
    ) -> None:
        after = parse_uploaded_since(uploaded_since, uploaded_after)
        loader = Loader(ctx.obj["pgstac"])

        click.echo(f"Looking for STAC Items added since {after}")
        items, errors = sync_handler(
            collection_id=catalog.collection_id,
            raw_metadata_creator=partial(get_catalog_items_after, catalog),
            stac_item_creator=partial(opendata.create_item, catalog),
            uploaded_after=after,
            handle_exceptions=handle_exceptions,
            existing_ids_finder=partial(get_existing_item_ids, ctx.obj["pgstac"]),
            target_item_id=catalog.target_item_id,
        )
        loader.load_items(iter(items), insert_mode=Methods.upsert)
        click.echo(f"Completed ingesting {len(items)} STAC Items")
        report_errors(errors)

    return sync


for _catalog in CATALOGS.values():
    main.add_command(dump_catalog_command(_catalog))
    main.add_command(sync_catalog_command(_catalog))


def create_and_save_collection(catalog: str, destination: Path) -> None:
    """Create a STAC Collection and write to JSON."""
    if catalog == OAM_CATALOG_KEY:
        collection = create_oam_collection()
    elif open_data_catalog := CATALOGS.get(catalog):
        collection = opendata.create_collection(
            open_data_catalog,
            open_data_catalog.read_catalog(),
            catalog_ids=open_data_catalog.find_catalog_ids(requests.Session()),
        )
    else:
        raise click.BadParameter(f"Unknown collection ID {catalog}")

    with destination.open("w") as dst:
        dst.write(json.dumps(collection.to_dict()))


def get_oam_items_after(
    client: OamMetadataClient, uploaded_after: dt.datetime
) -> Iterator[OamMetadata]:
    """Helper function to yield sanitizied OamMetadata entities."""
    seen: set[str] = set()
    for oam_metadata in client.get_all_items(uploaded_after):
        # Paging by upload date can repeat an entry when uploads land mid-run.
        if oam_metadata.id in seen:
            continue
        seen.add(oam_metadata.id)
        yield oam_metadata.sanitize()


def get_catalog_items_after(
    catalog: OpenDataCatalog,
    uploaded_after: dt.datetime,
) -> Iterator[pystac.Item]:
    """Helper function to yield an open data catalog's STAC Items."""
    yield from catalog.find_new_items(
        pystac.stac_io.RetryStacIO(), requests.Session(), uploaded_after
    )


class HasId(Protocol):
    """Object with a STAC Item ID."""

    id: str


MetadataType = TypeVar("MetadataType", bound=HasId)


def get_existing_item_ids(
    pgstac: PgstacDB, collection_id: str, item_ids: list[str]
) -> set[str]:
    """Return the subset of `item_ids` already present in PgSTAC."""
    if not item_ids:
        return set()
    rows = pgstac.query(
        "SELECT id FROM items WHERE collection = %s AND id = ANY(%s)",
        [collection_id, item_ids],
    )
    return {row[0] for row in rows}


def check_item_id(item_id: str, predicted_id: str, taken_by: str | None) -> None:
    """Confirm a created Item lands on the ID it was expected to.

    Every source Item reaching here is a distinct record - each source drops
    its own repeated links first - so two landing on one ID would overwrite
    each other in a single flattened OAM Collection. STAC allows a provider to
    reuse an ID across two of its Collections, so this is the provider's to
    resolve, not something to silently collapse.
    """
    if item_id != predicted_id:
        raise ValueError(
            f"Created Item ID {item_id!r} is not the predicted {predicted_id!r}: "
            "the catalog's prepare_item and target_item_id disagree"
        )

    if taken_by is not None:
        raise ValueError(
            f"Item ID {item_id!r} is already taken by source Item {taken_by!r}: "
            "give them distinct IDs in the catalog's prepare_item"
        )


def sync_handler(
    collection_id: str,
    raw_metadata_creator: Callable[[dt.datetime], Iterator[MetadataType]],
    stac_item_creator: Callable[[MetadataType], pystac.Item],
    uploaded_after: dt.datetime,
    handle_exceptions: HandleExceptionsType,
    existing_ids_finder: Callable[[str, list[str]], set[str]] | None = None,
    target_item_id: opendata.TargetItemId | None = None,
) -> tuple[list[dict], list[str]]:
    """Orchestrate creating STAC Items from a data provider."""
    to_target_id = target_item_id or (lambda id_: id_)
    raw_metadata = list(raw_metadata_creator(uploaded_after))
    click.echo(f"Found {len(raw_metadata)} metadata items added since {uploaded_after}")

    # Skip existing Items before reading their remote assets.
    if existing_ids_finder is not None:
        existing = existing_ids_finder(
            collection_id, [to_target_id(m.id) for m in raw_metadata]
        )
        if existing:
            click.echo(f"Skipping {len(existing)} Items already in PgSTAC")
            raw_metadata = [
                m for m in raw_metadata if to_target_id(m.id) not in existing
            ]

    items = []
    errors = []
    source_of: dict[str, str] = {}
    for raw_metadata_ in raw_metadata:
        try:
            item = stac_item_creator(raw_metadata_).to_dict()
            check_item_id(
                item["id"],
                to_target_id(raw_metadata_.id),
                source_of.get(item["id"]),
            )
        except Exception as e:
            if handle_exceptions == "IGNORE":
                errors.append(f"{raw_metadata_}: {e}")
                continue
            else:
                raise
        source_of[item["id"]] = raw_metadata_.id
        # PgSTAC requires a Collection ID even when its link is unavailable.
        item["collection"] = collection_id
        items.append(item)

    return items, errors


def dump_to_ndjson(path: Path, items: list[dict]) -> None:
    """Dump STAC Items to Newline Delimited JSON (NDJSON)."""
    with path.open("w") as dst:
        for item in items:
            dst.write(json.dumps(item) + "\n")
    click.echo(f"Completed dumping {len(items)} STAC Items to {path}")


def report_errors(errors: list[str]) -> None:
    """Helper function to report error messages via Click."""
    if errors:
        click.echo(f"Encountered errors with {len(errors)} OAM catalog entries:")
        for error in errors:
            click.echo(error)
