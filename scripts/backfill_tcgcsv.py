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
import shutil
import sys
import tempfile
from pathlib import Path

import py7zr
import pyarrow.parquet as pq

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from collector.common import log, make_session, setup_logging, snapshot_path, fnum, write_partition  # noqa: E402
from collector.tcgapi import PRICE_SCHEMA  # noqa: E402

ARCHIVE_URL = "https://tcgcsv.com/archive/tcgplayer/prices-{date}.ppmd.7z"
CATEGORIES_URL = "https://tcgcsv.com/tcgplayer/categories"

# game key -> lowercase tokens matched against TCGplayer category names
CATEGORY_TOKENS = {
    "onepiece": ("one piece",),
    "lorcana": ("lorcana",),
    "riftbound": ("riftbound",),
}


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
    targets = {g: snapshot_path(g, date_str) for g in categories}
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
    parser.add_argument("--games", nargs="*", default=list(CATEGORY_TOKENS))
    args = parser.parse_args(argv)

    setup_logging()
    session = make_session()
    categories = resolve_categories(session)
    categories = {g: c for g, c in categories.items() if g in args.games}
    maps = {g: load_tcgplayer_map(g) for g in categories}

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
