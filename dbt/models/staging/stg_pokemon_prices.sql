-- pokemontcg.io daily snapshot. TCGplayer rows are per print variant in
-- USD; Cardmarket rows are card-level EUR (trend price, falling back to
-- average sell).
with raw as (
    select * from read_parquet('data/game=pokemon/date=*/prices.parquet', hive_partitioning = true)
)

select
    'pokemon' as game,
    card_id,
    cast("date" as date) as snapshot_date,
    source,
    coalesce(variant, 'default') as finish,
    currency,
    case source
        when 'tcgplayer' then coalesce(market, mid)
        else coalesce(trend, avg_sell)
    end as price
from raw
where case source
        when 'tcgplayer' then coalesce(market, mid)
        else coalesce(trend, avg_sell)
    end is not null
