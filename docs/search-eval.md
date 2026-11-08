# Search evaluation

This page explains how the search was measured, which choices the measurements led to,
and where the remaining limit is.

## How it is measured

`backend/scripts/eval_search.py` contains 14 queries. For each query, I read the 100
captions and wrote down which images a person would expect. There are also 3 off-topic
queries ("solar flares", "black hole", "deep sea fishing"). Nothing in the data is
really about these topics.

For each query, the script measures:

- **P@5**: how many of the top 5 results are relevant. It divides by min(5, number of
  relevant images), so a query with only 2 relevant images can still score 1.0.
- **Recall**: how many relevant images come back at all (above the minimum confidence).
- **Relevant and strong**: how many relevant images reach confidence 0.5 or higher. The
  UI shows these results in orange.
- **Off-topic results**: how many results the 3 off-topic queries return. The number in
  brackets is how many of them are strong. That number should be 0.

Run it inside the backend container, where the model is available:

```
docker compose exec backend python scripts/eval_search.py          # the table
docker compose exec backend python scripts/eval_search.py --tune   # grid search for the constants
```

The script does not store anything. It calls the retrieval and scoring code directly.

## How confidence is calculated

> Confidence is 80% how close the meaning is and 20% how many of your words the image's
> text contains.

```
meaning    = clamp((cosine - 0.20) / (0.50 - 0.20), 0, 1)
words      = ts_rank_cd(search_vector, query, 32) * (query words found / query words)
confidence = 0.8 * meaning + 0.2 * words
```

- Results under 0.20 are dropped. Results at 0.50 or higher are "strong".
- One SQL query gets both raw scores. Then `services/scoring.py` turns them into the
  confidence.
- If the model cannot load, search switches to keyword-only, and confidence = words.

## Final results (all-MiniLM-L6-v2, constants above)

```
query                              keyword P@5/R    semantic P@5/R      hybrid P@5/R
red planet                             0.00/0.00         0.60/0.83         0.60/0.67
images of Mars rovers                  1.00/1.00         0.75/1.00         1.00/1.00
rover                                  0.60/0.60         0.60/1.00         0.80/1.00
space shuttle launch                   0.67/1.00         0.00/1.00         0.67/1.00
astronaut spacewalk                    0.40/0.60         0.80/1.00         0.80/1.00
Saturn                                 1.00/1.00         0.50/1.00         1.00/1.00
STS-135                                1.00/1.00         0.67/1.00         1.00/1.00
Russian cosmonaut training             0.75/0.75         0.50/1.00         0.75/1.00
rocket engine test                     1.00/1.00         0.33/1.00         0.67/1.00
animals                                0.00/0.00         1.00/1.00         1.00/1.00
storm seen from space                  0.50/0.50         1.00/1.00         1.00/1.00
Apollo moon mission                    0.33/0.33         1.00/1.00         1.00/1.00
Soyuz                                  0.80/1.00         0.80/1.00         0.80/1.00
life aboard the space station          0.00/0.33         0.40/0.67         0.40/0.83
------------------------------------------------------------------------------------
mean                                   0.57/0.65         0.64/0.96         0.82/0.96
relevant and strong                         0.34              0.75              0.72
off-topic results (strong)                 1 (0)            11 (1)             5 (0)
```

Hybrid search is better than either half alone:

- Keyword search finds exact words such as "STS-135" or "Soyuz", but it misses "red
  planet" and "animals". No caption contains those words.
- Meaning search finds those, but its top 5 is noisier, and it returns more off-topic
  results.

## Choice 1: how to combine meaning and words

Each formula below got its own tuned constants (a grid search over floor, ceiling,
weight and threshold).

| Formula | P@5 | Recall | Relevant and strong | Off-topic | "STS-135" order |
|---|---|---|---|---|---|
| 50% meaning + 50% words (first version) | 0.79 | 0.90 | 0.59 | 2 | correct |
| Noisy-OR: 1 - (1 - meaning)(1 - words) | 0.82 | 0.96 | 0.71 | 5 | wrong |
| meaning × (α + (1 - α) × words) | 0.78 | 0.96 | 0.71 | 5 | correct |
| max(meaning, 50/50 average) | 0.76 | 0.96 | 0.72 | 5 | wrong |
| **80% meaning + 20% words (chosen)** | **0.82** | **0.96** | **0.72** | **5, none strong** | **correct** |

