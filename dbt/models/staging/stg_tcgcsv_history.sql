-- TCGplayer historical prices (TCGCSV archives) for games whose forward
-- snapshots use a different source schema: MTG and Pokemon live under
-- data/backfill/ so their history doesn't collide with the Scryfall /
-- pokemontcg.io daily layouts. Backfill dates end where daily
-- collection begins (2026-08-03), so the two never overlap.
with raw as (
    select * from read_parquet(
        'data/backfill/game=*/date=*/prices.parquet',
        hive_partitioning = true
    )
)

select
    game,
    card_id,
    cast("date" as date) as snapshot_date,
    'tcgplayer' as source,
    lower(coalesce(printing, 'normal')) as finish,
    currency,
    coalesce(market_price, median_price) as price
from raw
where coalesce(market_price, median_price) is not null
