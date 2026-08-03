"""Backfill historical prices from TCGCSV daily archives.

    python scripts/backfill_tcgcsv.py [--since 2024-02-08] [--until YYYY-MM-DD]
                                      [--every 7] [--games lorcana onepiece riftbound]

TCGCSV (tcgcsv.com) archives every TCGplayer daily price pull since
2024-02-08 as prices-YYYY-MM-DD.ppmd.7z. This script downloads each
sampled date, extracts the categories for our TCGplayer-sourced games,
maps TCGplayer product ids to our card ids via the reference extract's
tcgplayer_id column, and writes normal dated partitions
(data/game=<g>/date=<d>/prices.parquet, same schema as the daily
snapshot). Existing partitions are never overwritten, so the collector's
own snapshots always win and reruns are idempotent.

Products TCGCSV knows but the current tcgapi.dev catalog doesn't
(delisted products, usually) are counted and skipped.
"""
from __future__ import annotations

import argparse
import datetime as dt
import io
import json
import re
import sys
import tempfile
from pathlib import Path

import py7zr
import pyarrow.parquet as pq

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from collector.common import DATA_DIR, log, make_session, setup_logging, snapshot_path, fnum, write_partition  # noqa: E402
from collector.tcgapi import PRICE_SCHEMA  # noqa: E402


def partition_path(game: str, date_str: str) -> Path:
    if game in BACKFILL_LAYOUT_GAMES:
        return DATA_DIR / "backfill" / f"game={game}" / f"date={date_str}" / "prices.parquet"
    return snapshot_path(game, date_str)

ARCHIVE_URL = "https://tcgcsv.com/archive/tcgplayer/prices-{date}.ppmd.7z"
CATEGORIES_URL = "https://tcgcsv.com/tcgplayer/categories"

# game key -> lowercase tokens matched against TCGplayer category names
CATEGORY_TOKENS = {
    "onepiece": ("one piece",),
    "lorcana": ("lorcana",),
    "riftbound": ("riftbound",),
    "mtg": ("magic",),
    "pokemon": ("pokemon",),
}

# The tcgapi-sourced games share the forward snapshot schema, so their
# history lands in the normal layout. MTG and Pokemon forward snapshots
# use different schemas (Scryfall / pokemontcg.io), so their TCGplayer
# history lands under data/backfill/ with its own staging model.
BACKFILL_LAYOUT_GAMES = {"mtg", "pokemon"}


def resolve_categories(session) -> dict[str, int]:
    resp = session.get(CATEGORIES_URL, timeout=(10, 60))
    resp.raise_for_status()
    categories = resp.json()["results"]
    out = {}
    for game, tokens in CATEGORY_TOKENS.items():
        for cat in categories:
            name = (cat.get("name") or "").lower()
            if any(t in name for t in tokens):
                out[game] = int(cat["categoryId"])
                break
    log.info("tcgcsv categories: %s", out)
    return out


def _name_token(name: str) -> str:
    for token in re.split(r"[^A-Za-z0-9]+", name or ""):
        if token:
            return token.lower()
    return ""


def _norm_num(number: str) -> str:
    """Normalize collector numbers: '025/185' -> '25/185', 'SWSH001' -> 'SWSH1'."""
    parts = []
    for seg in (number or "").upper().split("/"):
        seg = re.sub(r"(?<![0-9])0+([0-9])", r"\1", seg.strip())
        parts.append(seg)
    return "/".join(p for p in parts if p)


def load_pokemon_map(session) -> dict[int, str]:
    """tcgplayer productId -> pokemontcg.io card id.

    pokemontcg.io exposes no TCGplayer product id, so match on
    (first name token, normalized collector number), indexing our cards
    under both 'num' and 'num/printedTotal' forms. Ambiguous keys are
    dropped entirely — an unmapped product beats a wrong price row.
    """
    resp = session.get(
        "https://api.pokemontcg.io/v2/sets",
        params={"pageSize": 250, "select": "id,printedTotal"},
        timeout=(10, 120),
    )
    resp.raise_for_status()
    totals = {s["id"]: s.get("printedTotal") for s in resp.json()["data"]}

    ref = pq.read_table(
        REPO_ROOT / "data" / "reference" / "game=pokemon" / "cards.parquet",
        columns=["card_id", "name", "number", "set_id", "set_name"],
    )
    by_key: dict[tuple, str] = {}
    ambiguous: set[tuple] = set()
    set_tokens: dict[str, set] = {}

    def index(key, card_id):
        if by_key.get(key, card_id) != card_id:
            ambiguous.add(key)
        else:
            by_key[key] = card_id

    for card_id, name, number, set_id, set_name in zip(*(c.to_pylist() for c in ref.columns)):
        token = _name_token(name)
        num = _norm_num(number)
        if not token or not num:
            continue
        set_tokens[card_id] = {t for t in re.split(r"[^a-z0-9]+", (set_name or "").lower()) if len(t) > 2}
        index((token, num), card_id)
        total = totals.get(set_id)
        if total:
            index((token, f"{num}/{total}"), card_id)
    for key in ambiguous:
        by_key.pop(key, None)

    groups = session.get("https://tcgcsv.com/tcgplayer/3/groups", timeout=(10, 60)).json()["results"]
    candidates: dict[str, list[tuple]] = {}
    products_seen = 0
    for group in groups:
        group_tokens = {t for t in re.split(r"[^a-z0-9]+", (group.get("name") or "").lower()) if len(t) > 2}
        prods = session.get(
            f"https://tcgcsv.com/tcgplayer/3/{group['groupId']}/products", timeout=(10, 60)
        ).json()["results"]
        for pr in prods:
            number = next(
                (ed.get("value") for ed in pr.get("extendedData", []) if ed.get("name") == "Number"),
                None,
            )
            if not number:
                continue  # sealed product or non-card
            products_seen += 1
            key = (_name_token(pr.get("cleanName") or pr.get("name", "")), _norm_num(number))
            card_id = by_key.get(key)
            if card_id:
                overlap = len(group_tokens & set_tokens.get(card_id, set()))
                candidates.setdefault(card_id, []).append((overlap, int(pr["productId"])))
    # One product per card. Name+number also matches World Championship
    # reprints and promo variants in other groups, so prefer the product
    # whose TCGplayer group name shares words with the card's set name
    # (product ids for old sets are not chronological, so id order alone
    # is not a safe tie-break). Ties fall back to the lowest product id.
    mapping = {}
    for card_id, cands in candidates.items():
        best = max(cands, key=lambda t: (t[0], -t[1]))
        mapping[best[1]] = card_id
    log.info(
        "pokemon: matched %d cards from %d tcgplayer card products",
        len(mapping), products_seen,
    )
    return mapping


