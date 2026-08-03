# tcg-market

Daily price-tracking pipeline for trading card games. Raw price snapshots
are collected once a day, stored as Parquet partitions committed to this
repo, and (in stage 2) modeled with dbt to study how reprint policy shapes
price decay.

## Stage roadmap

- Stage 1 (this stage): the collector. Daily snapshots from all sources,
  Parquet partitions in `data/`, scheduled GitHub Actions workflow,
  idempotent per date, loud failures.
- Stage 2 (in progress): dbt project in `dbt/` on dbt-duckdb, run from
  the repo root with `dbt build --project-dir dbt --profiles-dir dbt`.
  Staging views normalize the three per-game price schemas into
  `fct_daily_prices` (one row per card/day/source/finish/currency);
  `dim_cards` assigns `reprint_group_key` (MTG: oracle_id; others:
  game + lowercased name, a documented heuristic); `reprint_lineage`
  aggregates printing history, excluding Riftbound per the roster
  table. The decay analysis itself needs accumulated daily history.
- Stage 3 (site live): "NeighborsTCG" (React + Vite in `site/`; brand
  renamed from the handoff's "Binder" on 2026-08-03), deployed to
  Vercel at https://neighborstcg.vercel.app (project neighborstcg,
  team woongy; VERCEL_* repo secrets) by the `deploy-site` workflow —
  triggered by pushes touching site/scripts/dbt, manual dispatch, and
  as a job after each daily snapshot (bot pushes don't trigger push
  workflows). The same workflow mirrors the dbt marts to MotherDuck
  (`md:tcg_market`, MOTHERDUCK_TOKEN secret, `--target md`). GitHub
  Pages was the original host, retired 2026-08-03 in favor of Vercel.
  `scripts/export_site_data.py` turns the dbt marts into static JSON
  (search unit = reprint group; card scans hotlinked with artist
  credit per the imagery policy). Design handoff lives untracked in
  `design/`. Site features: browse pages with filter/sort, sealed
  shelf (#/sealed), local-storage binder with binder-code
  backup/sharing (#/binder), chart ranges 12w/1y/all (history in
  lazily-fetched hist/ shards), EUR display where Cardmarket data
  exists.
- Stage 4 (preliminary, live): #/analysis — fixed-basket market index
  per game and median reprint-decay curves from the backfilled
  history, recomputed at every export. Pokemon's curve is flagged
  unreliable (name-based lineage). A daily reprint-watch job compares
  Riftbound against scripts/riftbound_reprint_baseline.json and opens
  a GitHub issue when Riot's first real reprint lands.

## Roster: closed at five games

Magic, Pokemon, Lorcana, One Piece, Riftbound — one game per supply
regime. Do not add more: additional games add collection and
identity-mapping cost without adding a supply posture not already
represented.

| game key    | source           | stage 2 reprint analysis |
|-------------|------------------|--------------------------|
| `mtg`       | Scryfall bulk    | included (decades-long reprint history) |
| `pokemon`   | pokemontcg.io    | included |
| `lorcana`   | tcgapi.dev       | INCLUDED — full scarcity-shock-and-supply-response cycle compressed into ~3 years (launch Aug 2023, aggressive Ravensburger reprints through 2024). Confound to name in the analysis: first-year prices carried speculative Disney-collector demand distinct from play demand. State it, do not model around it. |
| `onepiece`  | tcgapi.dev       | included |
| `riftbound` | tcgapi.dev       | EXCLUDED — Riot's LoL TCG, launched late 2025, five sets as of mid-2026, zero reprints, hype-phase pricing. No reprint history, so it cannot contribute to the decay question. Its role is the time series: a new game's price behavior before any supply discipline exists, and the before/after series if Riot's first meaningful reprint lands while we are collecting. |

## Data sources

- MTG: Scryfall bulk data (`default_cards` file). No API key. Requires a
  descriptive User-Agent and Accept header.
- Pokemon: pokemontcg.io `/v2/cards`, paginated. `POKEMONTCG_API_KEY` env
  var optional but raises rate limits; without it the collector paces
  requests to stay under anonymous limits.
- Lorcana / One Piece / Riftbound: tcgapi.dev Hobby tier ($9.99/mo,
  1,000 requests/day account-wide, resets midnight UTC), `TCGAPI_KEY`
  env var REQUIRED. Set-level price dumps and bulk export are higher
  tiers, so the path is `/v1/sets?game=X` then `/v1/sets/:id/cards`
  paginated at `per_page=100`, reading price fields off each card
  object. Measured cost: ~190 requests for a full three-game snapshot
  (Lorcana 20 sets ≈ 49, One Piece 83 sets ≈ 122, Riftbound 8 sets ≈ 19),
  so a snapshot and a reference refresh fit in the same day with room to
  spare. The free tier (100/day) does NOT fit — the roster's floor is
  ≥1 request per set ≈ 113/day. The collector counts requests and fails
  loudly on 429. Hobby also includes 7-day price history, but it is
  per-card (~11.7k cards ≈ 12 days of budget per full pull), so it is a
  spot-check/gap-repair tool only, not a collection path.

## Data layout

- Daily snapshots: `data/game=<game>/date=<YYYY-MM-DD>/prices.parquet`.
  Price and identity fields only (card id + price columns). Game keys:
  `mtg`, `pokemon`, `lorcana`, `onepiece`, `riftbound`.
- Reference extract: `data/reference/game=<game>/cards.parquet`. Card
  metadata that rarely changes: name, rarity, set, released_at, oracle_id
  (or per-game equivalent), image URL column, artist. Refreshed on demand
  via `workflow_dispatch`, never on the daily schedule.

## Collector conventions

- Idempotent per date: if a partition file already exists for the target
  date, the collector skips that game (no rewrite, no diff). `--force`
  overwrites.
- Fail loudly: any source error logs a traceback and the run exits
  non-zero. No silent partial success — but games that already wrote
  their partition are skipped on re-run, so a failed run can be retried
  and only the missing games are fetched.
- Parquet files are written to a temp file and atomically renamed, so a
  crash never leaves a corrupt partition.

### Card imagery

- Image URLs (Scryfall image_uris.normal, pokemontcg.io images.large, One
  Piece equivalent) are captured as columns in the reference extract only.
- Images are NEVER downloaded, stored in the repo, or written to Parquet.
  The site hotlinks source CDNs lazily at view time.
- Attribution: card images copyright their respective publishers (Wizards
  of the Coast, The Pokemon Company, Bandai); the site footer carries the
  fan-content attribution each source requires. Artist names are available
  per card from Scryfall and should display where imagery displays.
