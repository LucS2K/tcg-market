"""Riftbound reprint watch.

Riftbound's analytical role (see CLAUDE.md) is the before/after series
if Riot ever meaningfully reprints. This script flags any card name
appearing in more than one non-promo set, compared against a committed
baseline. Run after dbt build; prints REPRINT_DETECTED lines for the
workflow to turn into a GitHub issue. First run writes the baseline.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import duckdb

REPO_ROOT = Path(__file__).resolve().parent.parent
BASELINE = REPO_ROOT / "scripts" / "riftbound_reprint_baseline.json"
PROMO_PATTERN = "promo|organized|judge|prize|championship|event|top 8|deck"


def main() -> int:
    con = duckdb.connect(str(REPO_ROOT / "dbt" / "tcg.duckdb"), read_only=True)
    rows = con.sql(f"""
        select name, list(distinct set_name order by set_name)
        from dim_cards
        where game = 'riftbound'
          and product_type != 'Sealed Products'
          and not regexp_matches(lower(set_name), '{PROMO_PATTERN}')
        group by name
        having count(distinct set_id) > 1
    """).fetchall()
    current = {name: sorted(sets) for name, sets in rows}

    if not BASELINE.exists():
        BASELINE.write_text(json.dumps(current, indent=1, sort_keys=True), encoding="utf-8")
        print(f"baseline written: {len(current)} pre-existing multi-set names")
        return 0

    baseline = json.loads(BASELINE.read_text(encoding="utf-8"))
    new = {
        name: sets for name, sets in current.items()
        if name not in baseline or set(sets) - set(baseline[name])
    }
    if not new:
        print("no new riftbound reprints")
        return 0
    for name, sets in sorted(new.items()):
        print(f"REPRINT_DETECTED: {name} -> {', '.join(sets)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
