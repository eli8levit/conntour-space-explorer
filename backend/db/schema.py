"""Create the schema without migrations.

Why no Alembic: the schema is created once from the models, and every statement here is
idempotent, so running it on each start is safe. create_all never alters an existing
table, so columns added after the first release get an explicit
`ALTER TABLE ... ADD COLUMN IF NOT EXISTS` below. That is a stopgap for a demo: the
production path is Alembic, so schema changes become reviewed, versioned migrations.
"""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from db.models import Base

# array_to_string is STABLE (its output depends on type output functions), so Postgres
# refuses it inside a generated column. For text[] the result never changes, so wrapping
# it as IMMUTABLE is safe.
IMMUTABLE_ARRAY_TO_STRING = """
CREATE OR REPLACE FUNCTION immutable_array_to_string(arr text[], sep text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$ SELECT array_to_string(arr, sep) $$
"""

# Columns and indexes added after the first release. create_all creates them on a fresh
# database; these statements add them to a database created before they existed. The
# columns are nullable, so adding them never fails on existing rows; the seed fills them.
SCHEMA_UPGRADES = (
    "ALTER TABLE sources ADD COLUMN IF NOT EXISTS short_title text",
    "ALTER TABLE sources ADD COLUMN IF NOT EXISTS credit text",
    # Searches stored before this column existed keep NULL: their scores had no ID note.
    "ALTER TABLE search_results ADD COLUMN IF NOT EXISTS id_rule text",
    # Indexes too: create_all skips indexes of a table that already exists.
    "CREATE INDEX IF NOT EXISTS ix_search_results_source_id ON search_results (source_id)",
)


async def init_schema(engine: AsyncEngine) -> None:
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.execute(text(IMMUTABLE_ARRAY_TO_STRING))
        await conn.run_sync(Base.metadata.create_all)
        for statement in SCHEMA_UPGRADES:
            await conn.execute(text(statement))
