-- Printing history per reprint group, the backbone of the reprint-decay
-- analysis. Riftbound is excluded by design: zero reprints as of
-- mid-2026, so it cannot contribute to the decay question; its role is
-- the pure time series in fct_daily_prices (a new game's price behavior
-- before any supply discipline exists).
select
    reprint_group_key,
    game,
    any_value(name) as name,
    count(*) as n_printings,
    min(released_at) as first_released,
    max(released_at) as last_released,
    count(distinct set_id) as n_sets,
    list(distinct set_name order by set_name) as set_names
from {{ ref('dim_cards') }}
where game != 'riftbound'
group by reprint_group_key, game
