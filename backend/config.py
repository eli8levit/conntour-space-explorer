"""Settings in one place: environment for infrastructure, constants for search tuning.

The search constants were tuned with `scripts/eval_search.py`; change them there, not ad hoc.
"""

import os

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5433/space_explorer",
)

# The Dockerfile downloads this model at build time, so it must match the build ARG.
# all-MiniLM-L6-v2 beat bge-small-en-v1.5 in scripts/eval_search.py (hybrid P@5 0.79 vs
# 0.69) and separates on-topic from off-topic text far better (see the eval notes).
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
EMBEDDING_DIM = 384
# Set to "0" to force keyword-only mode (useful to demo the fallback).
EMBEDDINGS_ENABLED = os.getenv("EMBEDDINGS_ENABLED", "1") != "0"

# --- Search scoring (see services/scoring.py), tuned with scripts/eval_search.py --tune ---
# Raw cosine is not a usable "confidence": unrelated captions still score ~0.1, and the
# best matches in this data rarely pass ~0.6. We stretch that band linearly to 0..1.
SEMANTIC_FLOOR = 0.10  # cosine at or below this counts as "unrelated" -> 0
SEMANTIC_CEIL = 0.55  # cosine at or above this counts as "clearly about it" -> 1
# confidence = average of meaning and words. Equal weights won the tuning plateau, and
# "half meaning, half words" is the easiest rule to explain to a user.
SEMANTIC_WEIGHT = 0.5
KEYWORD_WEIGHT = 0.5
MIN_CONFIDENCE = 0.25
MAX_RESULTS = 50
# Results at or above this are "strong" matches (orange in the UI). The frontend mirrors
# this value in one place; change both together.
STRONG_MATCH = 0.5
# Rows each retriever (keyword, vector) may contribute before scoring. At 100 rows
# this is "all of them"; at scale it keeps the scoring step small.
CANDIDATE_POOL = 200

MAX_QUERY_LENGTH = 200
