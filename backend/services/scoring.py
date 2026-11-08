"""Turn raw retrieval scores into one 0..1 confidence. Pure functions, unit-tested.

Raw scores are not comparable: cosine similarity uses only part of its range (unrelated
text still scores ~0.1, the best matches ~0.6), and ts_rank_cd measures word density, not
how much of the query was found. Each is mapped to 0..1, then the two are averaged.
"""

from dataclasses import dataclass
from typing import Literal

import config

Mode = Literal["hybrid", "keyword", "semantic"]


@dataclass(frozen=True)
class ScoringParams:
    semantic_floor: float = config.SEMANTIC_FLOOR
    semantic_ceil: float = config.SEMANTIC_CEIL
    semantic_weight: float = config.SEMANTIC_WEIGHT
    keyword_weight: float = config.KEYWORD_WEIGHT
    min_confidence: float = config.MIN_CONFIDENCE
    max_results: int = config.MAX_RESULTS


@dataclass(frozen=True)
class Candidate:
    """One row from the retrieval query: raw scores before calibration."""

    source_id: int
    keyword_rank: float  # ts_rank_cd(..., 32), 0 when no query word matches
    term_coverage: float  # share of the query's words found in this row, 0..1
    cosine: float | None  # None in keyword-only mode or when the row has no embedding


@dataclass(frozen=True)
class ScoredHit:
    source_id: int
    confidence: float
    keyword_score: float
    semantic_score: float


def clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def semantic_confidence(cosine: float | None, params: ScoringParams) -> float:
    if cosine is None:
        return 0.0
    return clamp01(
        (cosine - params.semantic_floor) / (params.semantic_ceil - params.semantic_floor)
    )


def keyword_confidence(keyword_rank: float, term_coverage: float) -> float:
    """ts_rank_cd with normalization 32 is already 0..1 (rank / (rank + 1)).

    The OR query lets a single word match, so "solar flares" ranks a "Parker Solar Probe"
    title highly. Scaling by coverage gives it half the credit of a row with both words.
    """
    return clamp01(keyword_rank) * term_coverage


def confidence(sem: float, kw: float, mode: Mode, params: ScoringParams) -> float:
    if mode == "keyword":
        return kw
    if mode == "semantic":
        return sem
    return params.semantic_weight * sem + params.keyword_weight * kw


def score(candidates: list[Candidate], mode: Mode, params: ScoringParams) -> list[ScoredHit]:
    """Calibrate, blend, drop weak matches, and return the best first."""
    hits = []
    for candidate in candidates:
        sem = semantic_confidence(candidate.cosine, params)
        kw = keyword_confidence(candidate.keyword_rank, candidate.term_coverage)
        conf = confidence(sem, kw, mode, params)
        if conf >= params.min_confidence:
            hits.append(ScoredHit(candidate.source_id, round(conf, 4), round(kw, 4), round(sem, 4)))
    # source_id breaks ties so equal scores keep a stable order between runs.
    hits.sort(key=lambda hit: (-hit.confidence, hit.source_id))
    return hits[: params.max_results]
