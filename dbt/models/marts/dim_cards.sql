-- One row per printing per game, with the key used to group printings of
-- the same underlying card for the reprint analysis.
--
-- reprint_group_key:
--   mtg     -> oracle_id (exact lineage, provided by Scryfall)
--   others  -> game + lowercased name (heuristic: same-name cards are
--              treated as printings of one card; distinct cards sharing a
--              name will over-group — acceptable, and the best available
--              without an oracle-id equivalent)
select
    game || ':' || card_id as card_key,
    game,
    card_id,
    oracle_id,
    name,
    number,
    rarity,
    set_id,
    set_name,
    released_at,
    image_url,
    artist,
    case
        when game = 'mtg' and oracle_id is not null then 'mtg:' || oracle_id
        else game || ':name:' || lower(name)
    end as reprint_group_key
from {{ ref('stg_cards') }}
