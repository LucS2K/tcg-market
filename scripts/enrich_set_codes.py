"""Fill reference set_code from TCGCSV group abbreviations.

tcgapi.dev's sets list returns no abbreviation, but TCGplayer group
data (mirrored free by TCGCSV) has one, and tcgapi's set names are the
same TCGplayer group names. Matches on exact name, rewrites the
reference parquet in place. Idempotent.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from collector.common import log, make_session, reference_path, setup_logging  # noqa: E402
from backfill_tcgcsv import resolve_categories  # noqa: E402

GROUPS_URL = "https://tcgcsv.com/tcgplayer/{cat}/groups"


def usable(abbr: str | None) -> bool:
    return bool(abbr) and any(ch.isalpha() for ch in abbr)


def initials(set_name: str) -> str | None:
    """Fallback code from word initials: "The First Chapter" -> TFC."""
    letters = [w[0] for w in set_name.split() if w and w[0].isalnum()]
    return "".join(letters[:4]).upper() or None


def main() -> int:
    setup_logging()
    session = make_session()
    categories = resolve_categories(session)
    # Only the tcgapi-sourced games carry a set_code column.
    categories = {g: c for g, c in categories.items() if g in ("onepiece", "lorcana", "riftbound")}
    failures = 0
    for game, cat in categories.items():
        resp = session.get(GROUPS_URL.format(cat=cat), timeout=(10, 60))
        resp.raise_for_status()
        by_name = {
            g["name"]: (g["abbreviation"] if usable(g.get("abbreviation")) else initials(g["name"]))
            for g in resp.json()["results"]
        }
        path = reference_path(game)
        table = pq.read_table(path)
        set_names = table.column("set_name").to_pylist()
        old_codes = table.column("set_code").to_pylist()
        new_codes = [
            by_name.get(n) or (old if usable(old) else initials(n or ""))
            for n, old in zip(set_names, old_codes)
        ]
        filled = sum(1 for c in new_codes if c) - sum(1 for c in old_codes if c)
        idx = table.schema.get_field_index("set_code")
        table = table.set_column(idx, pa.field("set_code", pa.string()), pa.array(new_codes, pa.string()))
        pq.write_table(table, path, compression="zstd")
        missing = sum(1 for c in new_codes if not c)
        log.info("%s: filled %d set codes, %d rows still without", game, filled, missing)
        if filled == 0 and missing == len(new_codes):
            failures += 1
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
