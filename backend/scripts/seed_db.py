#!/usr/bin/env python
"""
Idempotent database setup, run before the API on every container start.

The original seed dropped all tables on each start, which would erase search history on
every restart. Now each step only fills what is missing:
1. create the extension, function and tables if they do not exist;
2. insert the 100 sources only when the table is empty;
3. embed rows whose embedding is NULL (e.g. the model was unavailable last time);
4. apply data/places.json (cheap, and picks up hand edits to the file).
"""

import asyncio
import html
import json
import logging
import os
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import func, select, update  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker  # noqa: E402

from db import AsyncSessionLocal, engine, init_schema  # noqa: E402
from db.models import SourceModel  # noqa: E402
from services.embedding import Embedder, document_text, load_embedder  # noqa: E402

logger = logging.getLogger("seed")

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
MOCK_DATA = DATA_DIR / "mock_data.json"
PLACES = DATA_DIR / "places.json"

# Browser-friendly renditions, best first. ~orig is sometimes a TIFF, which browsers
# cannot show, so it only counts when it is a JPEG.
IMAGE_PREFERENCE = ("~medium.jpg", "~large.jpg", "~orig.jpg", "~small.jpg", "~thumb.jpg")
THUMB_PREFERENCE = ("~small.jpg", "~thumb.jpg")


def pick_link(links: list[dict[str, Any]], preference: tuple[str, ...]) -> dict[str, Any]:
    for suffix in preference:
        for link in links:
            if link["href"].endswith(suffix):
                return link
    return links[0]


def split_keywords(raw: list[str] | None) -> list[str]:
    # Some items pack all keywords into one comma-separated string ("OPF2, VAB").
    return [part.strip() for keyword in raw or [] for part in keyword.split(",") if part.strip()]


def clean_text(raw: str) -> str:
    # A few captions contain HTML tags and entities ("&amp;", "&#0146;").
    return html.unescape(re.sub(r"<[^>]+>", "", raw)).strip()


def parse_item(item: dict[str, Any]) -> dict[str, Any]:
    data = item["data"][0]
    links = [link for link in item.get("links", []) if link.get("render") == "image"]
    image = pick_link(links, IMAGE_PREFERENCE)
    return {
        "nasa_id": data["nasa_id"].strip(),
        "title": clean_text(data.get("title", "")) or data["nasa_id"],
        "description": clean_text(data.get("description", "")),
        "date_created": datetime.fromisoformat(data["date_created"]),
        "center": data["center"],
        "keywords": split_keywords(data.get("keywords")),
        "photographer": data.get("photographer"),
        "location": (data.get("location") or "").strip() or None,
        "image_url": image["href"],
        # NASA lists pixel sizes for most renditions; missing ones stay NULL.
        "image_width": image.get("width"),
        "image_height": image.get("height"),
        "thumb_url": pick_link(links, THUMB_PREFERENCE)["href"],
    }


def load_items() -> list[dict[str, Any]]:
    with open(MOCK_DATA) as f:
        return [parse_item(item) for item in json.load(f)["collection"]["items"]]


async def insert_sources_if_empty(session: AsyncSession) -> int:
    if await session.scalar(select(func.count()).select_from(SourceModel)):
        return 0
    rows = [SourceModel(**values) for values in load_items()]
    session.add_all(rows)
    await session.flush()
    return len(rows)


async def fill_missing_embeddings(session: AsyncSession, embedder: Embedder) -> int:
    rows = (await session.scalars(select(SourceModel).where(SourceModel.embedding.is_(None)))).all()
    if not rows:
        return 0
    vectors = embedder.embed_documents(
        [document_text(row.title, row.keywords, row.description) for row in rows]
    )
    if not vectors:  # keyword-only embedder: leave NULL so a later start can fill them
        logger.warning("No embedder available; %d sources stay without embeddings", len(rows))
        return 0
    for row, vector in zip(rows, vectors, strict=True):
        row.embedding = vector
    return len(rows)


async def apply_places(session: AsyncSession) -> int:
    with open(PLACES) as f:
        places = json.load(f)
    for place in places:
        await session.execute(
            update(SourceModel)
            .where(SourceModel.nasa_id == place["nasa_id"])
            .values(
                place_body=place["body"],
                place_lat=place["lat"],
                place_lon=place["lon"],
                place_label=place["label"],
                place_provenance=place["provenance"],
            )
        )
    return len(places)


async def seed(
    db_engine: AsyncEngine, session_factory: async_sessionmaker[AsyncSession], embedder: Embedder
) -> None:
    await init_schema(db_engine)
    async with session_factory() as session:
        inserted = await insert_sources_if_empty(session)
        embedded = await fill_missing_embeddings(session, embedder)
        placed = await apply_places(session)
        await session.commit()
    logger.info("Seed: %d inserted, %d embedded, %d places applied", inserted, embedded, placed)


async def main() -> None:
    try:
        await seed(engine, AsyncSessionLocal, load_embedder())
    finally:
        await engine.dispose()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    asyncio.run(main())
