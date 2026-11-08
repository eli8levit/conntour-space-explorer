from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_db
from models import Body, Facets, SearchHit, Source, SourcePage
from repositories import SourceRepository
from services.search import similar_sources

router = APIRouter(prefix="/api/sources", tags=["sources"])


def get_repository(session: AsyncSession = Depends(get_db)) -> SourceRepository:
    """Dependency injection for the source repository."""
    return SourceRepository(session)


@router.get("", response_model=SourcePage)
async def get_sources(
    limit: int = Query(24, ge=1, le=100),
    offset: int = Query(0, ge=0),
    center: str | None = None,
    body: Body | None = None,
    repository: SourceRepository = Depends(get_repository),
) -> SourcePage:
    """A page of NASA images, newest first, optionally filtered."""
    return await repository.get_page(limit, offset, center, body)


# Declared before /{source_id}, otherwise "facets" would be parsed as an id.
@router.get("/facets", response_model=Facets)
async def get_facets(repository: SourceRepository = Depends(get_repository)) -> Facets:
    """Values and counts for the filter dropdowns."""
    return await repository.get_facets()


@router.get("/{source_id}", response_model=Source)
async def get_source(
    source_id: int, repository: SourceRepository = Depends(get_repository)
) -> Source:
    source = await repository.get_by_id(source_id)
    if source is None:
        raise HTTPException(status_code=404, detail="Source not found")
    return source


@router.get("/{source_id}/similar", response_model=List[SearchHit])
async def get_similar(
    source_id: int,
    limit: int = Query(6, ge=1, le=24),
    session: AsyncSession = Depends(get_db),
) -> List[SearchHit]:
    """Images closest in meaning to this one."""
    if await SourceRepository(session).get_by_id(source_id) is None:
        raise HTTPException(status_code=404, detail="Source not found")
    return await similar_sources(session, source_id, limit)
