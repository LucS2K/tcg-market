-- Scryfall daily snapshot: one row per (card, finish, currency) price.
with raw as (
    select * from read_parquet('data/game=mtg/date=*/prices.parquet', hive_partitioning = true)
),

unpivoted as (
    select card_id, "date", 'nonfoil' as finish, 'USD' as currency, usd as price from raw
    union all
    select card_id, "date", 'foil', 'USD', usd_foil from raw
    union all
    select card_id, "date", 'etched', 'USD', usd_etched from raw
    union all
    select card_id, "date", 'nonfoil', 'EUR', eur from raw
    union all
    select card_id, "date", 'foil', 'EUR', eur_foil from raw
    union all
    select card_id, "date", 'nonfoil', 'TIX', tix from raw
)

select
    'mtg' as game,
    card_id,
    cast("date" as date) as snapshot_date,
    'scryfall' as source,
    finish,
    currency,
    price
from unpivoted
where price is not null
