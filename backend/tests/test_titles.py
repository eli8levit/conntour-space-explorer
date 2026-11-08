"""data/titles.json is hand-written; these checks keep it complete and display-ready."""

import json
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from scripts.seed_db import seed
from tests.conftest import TEST_DATABASE_URL, FakeEmbedder

DATA = Path(__file__).resolve().parent.parent / "data"
MAX_SHORT_TITLE = 34  # fits a caption chip on the A1 canvas


def test_every_image_has_exactly_one_title():
    items = json.loads((DATA / "mock_data.json").read_text())["collection"]["items"]
    nasa_ids = [item["data"][0]["nasa_id"].strip() for item in items]
    title_ids = [entry["nasa_id"] for entry in json.loads((DATA / "titles.json").read_text())]
    assert sorted(title_ids) == sorted(nasa_ids)
    assert len(set(title_ids)) == len(title_ids)


async def test_every_source_has_a_short_title(client):
    response = await client.get("/api/sources", params={"limit": 100})
    sources = response.json()["items"]
    assert len(sources) == 100
    for source in sources:
        short = source["short_title"]
        assert short and short.strip() == short, source["nasa_id"]
        assert len(short) <= MAX_SHORT_TITLE, (source["nasa_id"], short)
        # Sentence case: never a shouting caption.
        assert short != short.upper() or len(short) <= 4, (source["nasa_id"], short)


async def test_places_carry_the_short_title(client):
    pins = (await client.get("/api/places")).json()
    assert all(pin["short_title"] for pin in pins)


async def test_credit_is_photographer_else_secondary_creator(client):
    sources = (await client.get("/api/sources", params={"limit": 100})).json()["items"]
    by_id = {source["nasa_id"]: source for source in sources}
    # No photographer: the credit comes from secondary_creator.
    assert by_id["PIA22505"]["credit"] == "NASA/JPL-Caltech/ASU"
    assert by_id["PIA22505"]["short_title"] == "Gale Crater"
    # A photographer wins.
    assert by_id["NHQ202102170001"]["credit"] == "NASA/Bill Ingalls"
    # Neither field in the record.
    assert by_id["KSC-04pd1644"]["credit"] is None


async def test_seed_adds_the_new_columns_to_an_older_database():
    """A database created before short_title/credit existed gets them on the next start."""
    engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
    try:
        async with engine.begin() as conn:
            await conn.execute(
                text("ALTER TABLE sources DROP COLUMN short_title, DROP COLUMN credit")
            )
        await seed(engine, async_sessionmaker(engine, expire_on_commit=False), FakeEmbedder())
        async with engine.connect() as conn:
            missing = await conn.scalar(
                text("SELECT count(*) FROM sources WHERE short_title IS NULL")
            )
            credit = await conn.scalar(
                text("SELECT credit FROM sources WHERE nasa_id = 'PIA22505'")
            )
        assert missing == 0
        assert credit == "NASA/JPL-Caltech/ASU"
    finally:
        await engine.dispose()