def load_tcgplayer_map(game: str) -> dict[int, str]:
    ref = REPO_ROOT / "data" / "reference" / f"game={game}" / "cards.parquet"
    table = pq.read_table(ref, columns=["card_id", "tcgplayer_id"])
    mapping = {}
    for card_id, tcgplayer_id in zip(*(c.to_pylist() for c in table.columns)):
        if tcgplayer_id is not None:
            mapping[int(tcgplayer_id)] = card_id
    log.info("%s: %d tcgplayer_id mappings", game, len(mapping))
    return mapping


def price_rows_from_file(payload: dict, mapping: dict[int, str]) -> tuple[list[dict], int]:
    rows, unmapped = [], 0
    for p in payload.get("results", []):
        card_id = mapping.get(int(p["productId"]))
        if card_id is None:
            unmapped += 1
            continue
        rows.append(
            {
                "card_id": card_id,
                "printing": p.get("subTypeName"),
                "currency": "USD",
                "market_price": fnum(p.get("marketPrice")),
                "low_price": fnum(p.get("lowPrice")),
                "median_price": fnum(p.get("midPrice")),
                "lowest_with_shipping": None,
            }
        )
    return rows, unmapped


def backfill_date(session, date: dt.date, categories: dict[str, int], maps: dict[str, dict]) -> None:
    date_str = date.isoformat()
    targets = {g: partition_path(g, date_str) for g in categories}
    targets = {g: p for g, p in targets.items() if not p.exists()}
    if not targets:
        log.info("%s: all partitions exist, skipping", date_str)
        return

    url = ARCHIVE_URL.format(date=date_str)
    resp = session.get(url, timeout=(10, 600))
    if resp.status_code == 404:
        log.warning("%s: no archive published, skipping", date_str)
        return
    resp.raise_for_status()

    with tempfile.TemporaryDirectory(prefix="tcgcsv_") as tmp:
        with py7zr.SevenZipFile(io.BytesIO(resp.content)) as archive:
            names = archive.getnames()
            wanted_ids = {str(categories[g]) for g in targets}
            wanted = [n for n in names if any(part in wanted_ids for part in Path(n).parts)]
            archive.extract(path=tmp, targets=wanted)

        for game, out_path in targets.items():
            cat_id = str(categories[game])
            rows, unmapped = [], 0
            for f in Path(tmp).rglob("prices"):
                if cat_id not in f.parts:
                    continue
                try:
                    payload = json.loads(f.read_text(encoding="utf-8"))
                except (json.JSONDecodeError, UnicodeDecodeError):
                    continue
                r, u = price_rows_from_file(payload, maps[game])
                rows.extend(r)
                unmapped += u
            if not rows:
                # Category may simply not exist yet at this date
                # (e.g. Riftbound before launch).
                log.info("%s %s: no rows in archive", game, date_str)
                continue
            log.info("%s %s: %d rows (%d unmapped products skipped)", game, date_str, len(rows), unmapped)
            write_partition(rows, PRICE_SCHEMA, out_path)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Backfill prices from TCGCSV archives.")
    parser.add_argument("--since", default="2024-02-08")
    parser.add_argument("--until", default=(dt.date.today() - dt.timedelta(days=1)).isoformat())
    parser.add_argument("--every", type=int, default=7, help="sample every N days")
    parser.add_argument("--games", nargs="*", default=["onepiece", "lorcana", "riftbound"])
    args = parser.parse_args(argv)

    setup_logging()
    session = make_session()
    categories = resolve_categories(session)
    categories = {g: c for g, c in categories.items() if g in args.games}
    maps = {
        g: (load_pokemon_map(session) if g == "pokemon" else load_tcgplayer_map(g))
        for g in categories
    }

    start = dt.date.fromisoformat(args.since)
    end = dt.date.fromisoformat(args.until)
    failures = 0
    date = start
    while date <= end:
        try:
            backfill_date(session, date, categories, maps)
        except Exception:
            log.exception("%s: backfill FAILED", date)
            failures += 1
        date += dt.timedelta(days=args.every)

    if failures:
        log.error("backfill finished with %d failed dates", failures)
        return 1
    log.info("backfill complete")
    return 0


if __name__ == "__main__":
    sys.exit(main())
