"""Turn raw retrieval scores into one 0..1 confidence. Pure functions, unit-tested.

The formula, in one sentence: confidence is 80% how close the meaning is and 20% how
many of your words the image's text contains.

    meaning    = clamp((cosine - SEMANTIC_FLOOR) / (SEMANTIC_CEIL - SEMANTIC_FLOOR), 0, 1)
    words      = ts_rank_cd(..., 32) * (query words found / query words)
    confidence = SEMANTIC_WEIGHT * meaning + KEYWORD_WEIGHT * words     (0.8 / 0.2)

Results under MIN_CONFIDENCE are dropped; STRONG_MATCH (0.5) and above count as strong.
In keyword-only mode (no model) confidence = words.

Why this blend: scripts/eval_search.py compared it with noisy-OR, a "words boost
meaning" product, max(meaning, blend) and the old 50/50 average. The 80/20 average had
the best P@5 (0.82) and recall (0.96), lets meaning-only matches reach "strong" (a 50/50
average capped them at 0.5), and keeps exact IDs like "STS-135" first, which noisy-OR and
max() lost because every STS-* caption saturates the meaning score.
"""

from dataclasses import dataclass
from typing import Literal

import config
from search_types import Candidate, ScoredHit

__all__ = ["Candidate", "Mode", "ScoredHit", "ScoringParams", "score", "semantic_confidence"]

Mode = Literal["hybrid", "keyword", "semantic"]


@dataclass(frozen=True)
class ScoringParams:
    semantic_floor: float = config.SEMANTIC_FLOOR
    semantic_ceil: float = config.SEMANTIC_CEIL
    semantic_weight: float = config.SEMANTIC_WEIGHT
    keyword_weight: float = config.KEYWORD_WEIGHT
    min_confidence: float = config.MIN_CONFIDENCE
    max_results: int = config.MAX_RESULTS


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
