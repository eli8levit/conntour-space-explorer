"""Search use case: embed the query, retrieve, score, store the snapshot."""

from fastapi.concurrency import run_in_threadpool
from sqlalchemy.ext.asyncio import AsyncSession

from config import CANDIDATE_POOL
from models import Engine, SearchDetail, SearchHit
from repositories import HistoryRepository, SearchIndexRepository, SourceRepository
from services.embedding import Embedder
from services.scoring import (
    Mode,
    ScoredHit,
    ScoringParams,
    query_ids,
    score,
    semantic_confidence,
)


async def score_query(
    session: AsyncSession,
    embedder: Embedder,
    query: str,
    mode: Mode | None = None,
    params: ScoringParams = ScoringParams(),
) -> tuple[Engine, list[ScoredHit]]:
    """Score the catalogue for a query without storing anything (the eval script uses this).

    `mode` defaults to hybrid when the model is loaded and keyword-only when it is not.
    """
    # ONNX inference is synchronous CPU work (a few ms); running it on the event loop
    # would stall every other request while it runs.
    query_vector = await run_in_threadpool(embedder.embed_query, query)
    engine: Engine = "hybrid" if query_vector is not None else "keyword"
    if mode is None or query_vector is None:
        mode = engine
    candidates = await SearchIndexRepository(session).candidates(
        query, query_vector, CANDIDATE_POOL, query_ids(query)
    )
    return engine, score(candidates, mode, params, embedder.knows_any_word(query))


async def run_search(session: AsyncSession, embedder: Embedder, query: str) -> SearchDetail:
    engine, hits = await score_query(session, embedder, query)
    history = HistoryRepository(session)
    search_id = await history.create(query, engine, hits)
    # Read back through the same path as GET /api/searches/{id}, so a fresh search and
    # a reopened one are guaranteed to look identical.
    detail = await history.get_by_id(search_id)
    assert detail is not None
    return detail


async def similar_sources(
    session: AsyncSession, source_id: int, limit: int, params: ScoringParams = ScoringParams()
) -> list[SearchHit]:
    """More like this: the nearest stored embeddings. Empty when there are none."""
    sources = SourceRepository(session)
    neighbours = await sources.get_similar(source_id, limit)
    by_id = await sources.get_many([neighbour_id for neighbour_id, _ in neighbours])
    hits = []
    for rank, (neighbour_id, cosine) in enumerate(neighbours, start=1):
        sem = round(semantic_confidence(cosine, params), 4)
        hits.append(
            SearchHit(
                source=by_id[neighbour_id],
                confidence=sem,
                keyword_score=0.0,
                semantic_score=sem,
                rank=rank,
            )
        )
    return hits
