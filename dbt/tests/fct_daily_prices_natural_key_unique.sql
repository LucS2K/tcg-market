-- One observation per (card, day, source, finish, currency). Duplicates
-- mean a collector or backfill wrote overlapping rows.
select card_key, snapshot_date, source, finish, currency, count(*) as n
from {{ ref('fct_daily_prices') }}
group by all
having count(*) > 1
