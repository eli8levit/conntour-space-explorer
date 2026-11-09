# Search evaluation

This page explains how the search was measured, which choices the measurements led to,
and where the remaining limit is.

Update 2026-11-09 (commit 8d4b9f0): `SEMANTIC_CEIL` moved from 0.50 to 0.70 and `MIN_CONFIDENCE`
from 0.20 to 0.12. The final results table and "The strong tier" section use the new constants.
"Choice 1", "Choice 2" and "Choice 3" are history. They were measured with the old constants
(ceil 0.50, min 0.20), and their numbers are not re-run.

## How it is measured

`backend/scripts/eval_search.py` contains 15 labeled queries. For each query, I read the
100 captions and wrote down which images a person would expect. It also has:

- 3 off-topic queries ("solar flares", "black hole", "deep sea fishing"). Nothing in the
  data is really about these topics.
- 3 gibberish queries ("zzqx", "asdfgh qwerty", "lorem ipsum"). They must return nothing.
- 2 ID queries ("STS-135", "Expedition 61"). Only the images with that exact ID may be
  strong.

For each query, the script measures:

- **P@5**: how many of the top 5 results are relevant. It divides by min(5, number of
  relevant images), so a query with only 2 relevant images can still score 1.0.
- **Recall**: how many relevant images come back at all (above the minimum confidence).
- **Relevant and strong**: how many relevant images reach confidence 0.5 or higher. The
  UI shows these results in orange.
- **Relevant among strong**: the share of strong (orange) results that are relevant. The number in
  brackets is how many strong results there are. It tells how far to trust an orange result.
  P@5 does not measure this.
- **Off-topic results**: how many results the 3 off-topic queries return. The number in
  brackets is how many of them are strong. That number should be 0.
- **Gibberish results**: how many results the gibberish queries return. It should be 0.
- **ID queries: strong, no ID**: how many strong results for an ID query do not contain
  that ID. It should be 0.

Run it inside the backend container, where the model is available:

```
docker compose exec backend python scripts/eval_search.py          # the table
docker compose exec backend python scripts/eval_search.py --tune   # grid search for the constants
docker compose exec backend python scripts/eval_search.py --no-guards   # without the two rules below
```

The script does not store anything. It calls the retrieval and scoring code directly.

## How confidence is calculated

> Confidence is 80% how close the meaning is and 20% how many of your words the image's
> text contains.

```
meaning    = clamp((cosine - 0.20) / (0.70 - 0.20), 0, 1)
words      = ts_rank_cd(search_vector, query, 32) * (query words found / query words)
confidence = 0.8 * meaning + 0.2 * words
```

- Results under 0.12 are dropped. Results at 0.50 or higher are "strong". A cosine of 0.70 or
  more counts as 100% meaning. (Until 2026-11-09 the band was 0.20–0.50 and the minimum was 0.20.)
- Two guard rules come after the formula (see "Choice 3"):
  1. **Gibberish:** if the model knows none of your words, only results that contain one
     of your words can appear.
  2. **IDs:** if you type an ID (STS-135, Expedition 61, PIA22505), images with that
     exact ID are strong matches, and images without it cannot be.
- One SQL query gets both raw scores. Then `services/scoring.py` turns them into the
  confidence.
- If the model cannot load, search switches to keyword-only, and confidence = words.

## Final results (all-MiniLM-L6-v2, constants above, both guard rules on)

```
query                              keyword P@5/R    semantic P@5/R      hybrid P@5/R
red planet                             0.00/0.00         0.60/0.83         0.60/0.67
images of Mars rovers                  1.00/1.00         0.75/1.00         1.00/1.00
rover                                  0.80/1.00         0.60/1.00         0.80/1.00
space shuttle launch                   0.67/1.00         0.67/1.00         0.67/1.00
astronaut spacewalk                    0.40/0.80         0.80/1.00         0.80/1.00
Saturn                                 1.00/1.00         0.50/1.00         1.00/1.00
STS-135                                1.00/1.00         1.00/1.00         1.00/1.00
Russian cosmonaut training             0.75/1.00         0.75/1.00         0.75/1.00
rocket engine test                     1.00/1.00         0.33/1.00         0.67/1.00
animals                                0.00/0.00         1.00/1.00         1.00/1.00
storm seen from space                  0.50/0.50         1.00/1.00         1.00/1.00
Apollo moon mission                    0.33/1.00         1.00/1.00         1.00/1.00
Soyuz                                  0.80/1.00         0.80/1.00         0.80/1.00
Expedition 61                          1.00/1.00         1.00/1.00         1.00/1.00
life aboard the space station          0.00/1.00         0.40/0.67         0.40/0.83
------------------------------------------------------------------------------------
mean                                   0.62/0.82         0.75/0.97         0.83/0.97
relevant and strong                         0.38              0.56              0.51
relevant among strong                  0.46 ( 41)         0.52 ( 56)         0.55 ( 47)
off-topic results (strong)                 3 (0)            11 (0)             6 (0)
gibberish results                              0                 0                 0
ID queries: strong, no ID                      0                 0                 0
```

