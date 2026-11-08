"""Plain data passed between the search layers.

They live here, not in services/scoring.py, so the repositories (which produce and store
them) do not depend on the services layer that scores them.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Candidate:
    """One row from the retrieval query: raw scores before calibration."""

    source_id: int
    keyword_rank: float  # ts_rank_cd(..., 32), 0 when no query word matches
    term_coverage: float  # share of the query's words found in this row, 0..1
    cosine: float | None  # None in keyword-only mode or when the row has no embedding


@dataclass(frozen=True)
class ScoredHit:
    """One scored result, as stored in the history snapshot."""

    source_id: int
    confidence: float
    keyword_score: float
    semantic_score: float
