"""Reference extract entry point (on demand, never scheduled).

    python -m collector.reference [games...]

Always overwrites data/reference/game=<game>/cards.parquet for the
selected games. NOTE: for lorcana/onepiece/riftbound this uses the same
tcgapi.dev request budget as the daily snapshot (~85 requests for all
three), so do not refresh those games on the same UTC day as a snapshot.
"""
from __future__ import annotations

import argparse
import sys

from . import pokemon, scryfall, tcgapi
from .common import GAMES, log, make_session, reference_path, setup_logging


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Refresh the card reference extract.")
    parser.add_argument("games", nargs="*", default=[], metavar="game")
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
        out_path = reference_path(game)
        log.info("%s: refreshing reference extract", game)
        try:
            if game == "mtg":
                scryfall.collect_reference(session, out_path)
            elif game == "pokemon":
                pokemon.collect_reference(session, out_path)
            else:
                if tcgapi_client is None:
                    tcgapi_client = tcgapi.TcgApiClient(session)
                tcgapi.collect_reference(tcgapi_client, game, out_path)
        except Exception:
            log.exception("%s: reference refresh FAILED", game)
            failures.append(game)

    if tcgapi_client is not None:
        log.info("tcgapi.dev requests used this run: %d", tcgapi_client.requests_made)
    if failures:
        log.error("reference refresh FAILED for: %s", ", ".join(failures))
        return 1
    log.info("reference refresh complete")
    return 0


if __name__ == "__main__":
    sys.exit(main())
