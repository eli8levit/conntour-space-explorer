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
- Noise: results returned for queries whose topic is not in the data (should be ~0).
Nothing is stored: this calls the retrieval and scoring code directly, not the API.
`--tune` grid-searches the constants in config.py.
"""

import asyncio
import itertools
import os
import sys
from dataclasses import dataclass

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import CANDIDATE_POOL  # noqa: E402
from db import AsyncSessionLocal, engine  # noqa: E402
from repositories import SearchIndexRepository, SourceRepository  # noqa: E402
from services.embedding import load_embedder  # noqa: E402
from services.scoring import Candidate, Mode, ScoringParams, score  # noqa: E402

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
MODES: list[Mode] = ["keyword", "semantic", "hybrid"]


@dataclass
class Row:
    p_at_5: float
    recall: float


Candidates = dict[str, list[Candidate]]


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
            query: await index.candidates(query, embedder.embed_query(query), CANDIDATE_POOL)
            for query in [*LABELS, *NEGATIVES]
        }
    return candidates, {source.id: source.nasa_id for source in sources}


def evaluate(
    candidates: Candidates,
    nasa_id: dict[int, str],
    params: ScoringParams,
    modes: list[Mode] = MODES,
):
    results: dict[Mode, list[Row]] = {mode: [] for mode in modes}
    noise: dict[Mode, int] = {mode: 0 for mode in modes}
    for mode in modes:
        for query, relevant in LABELS.items():
            returned = [nasa_id[hit.source_id] for hit in score(candidates[query], mode, params)]
            top5 = sum(1 for n in returned[:5] if n in relevant)
            found = sum(1 for n in returned if n in relevant)
            results[mode].append(Row(top5 / min(5, len(relevant)), found / len(relevant)))
        for query in NEGATIVES:
            noise[mode] += len(score(candidates[query], mode, params))
    return results, noise


def mean(rows: list[Row], field: str) -> float:
    return sum(getattr(row, field) for row in rows) / len(rows)


def tune(candidates: Candidates, nasa_id: dict[int, str]) -> None:
    """Grid search for the hybrid constants. The objective favours a good top 5, then
    recall, and charges for every off-topic result. With 14 queries this is a sanity
    check against bad constants, not a claim of optimality."""
    scored = []
    for floor, ceil, w_sem, threshold in itertools.product(
        [0.05 * i for i in range(1, 15)],  # semantic floor 0.05 .. 0.60
        [0.05 * i for i in range(6, 19)],  # semantic ceil 0.30 .. 0.90
        [0.5, 0.6, 0.7, 0.8],  # semantic weight
        [0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55],  # min confidence
    ):
        if ceil - floor < 0.1:
            continue
        params = ScoringParams(floor, ceil, w_sem, 1 - w_sem, threshold)
        results, noise = evaluate(candidates, nasa_id, params, ["hybrid"])
        hybrid = results["hybrid"]
        objective = mean(hybrid, "p_at_5") + 0.5 * mean(hybrid, "recall") - 0.02 * noise["hybrid"]
        scored.append((objective, params, mean(hybrid, "p_at_5"), mean(hybrid, "recall"), noise))
    scored.sort(key=lambda item: -item[0])
    for objective, params, p5, recall, noise in scored[:10]:
        print(
            f"obj={objective:.3f} P@5={p5:.2f} R={recall:.2f} noise={noise['hybrid']:2d}  "
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
    print(f"{'off-topic results':30s}" + "".join(f"{noise[m]:>18d}" for m in MODES))


async def main() -> None:
    try:
        candidates, nasa_id = await fetch_candidates()
    finally:
        await engine.dispose()
    if "--tune" in sys.argv:
        tune(candidates, nasa_id)
    else:
        print_table(*evaluate(candidates, nasa_id, ScoringParams()))


if __name__ == "__main__":
    asyncio.run(main())
