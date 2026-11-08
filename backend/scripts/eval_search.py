#!/usr/bin/env python
"""
Offline relevance check: how good is the search, and is hybrid better than either half?

Usage (inside the backend container, which has the model):
    docker compose exec backend python scripts/eval_search.py

Each query lists the nasa_ids a person would expect, chosen by reading the captions.
Metrics, per mode:
- P@5: relevant results in the top 5, divided by min(5, number of relevant images), so a
  query with 2 relevant images can still score 1.0.
- Recall: relevant images returned at all (above the confidence threshold).
- Strong: relevant images returned with confidence >= STRONG_MATCH (shown orange in the UI).
- Noise: results returned for queries whose topic is not in the data (should be ~0),
  and how many of those were "strong" (should be 0).
- Gibberish: results for non-words like "zzqx" (should be 0).
- ID queries: strong results for "STS-135" / "Expedition 61" without that ID (should be 0).
Nothing is stored: this calls the retrieval and scoring code directly, not the API.
`--tune` grid-searches the constants in config.py. `--no-guards` turns off the gibberish
and ID rules, to show what they change.
"""

import asyncio
import itertools
import os
import sys
from dataclasses import dataclass

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import CANDIDATE_POOL, STRONG_MATCH  # noqa: E402
from db import AsyncSessionLocal, engine  # noqa: E402
from repositories import SearchIndexRepository, SourceRepository  # noqa: E402
from services.embedding import load_embedder  # noqa: E402
from services.scoring import Candidate, Mode, ScoringParams, query_ids, score  # noqa: E402

LABELS: dict[str, set[str]] = {
    # Mars surface images; most never say "red" or "planet".
    "red planet": {"PIA22505", "PIA05528", "PIA13637", "PIA05956", "PIA03574", "PIA05475"},
    "images of Mars rovers": {"PIA22505", "PIA05475", "201308060007HQ", "NHQ202102170001"},
    "rover": {"PIA22505", "PIA05475", "201308060007HQ", "NHQ202102170001", "7120051"},
    "space shuttle launch": {"61c-s-047", "sts129-s-077", "KSC-82PC-0331"},
    "astronaut spacewalk": {
        "S113E05187",
        "s124e005902",
        "iss059e001429",
        "iss003e6264",
        "jsc2010e187206",
    },
    "Saturn": {"PIA17654", "7120051"},
    "STS-135": {"jsc2011e060425", "jsc2011e050068", "jsc2010e187206"},
    "Russian cosmonaut training": {
        "jsc2017e135207",
        "jsc2015e104060",
        "KSC-00pp1156",
        "20030506_exp6pconf_01",
    },
    "rocket engine test": {
        "KSC-04pd1644",
        "MAF_20240828_ES4toPegasus-09",
        "MAF_071424_Victor Glover Visits Pegasus-BH-7",
    },
    "animals": {"KSC-2014-1692", "KSC-2011-1022"},
    "storm seen from space": {"GSFC_20171208_Archive_e001170", "PIA13962"},
    "Apollo moon mission": {"LRC-1965-B701_P-04828", "7120051", "S67-15795"},
    "Soyuz": {
        "NHQ202002060027",
        "jsc2018e025510",
        "jsc2020e016992",
        "201405280008HQ",
        "NHQ201909240001",
    },
    # ID queries: only these exact images may be strong (see ID_QUERIES).
    "Expedition 61": {"NHQ202002060027", "NHQ201909240001"},
    "life aboard the space station": {
        "iss034e031142",
        "iss034e010621",
        "iss020e031128",
        "iss067e359856",
        "iss020e042187",
        "iss071e608493",
    },
}
# Topics that are not in the data: every result is noise.
NEGATIVES = ["solar flares", "black hole", "deep sea fishing"]
# Not words at all: must return nothing.
GIBBERISH = ["zzqx", "asdfgh qwerty", "lorem ipsum"]
# Queries naming an ID: a strong result without that ID is an error.
ID_QUERIES = ["STS-135", "Expedition 61"]
MODES: list[Mode] = ["keyword", "semantic", "hybrid"]


@dataclass
class Row:
    p_at_5: float
    recall: float
    strong_recall: float


@dataclass
class Noise:
    off_topic: int  # results for NEGATIVES
    off_topic_strong: int
    gibberish: int  # results for GIBBERISH (should be 0)
    strong_without_id: int  # strong results for ID_QUERIES that lack the ID (should be 0)


@dataclass
class Retrieved:
    candidates: list[Candidate]
    known_words: bool  # does the model know any word of the query?


Candidates = dict[str, Retrieved]


async def fetch_candidates() -> tuple[Candidates, dict[int, str]]:
    """Run retrieval once per query; scoring is pure, so every mode and every parameter
    set can then be evaluated in memory."""
    embedder = load_embedder()
    if embedder.name == "keyword-only":
        sys.exit("The model did not load; run this inside the backend container.")
    async with AsyncSessionLocal() as session:
        sources = await SourceRepository(session).get_all()
        index = SearchIndexRepository(session)
        candidates = {
            query: Retrieved(
                await index.candidates(
                    query, embedder.embed_query(query), CANDIDATE_POOL, query_ids(query)
                ),
                embedder.knows_any_word(query),
            )
            for query in [*LABELS, *NEGATIVES, *GIBBERISH]
        }
    return candidates, {source.id: source.nasa_id for source in sources}


