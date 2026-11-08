import pytest

from services.scoring import (
    Candidate,
    ScoringParams,
    confidence,
    keyword_confidence,
    query_ids,
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


@pytest.mark.parametrize(
    ("query", "expected"),
    [
        ("STS-135", ["STS-135"]),
        ("STS-135 crew", ["STS-135"]),
        ("Expedition 61", ["Expedition 61"]),
        ("Soyuz MS-13 landing", ["MS-13"]),
        ("PIA22505", ["PIA22505"]),
        ("61", ["61"]),
        ("red planet", []),
    ],
)
def test_query_ids(query, expected):
    assert query_ids(query) == expected


def test_results_without_the_queried_id_can_never_be_strong():
    params = ScoringParams(0.2, 0.6, 0.8, 0.2, 0.2, 10, id_mismatch_factor=0.5)
    with_id = Candidate(1, keyword_rank=0.7, term_coverage=1.0, cosine=0.9, has_query_ids=True)
    # Another mission: full meaning score and some word overlap, but not the ID.
    other = Candidate(2, keyword_rank=0.9, term_coverage=0.5, cosine=0.9, has_query_ids=False)
    hits = {hit.source_id: hit for hit in score([with_id, other], "hybrid", params)}
    assert hits[1].confidence == pytest.approx(0.8 + 0.2 * 0.7)
    assert hits[2].confidence == pytest.approx((0.8 + 0.2 * 0.45) / 2)
    assert hits[2].confidence < 0.5
    # The component scores are kept as they were, and id_rule says the blend was halved,
    # so the UI breakdown stays honest.
    assert hits[2].semantic_score == 1.0
    assert hits[2].id_rule == "halved"
    # Already strong on its own: the rule changed nothing, so there is nothing to explain.
    assert hits[1].id_rule is None


def test_an_exact_id_match_is_always_strong():
    weak = Candidate(1, keyword_rank=0.4, term_coverage=1.0, cosine=0.25, has_query_ids=True)
    hit = score([weak], "hybrid", PARAMS)[0]
    assert (hit.confidence, hit.id_rule) == (0.5, "raised")


def test_queries_without_ids_are_not_affected():
    candidate = Candidate(1, keyword_rank=0.0, term_coverage=0.0, cosine=0.6, has_query_ids=None)
    hit = score([candidate], "hybrid", PARAMS)[0]
    assert hit.confidence == pytest.approx(0.5)
    assert hit.id_rule is None


def test_id_rule_off_marks_nothing():
    # The eval's --no-guards run sets the factor to 1.0: no score changes, so no "halved".
    params = ScoringParams(0.2, 0.6, 0.8, 0.2, 0.2, 10, id_mismatch_factor=1.0)
    other = Candidate(2, keyword_rank=0.9, term_coverage=0.5, cosine=0.9, has_query_ids=False)
    assert score([other], "hybrid", params)[0].id_rule is None


def test_gibberish_keeps_only_results_with_matching_words():
    meaning_only = Candidate(1, keyword_rank=0.0, term_coverage=0.0, cosine=0.6)
    word_match = Candidate(2, keyword_rank=0.6, term_coverage=1.0, cosine=0.3)
    known = score([meaning_only, word_match], "hybrid", PARAMS, query_has_known_words=True)
    unknown = score([meaning_only, word_match], "hybrid", PARAMS, query_has_known_words=False)
    assert {hit.source_id for hit in known} == {1, 2}
    assert [hit.source_id for hit in unknown] == [2]
