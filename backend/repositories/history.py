"""Search history: each search and a snapshot of the results the user saw.

Not a Repository[T]: history grows without bound, so it has no get_all, only pages.
"""

from datetime import datetime

from sqlalchemy import delete, func, select, true, tuple_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from config import STRONG_MATCH
from db.models import SearchModel, SearchResultModel, SourceModel
from models import Engine, SearchDetail, SearchHit, SearchPreview, SearchSummary
from repositories.source import to_source
from search_types import ScoredHit

PREVIEW_THUMBS = 3


def escape_like(text: str) -> str:
    """Escape LIKE's wildcards, so "50%" finds the text "50%", not everything after "50"."""
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


# (created_at, id) of the last row on a page; the next page starts strictly after it.
HistoryKey = tuple[datetime, int]


class HistoryRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def create(self, query: str, engine: Engine, hits: list[ScoredHit]) -> int:
        """Store the search and its results in one transaction; returns the search id."""
        search = SearchModel(
            query=query,
            engine=engine,
            result_count=len(hits),
            results=[
                SearchResultModel(
                    rank=rank,
                    source_id=hit.source_id,
                    confidence=hit.confidence,
                    keyword_score=hit.keyword_score,
                    semantic_score=hit.semantic_score,
                    id_rule=hit.id_rule,
                )
                for rank, hit in enumerate(hits, start=1)
            ],
        )
        self._session.add(search)
        await self._session.commit()
        return search.id

    async def get_by_id(self, search_id: int) -> SearchDetail | None:
        search = await self._session.scalar(
            select(SearchModel)
            .where(SearchModel.id == search_id)
            .options(selectinload(SearchModel.results).selectinload(SearchResultModel.source))
        )
        if search is None:
            return None
        return SearchDetail(
            id=search.id,
            query=search.query,
            created_at=search.created_at,
            engine=search.engine,
            result_count=search.result_count,
            results=[
                SearchHit(
                    source=to_source(result.source),
                    confidence=result.confidence,
                    keyword_score=result.keyword_score,
                    semantic_score=result.semantic_score,
                    rank=result.rank,
                    id_rule=result.id_rule,
                )
                for result in search.results
            ],
        )

    async def get_page(
        self, limit: int, after: HistoryKey | None, contains: str | None = None
    ) -> tuple[list[SearchSummary], HistoryKey | None, int]:
        """Newest first. Keyset, not offset: a page costs the same however deep it is,
        and deleting a row never shifts later pages (no skipped or repeated items).

        `contains` keeps only searches whose query has it as a substring (any case); the
        cursor and the total then apply to the filtered list.

        Returns (items, key of the last item if there is a next page, total searches).
        """
        # ILIKE with the user's text as a literal: % and _ in it must not act as wildcards.
        matches = (
            [SearchModel.query.ilike(f"%{escape_like(contains)}%", escape="\\")] if contains else []
        )
        # Per-search stats as a LATERAL subquery: Postgres computes it only for the rows
        # on this page, using the search_results primary key (search_id, rank).
        stats = (
            select(
                func.count()
                .filter(SearchResultModel.confidence >= STRONG_MATCH)
                .label("strong_count"),
                func.max(SearchResultModel.confidence).label("best_confidence"),
            )
            .where(SearchResultModel.search_id == SearchModel.id)
            .lateral("stats")
        )
        stmt = (
            select(SearchModel, stats.c.strong_count, stats.c.best_confidence)
            .join(stats, true())
            .where(*matches)
            .order_by(SearchModel.created_at.desc(), SearchModel.id.desc())
        )
        if after is not None:
            # Row comparison matches the (created_at desc, id desc) index.
            stmt = stmt.where(tuple_(SearchModel.created_at, SearchModel.id) < tuple_(*after))
        # One extra row tells us whether a next page exists.
        rows = list((await self._session.execute(stmt.limit(limit + 1))).all())
        has_more = len(rows) > limit
        rows = rows[:limit]

        previews = await self._previews([row.SearchModel.id for row in rows])
        items = []
        for search, strong_count, best_confidence in rows:
            top = previews.get(search.id, [])
            items.append(
                SearchSummary(
                    id=search.id,
                    query=search.query,
                    created_at=search.created_at,
                    result_count=search.result_count,
                    strong_count=strong_count,
                    best_confidence=best_confidence,
                    previews=top,
                )
            )
        last = rows[-1].SearchModel if rows else None
        next_key = (last.created_at, last.id) if has_more and last else None
        # For the "N searches" header. A full count is fine at this size; at millions
        # of rows it would become an estimate (pg_class.reltuples) or a cached counter.
        # A substring filter cannot use the btree index; at scale it would get a pg_trgm
        # GIN index on query. At this size a scan is instant.
        total = await self._session.scalar(
            select(func.count()).select_from(SearchModel).where(*matches)
        )
        return items, next_key, total or 0

    async def _previews(self, search_ids: list[int]) -> dict[int, list[SearchPreview]]:
        """Top results' thumbnails for a whole page in one query (no N+1)."""
        if not search_ids:
            return {}
        result = await self._session.execute(
            select(SearchResultModel.search_id, SourceModel.thumb_url, SearchResultModel.confidence)
            .join(SourceModel, SourceModel.id == SearchResultModel.source_id)
            .where(
                SearchResultModel.search_id.in_(search_ids),
                SearchResultModel.rank <= PREVIEW_THUMBS,
            )
            .order_by(SearchResultModel.search_id, SearchResultModel.rank)
        )
        previews: dict[int, list[SearchPreview]] = {}
        for search_id, thumb_url, confidence in result.all():
            previews.setdefault(search_id, []).append(
                SearchPreview(thumb_url=thumb_url, confidence=confidence)
            )
        return previews

    async def delete(self, search_id: int) -> bool:
        """True when a row was deleted. Its results go with it (ON DELETE CASCADE)."""
        result = await self._session.execute(delete(SearchModel).where(SearchModel.id == search_id))
        await self._session.commit()
        return result.rowcount > 0
