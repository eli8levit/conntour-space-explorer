from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    ARRAY,
    Computed,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import TSVECTOR
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from config import EMBEDDING_DIM


class Base(DeclarativeBase):
    pass


# Weighted full-text document: a hit in the title or the NASA id (A) outranks one in the
# keywords (B), which outranks one in the long caption (C). Postgres keeps it up to date
# by itself. The id is in it so that typing "PIA22505" finds that image.
# `immutable_array_to_string` is created in db/schema.py: the built-in array_to_string is
# only STABLE, and a generated column needs an IMMUTABLE expression.
SEARCH_VECTOR_SQL = (
    "setweight(to_tsvector('english', coalesce(title, '') || ' ' || nasa_id), 'A') || "
    "setweight(to_tsvector('english', coalesce(immutable_array_to_string(keywords, ' '), '')), 'B') || "
    "setweight(to_tsvector('english', coalesce(description, '')), 'C')"
)


class SourceModel(Base):
    """One NASA image with its metadata, place, and search fields."""

    __tablename__ = "sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nasa_id: Mapped[str] = mapped_column(Text, unique=True)
    title: Mapped[str] = mapped_column(Text)
    # Hand-written display title from data/titles.json (NASA titles are often IDs or
    # whole captions). Display only: search still scores the NASA title.
    short_title: Mapped[str | None] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text, default="")
    date_created: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    center: Mapped[str] = mapped_column(Text)
    keywords: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    photographer: Mapped[str | None] = mapped_column(Text)
    # Who to credit: the photographer, else NASA's secondary_creator ("NASA/JPL-Caltech/ASU").
    credit: Mapped[str | None] = mapped_column(Text)
    location: Mapped[str | None] = mapped_column(Text)
    image_url: Mapped[str] = mapped_column(Text)
    image_width: Mapped[int | None] = mapped_column(Integer)  # of the image_url rendition
    image_height: Mapped[int | None] = mapped_column(Integer)
    thumb_url: Mapped[str] = mapped_column(Text)

    # Place columns are flat (not a separate table): each image has exactly one place.
    place_body: Mapped[str | None] = mapped_column(Text)
    place_lat: Mapped[float | None] = mapped_column(Float)
    place_lon: Mapped[float | None] = mapped_column(Float)
    place_label: Mapped[str | None] = mapped_column(Text)
    place_provenance: Mapped[str | None] = mapped_column(Text)

    # NULL until the seed embeds the row; search then treats it as keyword-only.
    embedding: Mapped[list[float] | None] = mapped_column(Vector(EMBEDDING_DIM))
    search_vector: Mapped[str] = mapped_column(
        TSVECTOR, Computed(SEARCH_VECTOR_SQL, persisted=True)
    )

    __table_args__ = (
        Index("ix_sources_search_vector", "search_vector", postgresql_using="gin"),
        # Not used by the planner at 100 rows (a scan is cheaper); it is what makes the
        # same vector query fast at millions of rows.
        Index(
            "ix_sources_embedding_hnsw",
            "embedding",
            postgresql_using="hnsw",
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
    )


class SearchModel(Base):
    """One search the user ran. History is global because there is no auth yet."""

    __tablename__ = "searches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    query: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    result_count: Mapped[int] = mapped_column(Integer)
    engine: Mapped[str] = mapped_column(Text)  # "hybrid" | "keyword"

    results: Mapped[list["SearchResultModel"]] = relationship(
        back_populates="search",
        order_by="SearchResultModel.rank",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class SearchResultModel(Base):
    """Snapshot of one result as the user saw it: reopening history never re-runs the query."""

    __tablename__ = "search_results"

    search_id: Mapped[int] = mapped_column(
        ForeignKey("searches.id", ondelete="CASCADE"), primary_key=True
    )
    rank: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_id: Mapped[int] = mapped_column(ForeignKey("sources.id"))
    confidence: Mapped[float] = mapped_column(Float)
    keyword_score: Mapped[float] = mapped_column(Float)
    semantic_score: Mapped[float] = mapped_column(Float)

    search: Mapped[SearchModel] = relationship(back_populates="results")
    source: Mapped[SourceModel] = relationship()


# Each index matches its list ORDER BY exactly, so a page is an index range scan.
Index("ix_sources_date_created_id", SourceModel.date_created.desc(), SourceModel.id)
Index("ix_searches_created_at_id", SearchModel.created_at.desc(), SearchModel.id.desc())
# Postgres does not index foreign keys by itself. This one serves the join from a result to
# its source, and keeps deleting or checking a source from scanning every stored result.
Index("ix_search_results_source_id", SearchResultModel.source_id)
