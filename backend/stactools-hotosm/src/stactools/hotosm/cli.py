"""Command line interface for OAM STAC creation and syncing."""

import datetime as dt
import json
from functools import partial
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any, Callable, Iterator, Literal, TypeVar
from urllib.parse import urljoin

import click
import pystac
import requests
from pypgstac.db import PgstacDB
from pypgstac.load import Loader, Methods

from stactools.hotosm.constants import COLLECTION_ID as OAM_COLLECTION_ID
from stactools.hotosm.maxar.stac import (
    COLLECTION_ID as MAXAR_COLLECTION_ID,
    create_collection as create_maxar_collection,
    create_item as create_maxar_item,
)
from stactools.hotosm.maxar.sync import (
    MAXAR_ROOT,
    new_stac_items as new_maxar_stac_items,
)
from stactools.hotosm.oam_metadata import OamMetadata
from stactools.hotosm.oam_metadata_client import OamMetadataClient
from stactools.hotosm.stac import (
    create_collection as create_oam_collection,
    create_item as create_oam_item,
)

# ===== Common CLI options and argument parsing
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
    type=click.Choice(["OAM", "Maxar"]),
    required=True,
    help="Sync STAC Collection definition for this dataset catalog.",
)


# ===== CLI commands
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
        loader.load_collections(destination, Methods.upsert)

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
@dump_to_path
@uploaded_since_sec
@uploaded_after_dt
@handle_exceptions
def dump_maxar(
    file: Path,
    uploaded_since: float | None,
    uploaded_after: dt.datetime | None,
    handle_exceptions: HandleExceptionsType,
    **_pgstac_options: Any,
) -> None:
    """Dump new Maxar Items from the open data bucket to NDJSON.

    The output of this CLI program can be used with the `pypgstac load items` CLI
    command to bulk load STAC Items into PgSTAC.
    """
    uploaded_after = parse_uploaded_since(uploaded_since, uploaded_after)

    click.echo(f"Looking for STAC Items added since {uploaded_after}")
    items, errors = sync_handler(
        collection_id=MAXAR_COLLECTION_ID,
        raw_metadata_creator=get_maxar_items_after,
        stac_item_creator=create_maxar_item,
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
    )
    loader.load_items(iter(items), insert_mode=Methods.upsert)
    click.echo(f"Completed ingesting {len(items)} STAC Items")
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
def sync_maxar(
    ctx: click.Context,
    uploaded_since: float | None,
    uploaded_after: dt.datetime | None,
    handle_exceptions: HandleExceptionsType,
    **_pgstac_options: Any,
) -> None:
    """Sync new Maxar Items from the open data bucket to PgSTAC."""
    uploaded_after = parse_uploaded_since(uploaded_since, uploaded_after)
    loader = Loader(ctx.obj["pgstac"])

    click.echo(f"Looking for STAC Items added since {uploaded_after}")
    items, errors = sync_handler(
        collection_id=MAXAR_COLLECTION_ID,
        raw_metadata_creator=get_maxar_items_after,
        stac_item_creator=create_maxar_item,
        uploaded_after=uploaded_after,
        handle_exceptions=handle_exceptions,
    )
    loader.load_items(iter(items), insert_mode=Methods.upsert)
    click.echo(f"Completed ingesting {len(items)} STAC Items")
    report_errors(errors)


# ===== Helper functions
def create_and_save_collection(catalog: str, destination: Path) -> None:
    """Create a STAC Collection and write to JSON."""
    if catalog == "OAM":
        collection = create_oam_collection()
    elif catalog == "Maxar":
        maxar_catalog = pystac.read_file(urljoin(MAXAR_ROOT, "catalog.json"))
        assert isinstance(maxar_catalog, pystac.Catalog)
        collection = create_maxar_collection(maxar_catalog)
    else:
        raise click.BadParameter("Unknown collection ID {collection}")

    with destination.open("w") as dst:
        dst.write(json.dumps(collection.to_dict()))


def get_oam_items_after(
    client: OamMetadataClient, uploaded_after: dt.datetime
) -> Iterator[OamMetadata]:
    """Helper function to yield sanitizied OamMetadata entities."""
    for oam_metadata in client.get_all_items(uploaded_after):
        yield oam_metadata.sanitize()


def get_maxar_items_after(
    uploaded_after: dt.datetime,
) -> Iterator[pystac.Item]:
    """Helper function to yield Maxar STAC Items."""
    yield from new_maxar_stac_items(
        pystac.stac_io.RetryStacIO(), requests.Session(), uploaded_after
    )


MetadataType = TypeVar("MetadataType")


def sync_handler(
    collection_id: str,
    raw_metadata_creator: Callable[[dt.datetime], Iterator[MetadataType]],
    stac_item_creator: Callable[[MetadataType], pystac.Item],
    uploaded_after: dt.datetime,
    handle_exceptions: HandleExceptionsType,
) -> tuple[list[dict], list[str]]:
    """Orchestrate creating STAC Items from a data provider."""
    raw_metadata = list(raw_metadata_creator(uploaded_after))
    click.echo(f"Found {len(raw_metadata)} metadata items added since {uploaded_after}")

    items = []
    errors = []
    for raw_metadata_ in raw_metadata:
        try:
            item = stac_item_creator(raw_metadata_).to_dict()
        except Exception as e:
            if handle_exceptions == "IGNORE":
                errors.append(f"{raw_metadata_}: {e}")
            else:
                raise
        # NOTE: STAC Items cannot contain a Collection ID unless they also include
        # a link to the Collection, which we won't necessarily know ahead of time.
        # We add the Collection ID here as a requirement for `pypgstac load items`.
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
