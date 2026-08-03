-- tcgapi.dev daily snapshots (Lorcana, One Piece, Riftbound): TCGplayer
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
    -- Same illiquidity guard as stg_tcgcsv_history: distrust a market
    -- price sitting below 10% of mid.
    case
        when market_price is not null and median_price is not null
             and (market_price < 0.1 * median_price or market_price > 10 * median_price) then median_price
        else coalesce(market_price, median_price)
    end as price
from raw
where coalesce(market_price, median_price) is not null