def evaluate(
    candidates: Candidates,
    nasa_id: dict[int, str],
    params: ScoringParams,
    modes: list[Mode] = MODES,
):
    def run(query: str, mode: Mode):
        retrieved = candidates[query]
        return score(retrieved.candidates, mode, params, retrieved.known_words)

    results: dict[Mode, list[Row]] = {mode: [] for mode in modes}
    noise: dict[Mode, Noise] = {}
    for mode in modes:
        for query, relevant in LABELS.items():
            hits = [(nasa_id[h.source_id], h.confidence) for h in run(query, mode)]
            top5 = sum(1 for n, _ in hits[:5] if n in relevant)
            found = sum(1 for n, _ in hits if n in relevant)
            strong = sum(1 for n, c in hits if n in relevant and c >= STRONG_MATCH)
            k = len(relevant)
            results[mode].append(Row(top5 / min(5, k), found / k, strong / k))
        off_topic = [hit for q in NEGATIVES for hit in run(q, mode)]
        wrong_id = [
            hit
            for q in ID_QUERIES
            for hit in run(q, mode)
            if hit.confidence >= STRONG_MATCH and nasa_id[hit.source_id] not in LABELS[q]
        ]
        noise[mode] = Noise(
            off_topic=len(off_topic),
            off_topic_strong=sum(1 for h in off_topic if h.confidence >= STRONG_MATCH),
            gibberish=sum(len(run(q, mode)) for q in GIBBERISH),
            strong_without_id=len(wrong_id),
        )
    return results, noise


def mean(rows: list[Row], field: str) -> float:
    return sum(getattr(row, field) for row in rows) / len(rows)


def tune(candidates: Candidates, nasa_id: dict[int, str]) -> None:
    """Grid search for the hybrid constants. The objective favours a good top 5, then
    recall and relevant results that reach "strong", and charges for every off-topic
    result (more for a strong one). With 14 queries this is a sanity check against bad
    constants, not a claim of optimality."""
    scored = []
    for floor, ceil, w_sem, threshold in itertools.product(
        [0.05 * i for i in range(1, 15)],  # semantic floor 0.05 .. 0.70
        [0.05 * i for i in range(6, 19)],  # semantic ceil 0.30 .. 0.90
        [0.5, 0.6, 0.7, 0.8, 0.9],  # semantic weight
        [0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5],  # min confidence
    ):
        if ceil - floor < 0.1:
            continue
        params = ScoringParams(floor, ceil, w_sem, 1 - w_sem, threshold)
        results, noise = evaluate(candidates, nasa_id, params, ["hybrid"])
        hybrid = results["hybrid"]
        p5, recall, strong = (mean(hybrid, f) for f in ("p_at_5", "recall", "strong_recall"))
        n = noise["hybrid"]
        objective = (
            p5
            + 0.5 * recall
            + 0.5 * strong
            - 0.02 * n.off_topic
            - 0.1 * (n.off_topic_strong + n.gibberish + n.strong_without_id)
        )
        scored.append((objective, params, p5, recall, strong, n.off_topic))
    scored.sort(key=lambda item: -item[0])
    for objective, params, p5, recall, strong, off_topic in scored[:10]:
        print(
            f"obj={objective:.3f} P@5={p5:.2f} R={recall:.2f} strong={strong:.2f} "
            f"noise={off_topic:2d}  "
            f"floor={params.semantic_floor:.2f} ceil={params.semantic_ceil:.2f} "
            f"w_sem={params.semantic_weight} "
            f"min={params.min_confidence}"
        )


def print_table(results, noise) -> None:
    print(f"\n{'query':30s}" + "".join(f"{mode + ' P@5/R':>18s}" for mode in MODES))
    for i, query in enumerate(LABELS):
        cells = "".join(
            f"{results[mode][i].p_at_5:>13.2f}/{results[mode][i].recall:.2f}" for mode in MODES
        )
        print(f"{query:30s}{cells}")
    print("-" * 84)
    means = "".join(
        f"{mean(results[m], 'p_at_5'):>13.2f}/{mean(results[m], 'recall'):.2f}" for m in MODES
    )
    print(f"{'mean':30s}{means}")
    print(
        f"{'relevant and strong':30s}"
        + "".join(f"{mean(results[m], 'strong_recall'):>18.2f}" for m in MODES)
    )
    rows = [
        ("off-topic results (strong)", lambda n: f"{n.off_topic} ({n.off_topic_strong})"),
        ("gibberish results", lambda n: str(n.gibberish)),
        ("ID queries: strong, no ID", lambda n: str(n.strong_without_id)),
    ]
    for label, cell in rows:
        print(f"{label:30s}" + "".join(f"{cell(noise[m]):>18s}" for m in MODES))


async def main() -> None:
    try:
        candidates, nasa_id = await fetch_candidates()
    finally:
        await engine.dispose()
    if "--tune" in sys.argv:
        tune(candidates, nasa_id)
    elif "--no-guards" in sys.argv:  # the scoring before the two guard rules, to compare
        params = ScoringParams(id_mismatch_factor=1.0, gibberish_guard=False)
        print_table(*evaluate(candidates, nasa_id, params))
    else:
        print_table(*evaluate(candidates, nasa_id, ScoringParams()))


if __name__ == "__main__":
    asyncio.run(main())
