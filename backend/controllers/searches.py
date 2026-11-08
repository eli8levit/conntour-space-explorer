from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from controllers.dependencies import DbId, get_embedder
from db import get_db
from models import SearchDetail, SearchHistoryPage, SearchRequest
from repositories import HistoryRepository
from services.cursor import InvalidCursor, decode_cursor, encode_cursor
from services.embedding import Embedder
from services.search import run_search

router = APIRouter(prefix="/api/searches", tags=["searches"])


def get_history(session: AsyncSession = Depends(get_db)) -> HistoryRepository:
    return HistoryRepository(session)


@router.post("", response_model=SearchDetail, status_code=status.HTTP_201_CREATED)
async def create_search(
    request: SearchRequest,
    session: AsyncSession = Depends(get_db),
    embedder: Embedder = Depends(get_embedder),
) -> SearchDetail:
    """Run a search and store it in the history."""
    return await run_search(session, embedder, request.query)


@router.get("", response_model=SearchHistoryPage)
async def list_searches(
    limit: int = Query(20, ge=1, le=100),
    cursor: str | None = None,
    q: str | None = Query(None, max_length=200),
    history: HistoryRepository = Depends(get_history),
) -> SearchHistoryPage:
    """History, newest first. Pass `next_cursor` back as `cursor` for the next page.

    `q` keeps only searches whose query contains it (case-insensitive); pass the same `q`
    with the cursor. `total` counts the filtered searches."""
    try:
        after = decode_cursor(cursor) if cursor else None
    except InvalidCursor:
        raise HTTPException(status_code=400, detail="Invalid cursor") from None
    contains = q.strip() if q else None
    items, next_key, total = await history.get_page(limit, after, contains or None)
    return SearchHistoryPage(
        items=items, next_cursor=encode_cursor(next_key) if next_key else None, total=total
    )


@router.get("/{search_id}", response_model=SearchDetail)
async def get_search(
    search_id: DbId, history: HistoryRepository = Depends(get_history)
) -> SearchDetail:
    """A past search with the results stored at the time (not a re-run)."""
    detail = await history.get_by_id(search_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Search not found")
    return detail


@router.delete("/{search_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_search(
    search_id: DbId, history: HistoryRepository = Depends(get_history)
) -> Response:
    if not await history.delete(search_id):
        raise HTTPException(status_code=404, detail="Search not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
