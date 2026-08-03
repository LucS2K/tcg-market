"""Pokemon via pokemontcg.io /v2/cards: daily prices + reference."""
from __future__ import annotations

import os
import time
from collections.abc import Iterator
from pathlib import Path

import pyarrow as pa
import requests

from .common import fnum, log, write_partition

API_URL = "https://api.pokemontcg.io/v2/cards"
PAGE_SIZE = 250

PRICE_SCHEMA = pa.schema(
    [
        ("card_id", pa.string()),
        ("source", pa.string()),
        ("variant", pa.string()),
        ("currency", pa.string()),
        ("low", pa.float64()),
        ("mid", pa.float64()),
        ("high", pa.float64()),
        ("market", pa.float64()),
        ("direct_low", pa.float64()),
        ("avg_sell", pa.float64()),
        ("trend", pa.float64()),
    ]
)

REF_SCHEMA = pa.schema(
    [
        ("card_id", pa.string()),
        ("name", pa.string()),
        ("number", pa.string()),
        ("rarity", pa.string()),
        ("set_id", pa.string()),
        ("set_name", pa.string()),
        ("released_at", pa.string()),
        ("image_url", pa.string()),
        ("artist", pa.string()),
    ]
)


def price_rows(card: dict) -> list[dict]:
    rows = []
    card_id = card["id"]
    tcgplayer = (card.get("tcgplayer") or {}).get("prices") or {}
    for variant, p in tcgplayer.items():
        rows.append(
            {
                "card_id": card_id,
                "source": "tcgplayer",
                "variant": variant,
                "currency": "USD",
                "low": fnum(p.get("low")),
                "mid": fnum(p.get("mid")),
                "high": fnum(p.get("high")),
                "market": fnum(p.get("market")),
                "direct_low": fnum(p.get("directLow")),
                "avg_sell": None,
                "trend": None,
            }
        )
    cardmarket = (card.get("cardmarket") or {}).get("prices") or {}
    if cardmarket:
        rows.append(
            {
                "card_id": card_id,
                "source": "cardmarket",
                "variant": None,
                "currency": "EUR",
                "low": fnum(cardmarket.get("lowPrice")),
                "mid": None,
                "high": None,
                "market": None,
                "direct_low": None,
                "avg_sell": fnum(cardmarket.get("averageSellPrice")),
                "trend": fnum(cardmarket.get("trendPrice")),
            }
        )
    return rows


def ref_row(card: dict) -> dict:
    card_set = card.get("set") or {}
    released = card_set.get("releaseDate")
    return {
        "card_id": card["id"],
        "name": card.get("name"),
        "number": card.get("number"),
        "rarity": card.get("rarity"),
        "set_id": card_set.get("id"),
        "set_name": card_set.get("name"),
        "released_at": released.replace("/", "-") if released else None,
        "image_url": (card.get("images") or {}).get("large"),
        "artist": card.get("artist"),
    }


def _get_page(session: requests.Session, page: int, select: str, headers: dict) -> dict:
    # pokemontcg.io throws intermittent 500s in windows that outlast the
    # session's ~30s of urllib3 backoff, so retry patiently on 5xx and
    # connection failures. 4xx still fails loudly on the first hit.
    attempts = 6
    for attempt in range(1, attempts + 1):
        try:
            resp = session.get(
                API_URL,
                params={"page": page, "pageSize": PAGE_SIZE, "select": select},
                headers=headers,
                timeout=(10, 120),
            )
            resp.raise_for_status()
            return resp.json()
        except (requests.exceptions.RetryError, requests.exceptions.ConnectionError,
                requests.exceptions.Timeout) as exc:
            err = exc
        except requests.exceptions.HTTPError as exc:
            if exc.response is None or exc.response.status_code < 500:
                raise
            err = exc
        if attempt == attempts:
            raise err
        log.warning("pokemon: page %d attempt %d/%d failed (%s); retrying in 30s",
                    page, attempt, attempts, type(err).__name__)
        time.sleep(30)


def iter_cards(session: requests.Session, select: str) -> Iterator[dict]:
    headers = {}
    api_key = os.environ.get("POKEMONTCG_API_KEY")
    if api_key:
        headers["X-Api-Key"] = api_key
        delay = 0.15
    else:
        log.warning("pokemon: POKEMONTCG_API_KEY not set; pacing for anonymous rate limits")
        delay = 2.0
    page = 1
    fetched = 0
    while True:
        payload = _get_page(session, page, select, headers)
        data = payload.get("data") or []
        yield from data
        fetched += len(data)
        total = payload.get("totalCount", 0)
        log.info("pokemon: page %d, %d/%d cards", page, fetched, total)
        if not data or fetched >= total:
            return
        page += 1
        time.sleep(delay)


def collect_prices(session: requests.Session, out_path: Path) -> None:
    rows = []
    cards = 0
    for card in iter_cards(session, select="id,tcgplayer,cardmarket"):
        cards += 1
        rows.extend(price_rows(card))
    log.info("pokemon: %d cards, %d price rows", cards, len(rows))
    write_partition(rows, PRICE_SCHEMA, out_path)


def collect_reference(session: requests.Session, out_path: Path) -> None:
    rows = [
        ref_row(card)
        for card in iter_cards(session, select="id,name,number,rarity,set,images,artist")
    ]
    log.info("pokemon: %d reference rows", len(rows))
    write_partition(rows, REF_SCHEMA, out_path)
