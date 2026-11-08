"""The idempotent schema upgrade in db/schema.py, on a database that already exists."""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool

from db.schema import init_schema
from tests.conftest import TEST_DATABASE_URL

COLUMN_EXISTS = """
SELECT count(*) FROM information_schema.columns
WHERE table_name = 'search_results' AND column_name = 'id_rule'
"""


async def test_init_schema_adds_id_rule_to_an_old_table():
    engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
    try:
        # A database from before id_rule: create_all would not add the column to it.
        async with engine.begin() as conn:
            await conn.execute(text("ALTER TABLE search_results DROP COLUMN id_rule"))
        await init_schema(engine)
        await init_schema(engine)  # a second start is a no-op, not an error
        async with engine.connect() as conn:
            assert await conn.scalar(text(COLUMN_EXISTS)) == 1
    finally:
        await engine.dispose()
