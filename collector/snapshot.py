"""Daily price snapshot entry point.

    python -m collector.snapshot [games...] [--date YYYY-MM-DD] [--force]

Idempotent per date: a game whose partition file already exists is
skipped. Any source error logs a traceback and the run exits non-zero.
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone

from . import pokemon, scryfall, tcgapi
from .common import GAMES, log, make_session, setup_logging, snapshot_path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Collect daily TCG price snapshots.")
    parser.add_argument("games", nargs="*", default=[], metavar="game")
    parser.add_argument("--date", default=datetime.now(timezone.utc).date().isoformat())
    parser.add_argument("--force", action="store_true", help="overwrite existing partitions")
    args = parser.parse_args(argv)
    games = args.games or list(GAMES)
    unknown = [g for g in games if g not in GAMES]
    if unknown:
        parser.error(f"unknown game(s) {unknown}; choose from {list(GAMES)}")

    setup_logging()
    session = make_session()
    tcgapi_client: tcgapi.TcgApiClient | None = None
    failures = []

    for game in games:
        out_path = snapshot_path(game, args.date)
        if out_path.exists() and not args.force:
            log.info("%s date=%s: partition exists, skipping (idempotent no-op)", game, args.date)
            continue
        log.info("%s date=%s: collecting", game, args.date)
        try:
            if game == "mtg":
                scryfall.collect_prices(session, out_path)
            elif game == "pokemon":
                pokemon.collect_prices(session, out_path)
            else:
                if tcgapi_client is None:
                    tcgapi_client = tcgapi.TcgApiClient(session)
                tcgapi.collect_prices(tcgapi_client, game, out_path)
        except Exception:
            log.exception("%s date=%s: FAILED", game, args.date)
            failures.append(game)

    if tcgapi_client is not None:
        log.info("tcgapi.dev requests used this run: %d", tcgapi_client.requests_made)
    if failures:
        log.error("snapshot FAILED for: %s", ", ".join(failures))
        return 1
    log.info("snapshot complete for date=%s", args.date)
    return 0


if __name__ == "__main__":
    sys.exit(main())
