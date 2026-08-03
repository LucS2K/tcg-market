-- All games, one row per (card, day, source, finish, currency) price
-- observation. Grows by one date partition per game per day.
with unioned as (
    select * from {{ ref('stg_mtg_prices') }}
    union all
    select * from {{ ref('stg_pokemon_prices') }}
    union all
    select * from {{ ref('stg_tcgplayer_prices') }}
    union all
    select * from {{ ref('stg_tcgcsv_history') }}
)

select
    game || ':' || card_id as card_key,
    game,
    card_id,
    snapshot_date,
    source,
    finish,
    currency,
    price
from unioned
