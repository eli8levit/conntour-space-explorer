"""Plain data passed between the search layers.

They live here, not in services/scoring.py, so the repositories (which produce and store
them) do not depend on the services layer that scores them.
"""

from dataclasses import dataclass
from typing import Literal

# What the ID rule (services/scoring.py, rule 2) did to one result's confidence:
# "raised" lifted an exact ID match up to STRONG_MATCH, "halved" cut a result without the
# ID. None means the rule did not change the score. The UI shows it next to the
# "Meaning · Words" breakdown, so the numbers there still add up to the shown confidence.
IdRule = Literal["raised", "halved"]


@dataclass(frozen=True)
class Candidate:
    """One row from the retrieval query: raw scores before calibration."""

    source_id: int
    keyword_rank: float  # ts_rank_cd(..., 32), 0 when no query word matches
    term_coverage: float  # share of the query's words found in this row, 0..1
    cosine: float | None  # None in keyword-only mode or when the row has no embedding
    # True/False: the row contains every ID the query names (see scoring.query_ids).
    # None: the query names no ID.
    has_query_ids: bool | None = None


@dataclass(frozen=True)
class ScoredHit:
    """One scored result, as stored in the history snapshot."""

    source_id: int
    confidence: float
    keyword_score: float
    semantic_score: float
    id_rule: IdRule | None = None