The "semantic" column is for comparison only, and the app never uses it. (With the old
ceiling its "ID queries: strong, no ID" was 7, because a full meaning score of 1.0 halved is
exactly 0.5. With ceil 0.70 it is 0.) In hybrid mode, confidence is always below 1, so a halved
score always stays under 0.5.

Hybrid search is better than either half alone:

- Keyword search finds exact words such as "STS-135" or "Soyuz", but it misses "red
  planet" and "animals". No caption contains those words.
- Meaning search finds those, but its top 5 is noisier, and it returns more off-topic
  results.

## The strong tier (2026-11-09)

The table above had one blind spot: P@5 and recall do not say whether the orange results are right.
I added the metric "relevant among strong" and measured the old constants. Only 30% of strong results
were relevant (132 strong results across the eval).

- **The cause:** with the ceiling at 0.50, every cosine of 0.50 or more read as "Meaning 100%". For
  "mars rover", a real rover photo (cosine 0.67, Focus on El Capitan-2) and an orbital Mars photo
  with no rover (0.55, Lycus Sulci, whose caption is just "Lycus Sulci" with the keyword Mars) were both 100%.
  So orbital photos were strong at 81–85%.
- **The sweep** (floor 0.20, weight 0.8), relevant among strong: ceil 0.60 gave 0.48, ceil 0.65 gave 0.51,
  ceil 0.70 gave 0.55. Raising the floor hurt P@5 and recall badly.
- **The second change:** at ceil 0.70, lowering `MIN_CONFIDENCE` from 0.20 to 0.12 brought recall back
  to 0.97 and P@5 to 0.83. Floor 0.20, weights 80/20, `STRONG_MATCH` 0.5, the ID rule and the gibberish
  rule did not change.
- **The effect on the other columns:** keyword P@5/recall went from 0.60/0.67 to 0.62/0.82, and semantic from
  0.69/0.97 to 0.75/0.97. Hybrid stayed at 0.83/0.97. In hybrid, "relevant among strong" is 0.55 (47 strong
  results). Keyword is 0.46 (41) and semantic 0.52 (56). Off-topic results are 3, 11 and 6, and none is strong.
- **Live checks (hybrid):** "mars rover" has 7 strong of 19: El Capitan 86%, Curiosity anniversary 77%,
  Perseverance marble countdown 70%, Gale Crater 63%, then orbital Lycus Sulci 61%, Ganges Chasma 56% and
  Ophir Chasma 51%. "astronaut spacewalk" has 3 strong of 50 (it was 16). "STS-135" has 3 strong, all with
  the ID. "animals" finds the heron (22%) and the manatees (13%), now faint.
- **The limit that remains:** MiniLM reads "mars rover" as mostly "Mars". Raw cosine of "mars rover" with
  "mars" is 0.74, and with "the Curiosity rover drives on Mars" 0.81. A rule that partial matches of a
  multi-word query cannot be strong, or a re-ranker, is the next step.

## Choice 1: how to combine meaning and words

(History: measured with ceil 0.50.)

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
  meaning scores in memory for each model. Its MiniLM row matched the eval table of that
  time exactly, which shows that the setup is the same. The sweep ran before the guard
  rules, which is why it says 0.82 / 0.96 and the final table says 0.83 / 0.97.

**Decision: keep all-MiniLM-L6-v2.**

- It has the best P@5 and almost the best recall. It is also one of the smallest and
  fastest models.
- Only snowflake-arctic-embed-m makes "red planet" find strong Mars images while
  "solar flares" stays faint. But it is 416 MB, which is over the ~250 MB budget for a
  small cloud VM. It also has a lower P@5 (0.72) and recall (0.88).
