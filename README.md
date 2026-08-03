# tcg-market

Daily market-price tracking for five trading card games — Magic: The
Gathering, Pokemon, Disney Lorcana, One Piece, and Riftbound — chosen one
per supply regime. A scheduled collector snapshots prices every day from
Scryfall, pokemontcg.io, and tcgapi.dev into Parquet partitions committed
to this repo (`data/game=<game>/date=<YYYY-MM-DD>/prices.parquet`),
alongside an on-demand reference extract of slow-changing card metadata.
Later stages will add dbt models over these partitions to study how
reprint policy shapes price decay. (To be expanded.)