- **The problem with 50/50:** a match on meaning alone could never score above 0.5, so
  it could never be strong.
- **Why noisy-OR and max() fail:** every STS-* caption gets the full meaning score of 1.0,
  so the words cannot lift the real STS-135 photos above the other STS missions.
- **Why 80/20:** it has the best numbers, it keeps exact hits first, and it is a
  one-sentence rule.

## Choice 2: which embedding model

All models run on CPU through fastembed. Each model got its own tuned constants with the
80/20 formula.

- **Size** is the ONNX files on disk.
- **Latency** is the median time to embed one query on a laptop CPU (Apple Silicon).
- **"red planet" strong** is how many Mars images in its top 10 reach 0.5.
- **Parker** is the confidence of the Parker Solar Probe result for "solar flares". It
  should stay under 0.5.

| Model | Size | Latency | P@5 | Recall | Relevant and strong | Off-topic (strong) | "red planet" strong | Parker | "STS-135" top 3 |
|---|---|---|---|---|---|---|---|---|---|
| **all-MiniLM-L6-v2 (chosen)** | 87 MB | 0.7 ms | **0.82** | **0.96** | 0.72 | 5 (0) | 0 | 0.49 | correct |
| bge-small-en-v1.5 | 64 MB | 1.5 ms | 0.68 | 0.90 | 0.73 | 1 (0) | 0 | 0.47 | correct |
| bge-base-en-v1.5 (quantized) | 208 MB | 7.8 ms | 0.74 | 0.89 | 0.81 | 1 (1) | 0 | 0.77 | correct |
| snowflake-arctic-embed-s | 128 MB | 2.4 ms | 0.73 | 0.89 | 0.74 | 2 (1) | 0 | 0.61 | correct |
| snowflake-arctic-embed-m | 416 MB | 7.4 ms | 0.72 | 0.88 | 0.85 | 0 (0) | 3 | not returned | correct |
| nomic-embed-text-v1.5 (quantized) | 132 MB | 3.4 ms | 0.66 | 0.83 | 0.72 | 1 (0) | 0 | 0.49 | correct |
| jina-embeddings-v2-small-en | 124 MB | 1.2 ms | 0.74 | 0.88 | 0.64 | 2 (0) | 1 | 0.45 | correct |
| granite-embedding-small-english-r2 | 188 MB | 1.9 ms | 0.79 | 0.98 | 0.75 | 5 (0) | 0 | 0.49 | correct |
| gte-base | 416 MB | 4.5 ms | 0.79 | 0.95 | 0.86 | 1 (1) | 0 | 0.75 | correct |

Notes on the sweep:

- bge, snowflake and nomic were run with their recommended query prefixes ("Represent
  this sentence for searching relevant passages: ", "search_query: " / "search_document: ").
- The sweep took the keyword scores from the live database (read only) and computed the
  meaning scores in memory for each model. Its MiniLM row matches the eval table above
  exactly, which shows that the setup is the same.

**Decision: keep all-MiniLM-L6-v2.**

- It has the best P@5 and almost the best recall. It is also one of the smallest and
  fastest models.
- Only snowflake-arctic-embed-m makes "red planet" find strong Mars images while
  "solar flares" stays faint. But it is 416 MB, which is over the ~250 MB budget for a
  small cloud VM. It also has a lower P@5 (0.72) and recall (0.88).
- The larger general models (bge-base, gte-base) give more strong results, but they
  also make Parker Solar Probe a strong match for "solar flares". That is a strong
  off-topic result, which is the error the UI should avoid most.

## The remaining limit

- **The problem:** MiniLM gives "red planet" → Lycus Sulci (a Mars image) about the same
  cosine as "solar flares" → Parker Solar Probe (a Sun mission, not about flares).
- **The consequence:** any calibration that makes the Mars images strong also makes Parker
  strong. So "red planet" finds the right images in the right order, but it shows them as
  faint matches (up to 0.42).
- **Next steps:**
  - Use a larger model, as arctic-embed-m shows, when the budget allows.
  - Use a query-expansion step ("red planet" → "Mars").
  - Use a cross-encoder re-ranker on the top 20 results.
