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
    -- Era-consistent finishes: match each game's forward-snapshot
    -- naming ('nonfoil' for MTG per Scryfall; space-stripped lowercase
    -- for Pokemon per pokemontcg.io variants).
    case
        when game = 'mtg' and lower(coalesce(printing, 'normal')) = 'normal' then 'nonfoil'
        else replace(lower(coalesce(printing, 'normal')), ' ', '')
    end as finish,
    currency,
    -- TCGplayer's marketPrice glitches on illiquid products (e.g. $0.99
    -- against a $2,000 mid). When market sits below 10% of mid, mid is
    -- the more honest reading.
    case
        when market_price is not null and median_price is not null
             and (market_price < 0.1 * median_price or market_price > 10 * median_price) then median_price
        else coalesce(market_price, median_price)
    end as price
from raw
where coalesce(market_price, median_price) is not null

