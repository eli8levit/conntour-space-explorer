from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from controllers.dependencies import DbId
from db import get_db
from models import Body, Source, SourcePage
from repositories import SourceRepository

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


@router.get("/{source_id}", response_model=Source)
async def get_source(
    source_id: DbId, repository: SourceRepository = Depends(get_repository)
) -> Source:
    source = await repository.get_by_id(source_id)
    if source is None:
        raise HTTPException(status_code=404, detail="Source not found")
    return source
