from fastapi import APIRouter, Depends, Response
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from controllers.dependencies import get_embedder
from db import get_db
from models import Health
from services.embedding import Embedder

router = APIRouter(prefix="/api/health", tags=["health"])


@router.get("", response_model=Health)
async def health(
    response: Response,
    session: AsyncSession = Depends(get_db),
    embedder: Embedder = Depends(get_embedder),
) -> Health:
    """503 only when the database is down; keyword-only search still counts as serving."""
    try:
        await session.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False
    if not db_ok:
        response.status_code = 503
        status = "down"
    elif embedder.name == "keyword-only":
        status = "degraded"
    else:
        status = "ok"
    return Health(status=status, db=db_ok, embedder=embedder.name)
