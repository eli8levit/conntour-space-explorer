"""Create the schema without migrations.

Why no Alembic: the schema is created once from the models, and every statement here is
idempotent, so running it on each start is safe. The first production step would be
Alembic, so schema changes become reviewed, versioned migrations instead of create_all
(which never alters an existing table).
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


async def init_schema(engine: AsyncEngine) -> None:
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.execute(text(IMMUTABLE_ARRAY_TO_STRING))
        await conn.run_sync(Base.metadata.create_all)
