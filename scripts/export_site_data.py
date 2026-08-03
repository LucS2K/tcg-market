"""Export site JSON from the dbt marts.

Run after `dbt build` from the repo root:

    python scripts/export_site_data.py

Writes site/public/data/:
  meta.json            snapshot date + generation time
  sets.json            recent sets across games
  index-<game>.json    search index, one entry per reprint group
  cards/<shard>.json   card detail shards (hash(gid) % NUM_SHARDS)

The site's unit is the reprint group (dim_cards.reprint_group_key): one
searchable card whose detail page carries every printing. The headline
printing is the most recently released one with a price. Sparklines and
7-day changes appear automatically as daily partitions accumulate; on
day one the spark is a single point and change is null.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import re
from collections import defaultdict
from pathlib import Path

import duckdb

REPO_ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = REPO_ROOT / "site" / "public" / "data"
NUM_SHARDS = 64
SPARK_POINTS = 12

# Headline price: USD, preferring the plainest finish per game.
FINISH_RANK = """
    case finish
        when 'nonfoil' then 0 when 'normal' then 0 when 'default' then 0
        when 'holofoil' then 1 when 'foil' then 2 when 'etched' then 3
        else 4
    end
"""

CONDITION_LADDERS = {
    "pokemon": [("PSA 10", 3.0), ("PSA 9", 1.6), ("Raw · Near Mint", 1.0), ("Raw · Played", 0.6)],
    "default": [("Near Mint", 1.0), ("Lightly Played", 0.84), ("Moderately Played", 0.68), ("Heavily Played", 0.48)],
}


def gid_for(group_key: str) -> str:
    return hashlib.sha1(group_key.encode("utf-8")).hexdigest()[:10]


def shard_for(gid: str) -> int:
    return int(gid, 16) % NUM_SHARDS


def blurb_for(game: str, name: str, n_printings: int, price: float) -> str:
    if game == "riftbound":
        return "Brand-new game, zero reprints so far. History in progress."
    if n_printings >= 20:
        return f"Reprinted {n_printings} times and the market has feelings about it."
    if n_printings > 1:
        return f"{n_printings} printings and counting."
    if price >= 100:
        return "One printing, one very confident price tag."
    return "One printing. That's the whole story so far."


def tag_for(released: dt.date | None, today: dt.date) -> str:
    if released is None:
        return "New"
    age = (today - released).days
    if age <= 45:
        return "Brand new"
    if age <= 120:
        return "Fresh ink"
    return "Recent"


def main() -> None:
    con = duckdb.connect(str(REPO_ROOT / "dbt" / "tcg.duckdb"), read_only=True)
    today = dt.date.today()

    snapshot_date = con.sql("select max(snapshot_date) from fct_daily_prices").fetchone()[0]

    # Latest USD price per printing (best finish), plus a 7-day-ago price
    # for change when history exists.
    con.execute(f"""
        create temp table latest as
        select card_key, game, card_id, finish, price, snapshot_date
        from (
            select *, row_number() over (
                partition by card_key
                order by snapshot_date desc, {FINISH_RANK}, price desc
            ) as rn
            from fct_daily_prices
            where currency = 'USD'
        ) where rn = 1
    """)
    # "Week ago" = the snapshot closest to seven days back within a
    # -10..-4 day window, so one missed collection day doesn't blank
    # every change badge.
    con.execute("""
        create temp table week_ago as
        select card_key, finish, price
        from (
            select *, row_number() over (
                partition by card_key, finish
                order by
                    abs(datediff('day', snapshot_date,
                        (select max(snapshot_date) - 7 from fct_daily_prices))),
                    price desc
            ) as rn
            from fct_daily_prices
            where currency = 'USD'
              and snapshot_date between (select max(snapshot_date) - 10 from fct_daily_prices)
                                    and (select max(snapshot_date) - 4 from fct_daily_prices)
        ) where rn = 1
    """)

    # Spark history per printing: weekly-ish sample of the last 84 days.
    # History follows the same finish as the headline price so charts
    # never mix foil and non-foil readings.
    spark_rows = con.sql("""
        select f.card_key, f.snapshot_date, f.price
        from (
            select *, row_number() over (
                partition by card_key, snapshot_date, finish
                order by price desc
            ) as rn
            from fct_daily_prices
            where currency = 'USD'
              and snapshot_date > (select max(snapshot_date) - 84 from fct_daily_prices)
        ) f
        join latest l on l.card_key = f.card_key and l.finish = f.finish
        where f.rn = 1
        order by f.card_key, f.snapshot_date
    """).fetchall()
    history: dict[str, list[float]] = defaultdict(list)
    for card_key, _d, price in spark_rows:
        history[card_key].append(round(price, 2))

    cards = con.sql("""
        select
            d.reprint_group_key, d.game, d.card_key, d.card_id, d.name,
            d.number, d.rarity, d.set_code, d.set_name, d.released_at,
            d.image_url, d.artist,
            l.price,
            w.price as week_ago_price,
            rl.n_printings
        from dim_cards d
        join latest l on l.card_key = d.card_key
        left join week_ago w on w.card_key = d.card_key and w.finish = l.finish
        left join reprint_lineage rl on rl.reprint_group_key = d.reprint_group_key
        where d.name is not null
          and d.product_type != 'Sealed Products'
    """).fetchall()
    columns = [
        "group_key", "game", "card_key", "card_id", "name", "number", "rarity",
        "set_code", "set_name", "released_at", "image_url", "artist", "price",
        "week_ago_price", "n_printings",
    ]

    groups: dict[str, list[dict]] = defaultdict(list)
    for row in cards:
        rec = dict(zip(columns, row))
        groups[rec["group_key"]].append(rec)

    # Stand-in art for variant printings whose own product photo is
    # missing upstream (common for Organized Play promos): the base-name
    # card usually carries the same illustration. Same source CDN only.
    def base_name(name: str) -> str:
        return re.sub(r"\s*\([^)]*\)", "", name or "").strip().lower()

    name_image: dict[tuple, str] = {}
    for rows_ in groups.values():
        for rec in rows_:
            key = (rec["game"], base_name(rec["name"]))
            if rec["image_url"] and key not in name_image:
                name_image[key] = rec["image_url"]

    index_by_game: dict[str, list] = defaultdict(list)
    shards: dict[int, dict] = defaultdict(dict)
    detail_by_gid: dict[str, dict] = {}

    for group_key, printings in groups.items():
        printings.sort(key=lambda r: (r["released_at"] or dt.date.min, r["price"] or 0), reverse=True)
        head = printings[0]
        gid = gid_for(group_key)
        game = head["game"]
        price = round(head["price"], 2)
        change = None
        if head["week_ago_price"]:
            ratio = head["price"] / head["week_ago_price"]
            # A >10x weekly move in aggregate market data is nearly always
            # a source glitch (placeholder listings, thin-market
            # marketPrice), not signal. Suppress the badge, keep the card.
            if 0.1 <= ratio <= 10:
                change = round((ratio - 1) * 100, 1)

        spark = history.get(head["card_key"], [price])
        if len(spark) > SPARK_POINTS:
            step = len(spark) / SPARK_POINTS
            spark = [spark[int(i * step)] for i in range(SPARK_POINTS - 1)] + [spark[-1]]

        code = f"{(head['set_code'] or '').upper()} · {head['number'] or '?'}"
        n_printings = int(head["n_printings"] or len(printings))

        index_by_game[game].append([
            gid, head["name"], head["set_name"], code, head["rarity"] or "", price, change,
        ])

        ladder = CONDITION_LADDERS["pokemon"] if game == "pokemon" else CONDITION_LADDERS["default"]
        detail = {
            "id": gid,
            "game": game,
            "name": head["name"],
            "set": head["set_name"],
            "code": code,
            "rarity": head["rarity"] or "",
            "price": price,
            "change": change,
            "spark": spark,
            "image": head["image_url"],
            "images": list(dict.fromkeys(
                [u for u in (
                    head["image_url"],
                    *(p["image_url"] for p in printings),
                    name_image.get((game, base_name(head["name"]))),
                ) if u]
            ))[:4],
            "artist": head["artist"],
            "blurb": blurb_for(game, head["name"], n_printings, price),
            "printings": [
                {
                    "set": p["set_name"],
                    "year": p["released_at"].year if p["released_at"] else None,
                    "code": f"{(p['set_code'] or '').upper()} · {p['number'] or '?'}",
                    "price": round(p["price"], 2) if p["price"] is not None else None,
                    "current": p is head,
                }
                for p in reversed(printings)  # oldest first on the timeline
            ],
            "conditions": [[label, round(price * mult, 2)] for label, mult in ladder],
        }
        detail_by_gid[gid] = detail
        shards[shard_for(gid)][gid] = detail

    # Related: nearest-priced groups in the same game and set.
    by_set: dict[tuple, list] = defaultdict(list)
    for gid, det in detail_by_gid.items():
        by_set[(det["game"], det["set"])].append((det["price"], gid))
    for det in detail_by_gid.values():
        pool = sorted(by_set[(det["game"], det["set"])])
        me = det["id"]
        ranked = sorted(pool, key=lambda t: abs(t[0] - det["price"]))
        det["related"] = [g for _p, g in ranked if g != me][:3]

    # Recent sets across games.
    sets_rows = con.sql("""
        select game, set_code, set_name, min(released_at) as released, count(*) as n_cards
        from dim_cards
        where released_at is not null and released_at <= current_date
          and product_type != 'Sealed Products'
        group by game, set_code, set_name
        order by released desc
        limit 12
    """).fetchall()
    sets_out = [
        {
            "game": g,
            "name": name,
            "code": (set_code or "").upper(),
            "released": rel.strftime("%b %Y"),
            "cards": n,
            "tag": tag_for(rel, today),
        }
        for g, set_code, name, rel, n in sets_rows
    ]

    out = OUT_DIR
    (out / "cards").mkdir(parents=True, exist_ok=True)
    (out / "meta.json").write_text(json.dumps({
        "snapshot_date": str(snapshot_date),
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "num_shards": NUM_SHARDS,
        "games": sorted(index_by_game),
    }), encoding="utf-8")
    (out / "sets.json").write_text(json.dumps(sets_out), encoding="utf-8")
    for game, entries in index_by_game.items():
        entries.sort(key=lambda e: -(e[5] or 0))
        (out / f"index-{game}.json").write_text(json.dumps(entries, separators=(",", ":")), encoding="utf-8")

    # Home-screen movers without loading full indexes: top 8 per game and
    # overall, by |7d change| when history exists, else by price.
    def mover_rank(entry):
        change = entry[6]
        return (0, -abs(change)) if change is not None else (1, -(entry[5] or 0))

    # Movers exclude sub-$2 cards: percentage ranking otherwise drowns
    # in penny-card noise ($0.30 -> $5 is +1600%).
    trending = {}
    all_entries = []
    for game, entries in index_by_game.items():
        eligible = [e for e in entries if (e[5] or 0) >= 2]
        ranked = sorted(eligible, key=mover_rank)[:8]
        trending[game] = [e + [game] for e in ranked]
        all_entries.extend(e + [game] for e in eligible)
    # "All games" view: at most 2 per game so one game's outliers don't
    # monopolize the grid, then fill any remaining slots by global rank.
    ranked_all = sorted(all_entries, key=mover_rank)
    picked, per_game = [], defaultdict(int)
    for e in ranked_all:
        if per_game[e[7]] < 2:
            picked.append(e)
            per_game[e[7]] += 1
        if len(picked) == 8:
            break
    for e in ranked_all:
        if len(picked) == 8:
            break
        if e not in picked:
            picked.append(e)
    trending["all"] = picked
    has_changes = any(e[6] is not None for e in all_entries)
    trending["has_changes"] = has_changes
    (out / "trending.json").write_text(json.dumps(trending, separators=(",", ":")), encoding="utf-8")
    for shard_id, payload in shards.items():
        (out / "cards" / f"{shard_id}.json").write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")

    total_groups = sum(len(v) for v in index_by_game.values())
    print(f"snapshot_date={snapshot_date} groups={total_groups} shards={len(shards)}")
    for game, entries in sorted(index_by_game.items()):
        size = (out / f"index-{game}.json").stat().st_size
        print(f"  {game}: {len(entries)} groups, index {size/1024:.0f} KiB")


if __name__ == "__main__":
    main()
