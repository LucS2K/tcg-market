"""Lorcana / One Piece / Riftbound via tcgapi.dev (Hobby tier).

X-API-Key required; Hobby tier allows 1,000 requests/day account-wide
(resets midnight UTC). Set-level price dumps and bulk export are higher
tiers, so the path is /v1/sets?game=X then /v1/sets/:id/cards at
per_page=100, reading price fields off each card object (~190 requests
for a full three-game snapshot; the roster does not fit the free tier's
100/day). The client counts every request and a 429 aborts the run
immediately instead of retrying.
"""
from __future__ import annotations

import os
from collections.abc import Iterator
from pathlib import Path

import pyarrow as pa
import requests

from .common import fnum, log, write_partition

BASE_URL = "https://api.tcgapi.dev/v1"
PER_PAGE = 100

# game key -> lowercase tokens matched against tcgapi.dev game name/slug
GAME_TOKENS = {
    "lorcana": ("lorcana",),
    "onepiece": ("one piece", "one-piece"),
    "riftbound": ("riftbound",),
}

PRICE_KEYS = ("market_price", "low_price", "median_price", "lowest_with_shipping")

PRICE_SCHEMA = pa.schema(
    [
        ("card_id", pa.string()),
        ("printing", pa.string()),
        ("currency", pa.string()),
        ("market_price", pa.float64()),
        ("low_price", pa.float64()),
        ("median_price", pa.float64()),
        ("lowest_with_shipping", pa.float64()),
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


class TcgApiClient:
    def __init__(self, session: requests.Session):
        api_key = os.environ.get("TCGAPI_KEY")
        if not api_key:
            raise RuntimeError(
                "TCGAPI_KEY is not set; required for lorcana/onepiece/riftbound "
                "(free key at https://tcgapi.dev)"
            )
        self.session = session
        self.api_key = api_key
        self.requests_made = 0
        self._slugs: dict[str, str] | None = None

    def get(self, path: str, **params) -> dict:
        resp = self.session.get(
            f"{BASE_URL}{path}",
            params=params,
            headers={"X-API-Key": self.api_key},
            timeout=(10, 120),
        )
        self.requests_made += 1
        if resp.status_code == 429:
            raise RuntimeError(
                f"tcgapi.dev returned 429 (daily cap) after {self.requests_made} "
                "requests this run; cap resets at midnight UTC"
            )
        resp.raise_for_status()
        return resp.json()

    def paginate(self, path: str, **params) -> Iterator[dict]:
        page = 1
        while True:
            payload = self.get(path, page=page, per_page=PER_PAGE, **params)
            data = payload.get("data") or []
            yield from data
            if not data or not _has_more(payload.get("pagination") or {}, page, len(data)):
                return
            page += 1

    def slug_for(self, game: str) -> str:
        if self._slugs is None:
            games = list(self.paginate("/games"))
            self._slugs = {}
            for key, tokens in GAME_TOKENS.items():
                for g in games:
                    haystack = f"{g.get('name', '')} {g.get('slug', '')}".lower()
                    if any(token in haystack for token in tokens):
                        self._slugs[key] = g["slug"]
                        break
            log.info("tcgapi: resolved slugs %s", self._slugs)
        if game not in self._slugs:
            raise RuntimeError(f"tcgapi.dev has no game matching {game!r}")
        return self._slugs[game]


def _has_more(pagination: dict, page: int, page_len: int) -> bool:
    if "has_more" in pagination:
        return bool(pagination["has_more"])
    total = pagination.get("total")
    if total is not None:
        per_page = pagination.get("per_page") or PER_PAGE
        return page * per_page < int(total)
    return page_len >= PER_PAGE


def card_price_rows(card: dict) -> list[dict]:
    card_id = str(card.get("id"))
    nested = card.get("prices")
    if isinstance(nested, list):
        return [
            {
                "card_id": card_id,
                "printing": p.get("printing"),
                "currency": "USD",
                **{k: fnum(p.get(k)) for k in PRICE_KEYS},
            }
            for p in nested
        ]
    if any(k in card for k in PRICE_KEYS):
        return [
            {
                "card_id": card_id,
                "printing": card.get("printing"),
                "currency": "USD",
                **{k: fnum(card.get(k)) for k in PRICE_KEYS},
            }
        ]
    return []


def card_ref_row(card: dict, set_info: dict) -> dict:
    return {
        "card_id": str(card.get("id")),
        "name": card.get("name"),
        "number": card.get("number"),
        "rarity": card.get("rarity"),
        "set_id": str(set_info.get("id")),
        "set_name": set_info.get("name") or card.get("set_name"),
        "released_at": set_info.get("release_date"),
        "image_url": card.get("image_url"),
        "artist": None,  # not provided by tcgapi.dev
    }


def _iter_set_cards(client: TcgApiClient, game: str) -> Iterator[tuple[dict, dict]]:
    slug = client.slug_for(game)
    sets = list(client.paginate("/sets", game=slug))
    if not sets:
        raise RuntimeError(f"tcgapi.dev returned no sets for {game} (slug={slug})")
    log.info("%s: %d sets", game, len(sets))
    for set_info in sets:
        for card in client.paginate(f"/sets/{set_info['id']}/cards"):
            yield set_info, card


def collect_prices(client: TcgApiClient, game: str, out_path: Path) -> None:
    rows = []
    cards = 0
    for _set_info, card in _iter_set_cards(client, game):
        cards += 1
        rows.extend(card_price_rows(card))
    if cards and not rows:
        raise RuntimeError(
            f"{game}: {cards} cards but zero price rows — tcgapi.dev response shape changed?"
        )
    log.info("%s: %d cards, %d price rows, %d api requests so far", game, cards, len(rows), client.requests_made)
    write_partition(rows, PRICE_SCHEMA, out_path)


def collect_reference(client: TcgApiClient, game: str, out_path: Path) -> None:
    rows = [card_ref_row(card, set_info) for set_info, card in _iter_set_cards(client, game)]
    log.info("%s: %d reference rows, %d api requests so far", game, len(rows), client.requests_made)
    write_partition(rows, REF_SCHEMA, out_path)
