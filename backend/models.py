"""Pydantic API schemas: the JSON contract the frontend is built against (snake_case)."""

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, StringConstraints

from config import MAX_QUERY_LENGTH
from search_types import IdRule

Body = Literal["earth", "orbit", "moon", "mars", "deep_space"]
Provenance = Literal["caption", "location field", "NASA center (approx.)", "manual"]
Engine = Literal["hybrid", "keyword"]


class Place(BaseModel):
    body: Body
    lat: float | None
    lon: float | None
    label: str
    provenance: Provenance


class Source(BaseModel):
    """Domain model for one NASA image."""

    id: int
    nasa_id: str
    title: str  # the NASA title, as in the record (sometimes an ID or a whole caption)
    short_title: str | None  # hand-written display title (data/titles.json)
    description: str
    date_created: datetime
    center: str
    keywords: list[str]
    photographer: str | None
    credit: str | None  # photographer, else NASA's secondary_creator
    location: str | None
    image_url: str
    width: int | None  # pixel size of image_url, when NASA lists it
    height: int | None
    thumb_url: str
    place: Place | None


class SourcePage(BaseModel):
    items: list[Source]
    total: int


class SearchHit(BaseModel):
    """One result. All scores are calibrated to 0..1 (see services/scoring.py)."""

    source: Source
    confidence: float
    keyword_score: float
    semantic_score: float
    rank: int
    # "raised" / "halved" when the ID rule changed the confidence, else None.
    id_rule: IdRule | None = None


class SearchRequest(BaseModel):
    # Whitespace is stripped before the length checks, so "   " is rejected with 422.
    query: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=MAX_QUERY_LENGTH)
    ]


class SearchDetail(BaseModel):
    id: int
    query: str
    created_at: datetime
    engine: Engine
    result_count: int
    results: list[SearchHit]


class SearchPreview(BaseModel):
    thumb_url: str
    confidence: float


class SearchSummary(BaseModel):
    id: int
    query: str
    created_at: datetime
    result_count: int
    strong_count: int  # results with confidence >= config.STRONG_MATCH
    best_confidence: float | None  # None when the search found nothing
    previews: list[SearchPreview]  # top 3 by rank


class SearchHistoryPage(BaseModel):
    items: list[SearchSummary]
    next_cursor: str | None
    total: int  # all searches in the history, not just this page


class PlacePin(BaseModel):
    """Light payload for the 3D scene: one pin for each image."""

    source_id: int
    nasa_id: str
    title: str
    short_title: str | None
    thumb_url: str
    date_created: datetime
    body: Body
    lat: float | None
    lon: float | None
    label: str
    provenance: Provenance


class Health(BaseModel):
    status: Literal["ok", "degraded", "down"]
    db: bool
    embedder: Literal["minilm", "keyword-only"]
