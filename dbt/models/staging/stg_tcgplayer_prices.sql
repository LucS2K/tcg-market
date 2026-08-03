-- tcgapi.dev daily snapshots (Lorcana, One Piece, Riftbound) — TCGplayer
-- market data, USD. Market price falls back to median when absent.
with raw as (
    select * from read_parquet([
        'data/game=lorcana/date=*/prices.parquet',
        'data/game=onepiece/date=*/prices.parquet',
        'data/game=riftbound/date=*/prices.parquet'
    ], hive_partitioning = true)
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
