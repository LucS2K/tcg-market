"""Unit tests for the pure row-shaping functions (no network)."""
from collector import pokemon, scryfall, tcgapi


def test_scryfall_price_row():
    card = {"id": "abc", "prices": {"usd": "1.50", "usd_foil": None, "eur": "0.90", "tix": "0.02"}}
    row = scryfall.price_row(card)
    assert row == {
        "card_id": "abc",
        "usd": 1.5,
        "usd_foil": None,
        "usd_etched": None,
        "eur": 0.9,
        "eur_foil": None,
        "tix": 0.02,
    }


def test_scryfall_ref_row_double_faced_uses_first_face_image():
    card = {
        "id": "abc",
        "oracle_id": "o-1",
        "name": "Delver of Secrets // Insectile Aberration",
        "collector_number": "51",
        "rarity": "common",
        "set": "isd",
        "set_name": "Innistrad",
        "released_at": "2011-09-30",
        "artist": "Nils Hamm",
        "card_faces": [{"image_uris": {"normal": "https://img/front.jpg"}}, {}],
    }
    row = scryfall.ref_row(card)
    assert row["image_url"] == "https://img/front.jpg"
    assert row["set_id"] == "isd"
    assert row["number"] == "51"


def test_pokemon_price_rows_tcgplayer_and_cardmarket():
    card = {
        "id": "sv1-1",
        "tcgplayer": {
            "prices": {
                "holofoil": {"low": 1.0, "mid": 2.0, "high": 3.0, "market": 1.8, "directLow": None}
            }
        },
        "cardmarket": {
            "prices": {"averageSellPrice": 1.7, "lowPrice": 0.9, "trendPrice": 1.6}
        },
    }
    rows = pokemon.price_rows(card)
    assert len(rows) == 2
    tp = next(r for r in rows if r["source"] == "tcgplayer")
    assert tp["variant"] == "holofoil"
    assert tp["market"] == 1.8
    assert tp["currency"] == "USD"
    cm = next(r for r in rows if r["source"] == "cardmarket")
    assert cm["trend"] == 1.6
    assert cm["currency"] == "EUR"


def test_pokemon_price_rows_no_prices():
    assert pokemon.price_rows({"id": "x"}) == []


def test_pokemon_ref_row_normalizes_release_date():
    card = {
        "id": "sv1-1",
        "name": "Sprigatito",
        "number": "1",
        "rarity": "Common",
        "set": {"id": "sv1", "name": "Scarlet & Violet", "releaseDate": "2023/03/31"},
        "images": {"large": "https://img/sv1-1.png"},
        "artist": "Someone",
    }
    row = pokemon.ref_row(card)
    assert row["released_at"] == "2023-03-31"
    assert row["image_url"] == "https://img/sv1-1.png"


def test_tcgapi_price_rows_flat_shape():
    card = {"id": 99, "printing": "Foil", "market_price": "12.34", "low_price": 10, "median_price": None}
    rows = tcgapi.card_price_rows(card)
    assert rows == [
        {
            "card_id": "99",
            "printing": "Foil",
            "currency": "USD",
            "market_price": 12.34,
            "low_price": 10.0,
            "median_price": None,
            "lowest_with_shipping": None,
        }
    ]


def test_tcgapi_price_rows_nested_shape():
    card = {
        "id": 7,
        "prices": [
            {"printing": "Normal", "market_price": 1.0},
            {"printing": "Foil", "market_price": 5.0, "low_price": 4.5},
        ],
    }
    rows = tcgapi.card_price_rows(card)
    assert [r["printing"] for r in rows] == ["Normal", "Foil"]
    assert rows[1]["low_price"] == 4.5


def test_tcgapi_price_rows_no_price_fields():
    assert tcgapi.card_price_rows({"id": 1, "name": "Luffy"}) == []


def test_tcgapi_has_more():
    assert tcgapi._has_more({"has_more": True}, page=1, page_len=100)
    assert not tcgapi._has_more({"has_more": False}, page=1, page_len=100)
    assert tcgapi._has_more({"total": 250, "per_page": 100}, page=2, page_len=100)
    assert not tcgapi._has_more({"total": 250, "per_page": 100}, page=3, page_len=50)
    assert not tcgapi._has_more({}, page=1, page_len=47)
