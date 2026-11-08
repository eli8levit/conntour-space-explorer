"""Pydantic API schemas: the JSON contract the frontend is built against (snake_case)."""

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, StringConstraints

from config import MAX_QUERY_LENGTH

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
    title: str
    description: str
    date_created: datetime
    center: str
    keywords: list[str]
    photographer: str | None
    location: str | None
    image_url: str
    width: int | None  # pixel size of image_url, when NASA lists it
    height: int | None
    thumb_url: str
    place: Place | None


class SourcePage(BaseModel):
    items: list[Source]
    total: int


class FacetValue(BaseModel):
    value: str
    count: int


class Facets(BaseModel):
    centers: list[FacetValue]
    bodies: list[FacetValue]


class SearchHit(BaseModel):
    """One result. All scores are calibrated to 0..1 (see services/scoring.py)."""

    source: Source
    confidence: float
    keyword_score: float
    semantic_score: float
    rank: int


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
    preview_thumbs: list[str]  # deprecated: same as previews[].thumb_url, to be removed


class SearchHistoryPage(BaseModel):
    items: list[SearchSummary]
    next_cursor: str | None
    total: int  # all searches in the history, not just this page


class PlacePin(BaseModel):
    """Light payload for the 3D scene: one pin for each image."""

    source_id: int
    nasa_id: str
    title: str
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
