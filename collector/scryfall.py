"""MTG via Scryfall bulk data (default_cards): daily prices + reference."""
from __future__ import annotations

import gzip
import json
from collections.abc import Iterator
from pathlib import Path

import ijson
import pyarrow as pa
import requests

from .common import fnum, log, write_partition

BULK_META_URL = "https://api.scryfall.com/bulk-data/default-cards"

PRICE_SCHEMA = pa.schema(
    [
        ("card_id", pa.string()),
        ("usd", pa.float64()),
        ("usd_foil", pa.float64()),
        ("usd_etched", pa.float64()),
        ("eur", pa.float64()),
        ("eur_foil", pa.float64()),
        ("tix", pa.float64()),
    ]
)

REF_SCHEMA = pa.schema(
    [
        ("card_id", pa.string()),
        ("oracle_id", pa.string()),
        ("name", pa.string()),
        ("number", pa.string()),
        ("rarity", pa.string()),
        ("set_id", pa.string()),
        ("set_name", pa.string()),
        ("released_at", pa.string()),
        ("image_url", pa.string()),
        ("artist", pa.string()),
        ("tcgplayer_id", pa.int64()),
    ]
)


def price_row(card: dict) -> dict:
    prices = card.get("prices") or {}
    return {
        "card_id": card["id"],
        "usd": fnum(prices.get("usd")),
        "usd_foil": fnum(prices.get("usd_foil")),
        "usd_etched": fnum(prices.get("usd_etched")),
        "eur": fnum(prices.get("eur")),
        "eur_foil": fnum(prices.get("eur_foil")),
        "tix": fnum(prices.get("tix")),
    }


def ref_row(card: dict) -> dict:
    image_uris = card.get("image_uris")
    if not image_uris:
        # Double-faced cards carry imagery on the faces instead.
        faces = card.get("card_faces") or []
        if faces:
            image_uris = faces[0].get("image_uris")
    return {
        "card_id": card["id"],
        "oracle_id": card.get("oracle_id"),
        "name": card.get("name"),
        "number": card.get("collector_number"),
        "rarity": card.get("rarity"),
        "set_id": card.get("set"),
        "set_name": card.get("set_name"),
        "released_at": card.get("released_at"),
        "image_url": (image_uris or {}).get("normal"),
        "artist": card.get("artist"),
        "tcgplayer_id": card.get("tcgplayer_id"),
    }


def iter_bulk_cards(session: requests.Session) -> Iterator[dict]:
    meta = session.get(BULK_META_URL, timeout=(10, 60))
    meta.raise_for_status()
    info = meta.json()
    # Scryfall migrated bulk files from a JSON array (download_uri) to
    # gzipped JSONL (jsonl_download_uri); support both.
    jsonl_uri = info.get("jsonl_download_uri")
    array_uri = info.get("download_uri")
    uri = jsonl_uri or array_uri
    if not uri:
        raise RuntimeError(f"scryfall bulk meta has no download uri (keys: {sorted(info)})")
    log.info("mtg: streaming scryfall bulk %s", uri)
    resp = session.get(uri, stream=True, timeout=(10, 600))
    resp.raise_for_status()
    if jsonl_uri:
        with gzip.open(resp.raw, mode="rt", encoding="utf-8") as stream:
            for line in stream:
                if line.strip():
                    yield json.loads(line)
    else:
        resp.raw.decode_content = True
        yield from ijson.items(resp.raw, "item")


def collect_prices(session: requests.Session, out_path: Path) -> None:
    rows = [price_row(card) for card in iter_bulk_cards(session)]
    log.info("mtg: %d cards from scryfall bulk", len(rows))
    write_partition(rows, PRICE_SCHEMA, out_path)


def collect_reference(session: requests.Session, out_path: Path) -> None:
    rows = [ref_row(card) for card in iter_bulk_cards(session)]
    log.info("mtg: %d reference rows", len(rows))
    write_partition(rows, REF_SCHEMA, out_path)
