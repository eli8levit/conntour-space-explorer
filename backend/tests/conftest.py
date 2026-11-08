"""Test setup: a real Postgres (the compose `db` service) with a separate database.

Run from backend/ with the stack up:  uv run pytest
The database `space_explorer_test` is created and re-seeded on every run, so the dev
data and history are never touched. No model download: FakeEmbedder stands in.
"""

import asyncio
import hashlib
import math
import os
import re
from collections.abc import AsyncIterator, Sequence

import asyncpg
import httpx
import pytest
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app import app
from config import EMBEDDING_DIM
from controllers.dependencies import get_embedder
from db import Base, get_db
from scripts.seed_db import seed
from services.embedding import Embedder, EmbedderName

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5433/space_explorer_test",
)


class FakeEmbedder:
    """Deterministic bag-of-words vectors: texts that share words get a high cosine.
    Enough to test the plumbing of semantic search without a 90 MB model."""

    name: EmbedderName = "minilm"

    def _vector(self, text: str) -> list[float]:
        vector = [0.0] * EMBEDDING_DIM
        for word in re.findall(r"[a-z0-9]+", text.lower()):
            bucket = int(hashlib.md5(word.encode()).hexdigest(), 16) % EMBEDDING_DIM
            vector[bucket] += 1.0
        norm = math.sqrt(sum(v * v for v in vector)) or 1.0
        return [v / norm for v in vector]

    def embed_query(self, text: str) -> list[float] | None:
        return self._vector(text)

    def embed_documents(self, texts: Sequence[str]) -> list[list[float]]:
        return [self._vector(text) for text in texts]

    def knows_any_word(self, text: str) -> bool:
        # Stand-in for a vocabulary: words made of letters with a vowel, under 12 letters.
        return any(
            re.search(r"[aeiou]", word) and len(word) < 12
            for word in re.findall(r"[a-z]+", text.lower())
        )


async def _create_database_if_missing(url: str) -> None:
    parsed = make_url(url)
    conn = await asyncpg.connect(
        user=parsed.username,
        password=parsed.password,
        host=parsed.host,
        port=parsed.port,
        database="postgres",
    )
    try:
        exists = await conn.fetchval(
            "SELECT 1 FROM pg_database WHERE datname = $1", parsed.database
        )
        if not exists:
            await conn.execute(f'CREATE DATABASE "{parsed.database}"')
    finally:
        await conn.close()


async def _reset_and_seed() -> None:
    await _create_database_if_missing(TEST_DATABASE_URL)
    engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        await seed(engine, async_sessionmaker(engine, expire_on_commit=False), FakeEmbedder())
    finally:
        await engine.dispose()


@pytest.fixture(scope="session", autouse=True)
def seeded_database() -> None:
    # asyncio.run in a sync fixture: one throwaway event loop, so no loop-scope juggling.
    asyncio.run(_reset_and_seed())


@pytest.fixture
async def session_factory() -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    # NullPool: each test runs on its own event loop, and pooled asyncpg connections
    # cannot cross loops.
    engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
    async with engine.begin() as conn:
        await conn.execute(text("TRUNCATE searches CASCADE"))
    yield async_sessionmaker(engine, expire_on_commit=False)
    await engine.dispose()


@pytest.fixture
def embedder() -> Embedder:
    return FakeEmbedder()


@pytest.fixture
async def client(session_factory, embedder) -> AsyncIterator[httpx.AsyncClient]:
    async def override_db() -> AsyncIterator[AsyncSession]:
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_embedder] = lambda: embedder
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as http:
        yield http
    app.dependency_overrides.clear()
