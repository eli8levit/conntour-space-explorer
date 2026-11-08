"""Turn raw retrieval scores into one 0..1 confidence. Pure functions, unit-tested.

The formula, in one sentence: confidence is 80% how close the meaning is and 20% how
many of your words the image's text contains.

    meaning    = clamp((cosine - SEMANTIC_FLOOR) / (SEMANTIC_CEIL - SEMANTIC_FLOOR), 0, 1)
    words      = ts_rank_cd(..., 32) * (query words found / query words)
    confidence = SEMANTIC_WEIGHT * meaning + KEYWORD_WEIGHT * words     (0.8 / 0.2)

Two guard rules, each one sentence:
1. Gibberish: if the model knows none of your words, only results that contain one of
   your words can appear (so "zzqx" returns nothing instead of near-random images).
2. IDs: if you type an ID (STS-135, Expedition 61, PIA22505), images with that exact ID
   are strong matches and images without it cannot be: the first are raised to at least
   STRONG_MATCH, the others get half their score (ID_MISMATCH_FACTOR), which is < 0.5.

Results under MIN_CONFIDENCE are dropped; STRONG_MATCH (0.5) and above count as strong.
In keyword-only mode (no model) confidence = words.

Why this blend: scripts/eval_search.py compared it with noisy-OR, a "words boost
meaning" product, max(meaning, blend) and the old 50/50 average. The 80/20 average had
the best P@5 and recall, lets meaning-only matches reach "strong" (a 50/50 average capped
them at 0.5), and keeps exact IDs like "STS-135" first, which noisy-OR and max() lost
because every STS-* caption saturates the meaning score. See docs/search-eval.md.
"""

import re
from dataclasses import dataclass
from typing import Literal

import config
from search_types import Candidate, IdRule, ScoredHit

__all__ = [
    "Candidate",
    "Mode",
    "ScoredHit",
    "ScoringParams",
    "query_ids",
    "score",
    "semantic_confidence",
]

Mode = Literal["hybrid", "keyword", "semantic"]


@dataclass(frozen=True)
class ScoringParams:
    semantic_floor: float = config.SEMANTIC_FLOOR
    semantic_ceil: float = config.SEMANTIC_CEIL
    semantic_weight: float = config.SEMANTIC_WEIGHT
    keyword_weight: float = config.KEYWORD_WEIGHT
    min_confidence: float = config.MIN_CONFIDENCE
    max_results: int = config.MAX_RESULTS
    id_mismatch_factor: float = config.ID_MISMATCH_FACTOR  # 1.0 turns the ID rule off
    gibberish_guard: bool = True  # False turns the gibberish rule off (for the eval)


# A query word with a digit in it: STS-135, PIA22505, MS-13, 61.
_WORD = re.compile(r"[A-Za-z0-9]+(?:[-.][A-Za-z0-9]+)*")


def query_ids(query: str) -> list[str]:
    """The IDs a query names, as phrases to look for in the text.

    A word with a digit is an ID ("STS-135", "PIA22505", "MS-13"). A bare number keeps
    the word before it, because "61" alone is not an ID but "Expedition 61" is.
    """
    words = _WORD.findall(query)
    ids = []
    for i, word in enumerate(words):
        if not any(ch.isdigit() for ch in word):
            continue
        previous = words[i - 1] if i > 0 else ""
        if word.isdigit() and previous and not any(ch.isdigit() for ch in previous):
            ids.append(f"{previous} {word}")
        else:
            ids.append(word)
    return ids


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


def score(
    candidates: list[Candidate],
    mode: Mode,
    params: ScoringParams,
    query_has_known_words: bool = True,
) -> list[ScoredHit]:
    """Calibrate, blend, apply the two guard rules, drop weak matches, best first."""
    hits = []
    for candidate in candidates:
        sem = semantic_confidence(candidate.cosine, params)
        kw = keyword_confidence(candidate.keyword_rank, candidate.term_coverage)
        if params.gibberish_guard and not query_has_known_words and kw == 0:
            continue  # rule 1: a meaning-only match for a query with no known words
        conf = confidence(sem, kw, mode, params)
        # Rule 2: the queried ID decides the tier. id_rule records a change, so the UI can
        # say why the confidence is not the meaning/words blend it shows.
        id_rule: IdRule | None = None
        if candidate.has_query_ids is True and conf < config.STRONG_MATCH:
            conf, id_rule = config.STRONG_MATCH, "raised"
        elif candidate.has_query_ids is False and params.id_mismatch_factor < 1:
            conf, id_rule = conf * params.id_mismatch_factor, "halved"
        if conf >= params.min_confidence:
            hits.append(
                ScoredHit(candidate.source_id, round(conf, 4), round(kw, 4), round(sem, 4), id_rule)
            )
    # source_id breaks ties so equal scores keep a stable order between runs.
    hits.sort(key=lambda hit: (-hit.confidence, hit.source_id))
    return hits[: params.max_results]
