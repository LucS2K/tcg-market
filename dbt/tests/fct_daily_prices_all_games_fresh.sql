-- Every game must have rows on the latest snapshot date. A missing game
-- means its collection failed while others succeeded.
with latest as (
    select max(snapshot_date) as d from {{ ref('fct_daily_prices') }}
)

select expected.game
from (
    values ('mtg'), ('pokemon'), ('lorcana'), ('onepiece'), ('riftbound')
) as expected(game)
where not exists (
    select 1
    from {{ ref('fct_daily_prices') }} f, latest
    where f.game = expected.game
      and f.snapshot_date = latest.d
)