- The larger general models (bge-base, gte-base) give more strong results, but they
  also make Parker Solar Probe a strong match for "solar flares". That is a strong
  off-topic result, which is the error the UI should avoid most.

## Choice 3: two guard rules

These problems showed up live:

- "zzqx" returned "CAS Quantum Technologies" at 0.25.
- "STS-135" returned 30 strong results, among them STS-129 and other missions at ~0.85.
  The meaning score is 1.0 for every STS caption, so only the words separated them.

**Rule 1, gibberish:** if the model knows none of your words, only results that contain
one of your words can appear.

- A word the model knows is one token in its vocabulary ("planet"). An unknown word is
  split into pieces ("zzqx" becomes z, ##z, ##q, ##x).
- For a query made only of unknown words, the vector has no meaning to compare. So
  matches on meaning alone are dropped, and exact word matches still count.
- Rare real words also split into pieces ("manatee", "cosmonaut"). They still work,
  because the archive contains them. For example, "manatee" finds the manatee photo by
  keyword. It only loses the extra matches on meaning alone (the heron).

**Rule 2, IDs:** if you type an ID, images with that exact ID are strong matches, and
images without it cannot be.

- An ID is a word that contains a digit (STS-135, PIA22505, MS-13). A bare number keeps
  the word before it: "Expedition 61", not "61".
- A year (1900–2099) is a date, not an ID: "launch in 2011" names no ID. Before this
  rule, it raised five images that contain "2011" to 0.50 and halved the rest. A standalone
  year is never an ID, whatever word comes before it ("Apollo 1969" must not halve every
  image without that exact phrase).
- SQL checks each ID as a phrase. "STS-135" is the lexemes `sts` and `-135` next to each
  other, so a caption that has "STS" and "135" far apart does not count.
- Images with the ID are raised to at least 0.5. Images without it get half their score.
  This is always under 0.5, because the words score is rank / (rank + 1) < 1.
- The NASA id is now part of the full-text index (weight A), so "PIA22505" finds Gale
  Crater.

Hybrid mode, without the rules (`--no-guards`) and with them (history: measured with ceil 0.50 and min 0.20):

| | Without the rules | With the rules |
|---|---|---|
| P@5 / recall | 0.80 / 0.97 | 0.83 / 0.97 |
| Relevant and strong | 0.74 | 0.74 |
| Off-topic results (strong) | 5 (0) | 5 (0) |
| Gibberish results | 1 | 0 |
| ID queries: strong, no ID | 36 | 0 |
| "Expedition 61" P@5 | 0.50 | 1.00 |

The rest of the 15 labeled queries did not change. The tuner still picks the same
constants (floor 0.20, ceil 0.50, 80/20, min 0.20). Those were the constants until 2026-11-09.

**What the rules do not fix:**

- (Measured until 2026-11-09:) "solar flares" still returned "Mars briefing" at 0.22, as a faint result.
- A higher bar for matches on meaning alone would remove it, but it would also remove
  the manatees for "animals" (0.22 then, 13% now). Their meaning scores are the same (cosine 0.282 and
  0.283), so no principled bar can keep one and drop the other.
- I also tested a bar relative to the query's own score distribution (a z-score). It did
  not separate gibberish from real queries either: "zzqx" stands out from the archive
  more than "red planet" does.

## The remaining limit

- **The problem:** MiniLM gives "red planet" → Lycus Sulci (a Mars image) about the same
  cosine as "solar flares" → Parker Solar Probe (a Sun mission, not about flares).
- **The consequence:** any calibration that makes the Mars images strong also makes Parker
  strong. So "red planet" shows only faint matches (9 results, none strong, best Lycus Sulci 25%; it was
  0.42 until 2026-11-09). The order was not clean when measured before that change: ranks 1, 2, 5 and 7 were
  Mars images, but ranks 3 and 4 were an infrared asteroid chart and the WISE mission logo (its P@5 is 0.60).
- **A second limit:** a short query like "mars rover" is read as mostly "Mars", so some orbital photos
  stay strong (see "The strong tier").
- **Next steps:**
  - Use a larger model, as arctic-embed-m shows, when the budget allows.
  - Use a query-expansion step ("red planet" → "Mars").
  - Use a cross-encoder re-ranker on the top 20 results.
