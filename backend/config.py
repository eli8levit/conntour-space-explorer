"""Settings in one place: environment for infrastructure, constants for search tuning.

The search constants were tuned with `scripts/eval_search.py`; change them there, not ad hoc.
"""

import os

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5433/space_explorer",
)

# Origins allowed to call the API from another origin (comma-separated). See app.py.
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3001,http://localhost:5173").split(
        ","
    )
    if origin.strip()
]

# The Dockerfile downloads this model at build time, so it must match the build ARG.
# all-MiniLM-L6-v2 beat bge-small-en-v1.5 in scripts/eval_search.py (hybrid P@5 0.82 vs
# 0.68) and separates on-topic from off-topic text far better (see the eval notes).
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
EMBEDDING_DIM = 384
# Set to "0" to force keyword-only mode (useful to demo the fallback).
EMBEDDINGS_ENABLED = os.getenv("EMBEDDINGS_ENABLED", "1") != "0"

# --- Search scoring (formula in services/scoring.py), tuned with eval_search.py --tune ---
# Raw cosine is not a usable "confidence": unrelated captions still score ~0.2, and the
# best matches in this data reach ~0.7. We stretch that band linearly to 0..1.
# The ceiling was 0.50 until 2026-11-09: every Mars caption (cosine ~0.55 to "mars rover")
# then read as "100% meaning", as did a real rover photo (0.67), so the difference the
# model saw was erased and only 30% of "strong" results were relevant. At 0.70 that is
# 55%, with the same top-5 and recall (eval_search.py, "relevant among strong").
SEMANTIC_FLOOR = 0.20  # cosine at or below this counts as "unrelated" -> 0
SEMANTIC_CEIL = 0.70  # cosine at or above this counts as "clearly about it" -> 1
# confidence = 80% meaning + 20% matching words. Meaning carries the score, so a match
# on meaning alone can still be strong; words lift exact hits (e.g. "STS-135") to the top.
SEMANTIC_WEIGHT = 0.8
KEYWORD_WEIGHT = 0.2
# Lowered with the ceiling (0.20 -> 0.12): the stretched meaning scores are lower now, and
# 0.12 keeps recall where it was (0.97) without strong off-topic results.
MIN_CONFIDENCE = 0.12
# If the query names an ID (STS-135, Expedition 61), images with that exact ID are raised
# to at least STRONG_MATCH, and images without it get their confidence multiplied by this.
# Confidence is always < 1 (the word score is rank / (rank + 1)), so with 0.5 they can
# never reach STRONG_MATCH.
ID_MISMATCH_FACTOR = 0.5
MAX_RESULTS = 50
# Results at or above this are "strong" matches (orange in the UI). The frontend mirrors
# this value in one place; change both together.
STRONG_MATCH = 0.5
# Rows each retriever (keyword, vector) may contribute before scoring. At 100 rows
# this is "all of them"; at scale it keeps the scoring step small.
CANDIDATE_POOL = 200

MAX_QUERY_LENGTH = 200
