"""Hybrid retrieval: full-text and vector similarity in one SQL round trip.

This is a query, not an entity store, so it does not extend Repository[T].
"""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from search_types import Candidate

# 1. `q`: the query as an OR of its stemmed words. plainto_tsquery ANDs them, so
#    "images of Mars rovers" would need every word; with OR, each word that matches adds
#    to the rank. Only stop words (e.g. "the") give an empty tsquery, which matches nothing.
#    `terms` is the same stemmed words as an array, to count how many each row contains.
# 2. `candidates`: the best rows by keyword rank (GIN index) UNION the nearest rows by
#    cosine distance (HNSW index at scale). The vector branch turns itself off when
#    :qvec is NULL, which is keyword-only mode.
# 3. Both raw scores for every candidate, so a row found by one retriever still gets
#    the other score, plus how many query words the row contains (so a caption that has
#    "solar" but not "flares" is not a full keyword match). Scoring is in services/scoring.py.
HYBRID_CANDIDATES_SQL = text(
    """
    WITH q AS (
        SELECT replace(plainto_tsquery('english', :query)::text, '&', '|')::tsquery AS tsq,
               tsvector_to_array(to_tsvector('english', :query)) AS terms
    ),
    candidates AS (
        (SELECT s.id
           FROM sources s, q
          WHERE s.search_vector @@ q.tsq
          ORDER BY ts_rank_cd(s.search_vector, q.tsq, 32) DESC
          LIMIT :pool)
        UNION
        (SELECT s.id
           FROM sources s
          WHERE CAST(:qvec AS vector) IS NOT NULL AND s.embedding IS NOT NULL
          ORDER BY s.embedding <=> CAST(:qvec AS vector)
          LIMIT :pool)
    )
    SELECT s.id,
           ts_rank_cd(s.search_vector, q.tsq, 32) AS keyword_rank,
           (SELECT count(*)
              FROM unnest(q.terms) AS term
             WHERE s.search_vector @@ quote_literal(term)::tsquery) AS matched_terms,
           cardinality(q.terms) AS query_terms,
           1 - (s.embedding <=> CAST(:qvec AS vector)) AS cosine
      FROM candidates c
      JOIN sources s ON s.id = c.id
     CROSS JOIN q
    """
)


def vector_literal(vector: list[float]) -> str:
    """pgvector's text format, e.g. "[0.1,0.2]"; the SQL casts it to `vector`."""
    return "[" + ",".join(f"{value:.7g}" for value in vector) + "]"


class SearchIndexRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def candidates(
        self, query: str, query_vector: list[float] | None, pool: int
    ) -> list[Candidate]:
        qvec = vector_literal(query_vector) if query_vector is not None else None
        if qvec is not None:
            # An HNSW index scan returns at most hnsw.ef_search rows (default 40), so the
            # vector branch's LIMIT :pool would be cut to 40 at scale. SET LOCAL raises it
            # for this transaction only. At 100 rows Postgres scans instead, so it changes
            # nothing today. (int(): SET takes no bind parameters; 1000 is pgvector's max.)
            await self._session.execute(text(f"SET LOCAL hnsw.ef_search = {min(int(pool), 1000)}"))
        result = await self._session.execute(
            HYBRID_CANDIDATES_SQL, {"query": query, "qvec": qvec, "pool": pool}
        )
        return [
            Candidate(
                source_id=row.id,
                keyword_rank=float(row.keyword_rank),
                term_coverage=row.matched_terms / row.query_terms if row.query_terms else 0.0,
                cosine=float(row.cosine) if row.cosine is not None else None,
            )
            for row in result.all()
        ]
