from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_db
from models import PlacePin
from repositories import SourceRepository

router = APIRouter(prefix="/api/places", tags=["places"])


@router.get("", response_model=List[PlacePin])
async def get_places(session: AsyncSession = Depends(get_db)) -> List[PlacePin]:
    """Every image's place, without captions: the 3D scene loads all of them at once."""
    return await SourceRepository(session).get_places()
