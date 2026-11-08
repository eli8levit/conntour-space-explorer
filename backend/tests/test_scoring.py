import pytest

from services.scoring import (
    Candidate,
    ScoringParams,
    confidence,
    keyword_confidence,
    score,
    semantic_confidence,
)

PARAMS = ScoringParams(
    semantic_floor=0.2,
    semantic_ceil=0.6,
    semantic_weight=0.5,
    keyword_weight=0.5,
    min_confidence=0.3,
    max_results=3,
)


@pytest.mark.parametrize(
    ("cosine", "expected"),
    [(None, 0.0), (-0.5, 0.0), (0.2, 0.0), (0.4, 0.5), (0.6, 1.0), (0.95, 1.0)],
)
def test_semantic_confidence_is_a_clamped_linear_stretch(cosine, expected):
    assert semantic_confidence(cosine, PARAMS) == pytest.approx(expected)


def test_keyword_confidence_scales_with_query_coverage():
    assert keyword_confidence(0.6, 1.0) == pytest.approx(0.6)
    # Only one of two query words matched: half the credit.
    assert keyword_confidence(0.6, 0.5) == pytest.approx(0.3)
    assert keyword_confidence(0.0, 0.0) == 0.0


def test_confidence_modes():
    assert confidence(0.8, 0.4, "hybrid", PARAMS) == pytest.approx(0.6)
    assert confidence(0.8, 0.4, "keyword", PARAMS) == 0.4
    assert confidence(0.8, 0.4, "semantic", PARAMS) == 0.8


def test_score_filters_sorts_and_limits():
    candidates = [
        Candidate(source_id=1, keyword_rank=0.0, term_coverage=0.0, cosine=0.25),  # too weak
        Candidate(source_id=2, keyword_rank=0.8, term_coverage=1.0, cosine=0.6),  # best
        Candidate(source_id=3, keyword_rank=0.0, term_coverage=0.0, cosine=0.6),  # meaning only
        Candidate(source_id=4, keyword_rank=0.5, term_coverage=1.0, cosine=0.5),
        Candidate(source_id=5, keyword_rank=0.4, term_coverage=1.0, cosine=0.5),
    ]
    hits = score(candidates, "hybrid", PARAMS)
    assert [hit.source_id for hit in hits] == [2, 4, 5]  # limited to max_results=3
    assert hits[0].confidence == pytest.approx(0.9)
    assert hits[0].keyword_score == pytest.approx(0.8)
    assert hits[0].semantic_score == pytest.approx(1.0)


def test_keyword_mode_ignores_missing_vectors():
    candidates = [Candidate(source_id=1, keyword_rank=0.5, term_coverage=1.0, cosine=None)]
    hits = score(candidates, "keyword", PARAMS)
    assert [(hit.source_id, hit.confidence, hit.semantic_score) for hit in hits] == [(1, 0.5, 0.0)]


def test_equal_scores_keep_a_stable_order():
    same = dict(keyword_rank=0.5, term_coverage=1.0, cosine=0.5)
    candidates = [Candidate(source_id=i, **same) for i in (9, 3, 7)]
    assert [hit.source_id for hit in score(candidates, "hybrid", PARAMS)] == [3, 7, 9]
