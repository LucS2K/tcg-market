-- Reference extracts for all games. union_by_name fills columns a game
-- lacks (e.g. oracle_id outside MTG, artist for tcgapi games) with null.
select
    game,
    card_id,
    oracle_id,
    name,
    number,
    rarity,
    set_id,
    set_code,
    set_name,
    cast(nullif(released_at, '') as date) as released_at,
    image_url,
    artist,
    tcgplayer_id,
    product_type
from read_parquet(
    'data/reference/game=*/cards.parquet',
    hive_partitioning = true,
    union_by_name = true
)
