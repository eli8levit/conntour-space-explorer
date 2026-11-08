from typing import List

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import SourceModel
from models import Place, PlacePin, Source, SourcePage
from repositories.base import Repository


def to_place(row: SourceModel) -> Place | None:
    if row.place_body is None:
        return None
    return Place(
        body=row.place_body,
        lat=row.place_lat,
        lon=row.place_lon,
        label=row.place_label or "",
        provenance=row.place_provenance,
    )


def to_source(row: SourceModel) -> Source:
    """Explicit mapping, because the API nests the flat place_* columns into `place`."""
    return Source(
        id=row.id,
        nasa_id=row.nasa_id,
        title=row.title,
        short_title=row.short_title,
        description=row.description,
        date_created=row.date_created,
        center=row.center,
        keywords=row.keywords,
        photographer=row.photographer,
        credit=row.credit,
        location=row.location,
        image_url=row.image_url,
        width=row.image_width,
        height=row.image_height,
        thumb_url=row.thumb_url,
        place=to_place(row),
    )


class SourceRepository(Repository[Source]):
    """
    PostgreSQL repository implementation for Source entities.

    Implements the generic Repository interface with PostgreSQL
    as the backing data store using SQLAlchemy async.
    """

    def __init__(self, session: AsyncSession):
        self._session = session

    async def get_all(self) -> List[Source]:
        """Retrieve all sources from the database."""
        result = await self._session.execute(select(SourceModel).order_by(SourceModel.id))
        return [to_source(row) for row in result.scalars().all()]

    async def get_by_id(self, entity_id: int) -> Source | None:
        row = await self._session.get(SourceModel, entity_id)
        return to_source(row) if row else None

    async def get_page(
        self, limit: int, offset: int, center: str | None, body: str | None
    ) -> SourcePage:
        # Offset is fine here: the catalogue is small and does not change while browsing.
        # (History, which grows and has deletes, uses keyset pagination instead.)
        filters = []
        if center:
            filters.append(SourceModel.center == center)
        if body:
            filters.append(SourceModel.place_body == body)

        total = await self._session.scalar(
            select(func.count()).select_from(SourceModel).where(*filters)
        )
        result = await self._session.execute(
            select(SourceModel)
            .where(*filters)
            .order_by(SourceModel.date_created.desc(), SourceModel.id)
            .limit(limit)
            .offset(offset)
        )
        return SourcePage(
            items=[to_source(row) for row in result.scalars().all()], total=total or 0
        )

    async def get_places(self) -> list[PlacePin]:
        """Only the columns the 3D scene needs, not the long captions."""
        result = await self._session.execute(
            select(
                SourceModel.id,
                SourceModel.nasa_id,
                SourceModel.title,
                SourceModel.short_title,
                SourceModel.thumb_url,
                SourceModel.date_created,
                SourceModel.place_body,
                SourceModel.place_lat,
                SourceModel.place_lon,
                SourceModel.place_label,
                SourceModel.place_provenance,
            )
            .where(SourceModel.place_body.is_not(None))
            .order_by(SourceModel.id)
        )
        return [
            PlacePin(
                source_id=row.id,
                nasa_id=row.nasa_id,
                title=row.title,
                short_title=row.short_title,
                thumb_url=row.thumb_url,
                date_created=row.date_created,
                body=row.place_body,
                lat=row.place_lat,
                lon=row.place_lon,
                label=row.place_label or "",
                provenance=row.place_provenance,
            )
            for row in result.all()
        ]
