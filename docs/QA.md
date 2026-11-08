# Q&A cheat sheet

Short answers to likely questions. Each answer points to the code. The long version is in
[ARCHITECTURE.md](ARCHITECTURE.md). The search numbers are in [search-eval.md](search-eval.md).

## Search

**1. Walk me through one search.**
The search dock posts the query. The backend embeds it in a threadpool, runs one SQL query that
gets keyword and vector candidates, scores them in Python, stores the search and its results in one
commit, and reads the snapshot back (`backend/services/search.py`). The frontend puts the response
in the React Query cache and navigates to `/search/:id` inside a View Transition
(`frontend/src/hooks/searches.ts`).

**2. Why hybrid search?**
Each half misses what the other finds. Full-text finds exact IDs like "STS-135" but not "red
planet" or "animals", and vectors find meaning but give a noisier top 5. Hybrid P@5 is 0.82,
keyword-only is 0.57, and semantic-only is 0.64 (`docs/search-eval.md`).

**3. How is confidence calculated?**
`confidence = 0.8 × meaning + 0.2 × words`. Meaning is the cosine stretched from 0.20–0.50 to
0–1, and words is `ts_rank_cd(..., 32)` times the share of query words found
(`backend/services/scoring.py`). The constants are in `backend/config.py`.

**4. Why 80/20 and not 50/50?**
With 50/50, a match on meaning alone could never pass 0.5, so it could never be strong. The eval
compared five formulas. 80/20 had the best P@5 and recall and kept "STS-135" in the right order
(`docs/search-eval.md`, "Choice 1").

**5. Is the confidence a probability?**
No. It is a calibrated score from 0 to 1. The constants were tuned so that relevant images reach
0.5 or more ("strong") and off-topic queries get no strong results. The labeled eval measures both.

**6. Why is "red planet" only a faint match?**
MiniLM gives "red planet" → Lycus Sulci (Mars) a cosine of 0.359. This is the same as "solar
flares" → Parker Solar Probe, which is off-topic. Any calibration that makes the Mars images strong
also makes Parker strong, so I kept Mars faint (best 0.42) but in the right order. The fixes are a
bigger model, query expansion, or a re-ranker (`docs/search-eval.md`, "The remaining limit").

**7. Why an OR query, not AND?**
`plainto_tsquery` ANDs the words, so "images of Mars rovers" would need all four. The SQL replaces
`&` with `|`, so each matching word adds to the rank (`backend/repositories/search.py`). The
coverage factor then gives a partial match only partial credit.

**8. What is "term coverage" for?**
With OR, "solar flares" would give full word credit to a "Parker Solar Probe" title. Coverage
multiplies the word score by "words found / query words", so it gets half
(`keyword_confidence` in `backend/services/scoring.py`).

**9. Why weights A, B, C in the full-text column?**
A word in the title (A) should count more than the same word in the keywords (B) or in the long
caption (C). The column is generated, so Postgres keeps it up to date (`SEARCH_VECTOR_SQL` in
`backend/db/models.py`).

**10. Why MiniLM and not bge-small, as in the plan?**
I measured nine models with their own tuned constants. all-MiniLM-L6-v2 had the best P@5 (0.82 vs
0.68 for bge-small), is small (87 MB) and fast (0.7 ms per query) (`docs/search-eval.md`, "Choice 2").

**11. Why not CLIP?**
The captions are rich, and many images are press photos of people, rooms and ceremonies. CLIP
image scores are noisy there and hard to turn into an honest confidence. A text model is small,
runs offline, and is deterministic. CLIP image vectors would be a good third signal for images
with short captions, but that is a next step.

**12. What happens if the model fails to load?**
`load_embedder` catches the error and returns a `NullEmbedder` (`backend/services/embedding.py`).
Search runs keyword-only (`engine: "keyword"`), `/api/health` says `degraded` (still HTTP 200),
and the score breakdown shows only "Words" (the new design has no separate banner for this). The seed leaves embeddings NULL, so a later
start with the model fills them. `EMBEDDINGS_ENABLED=0` forces this mode for a demo.

**13. Why embed the query in a threadpool?**
ONNX inference is synchronous CPU work. On the async event loop it would block every other request
while it runs, so `score_query` uses `run_in_threadpool` (`backend/services/search.py`).

**14. Why calibrate in Python instead of SQL?**
The formula is pure functions with unit tests (`backend/tests/test_scoring.py`). The eval script
gets the candidates once per query and then re-scores thousands of constant sets in memory
(`--tune` in `backend/scripts/eval_search.py`). The cost is small: at most 400 candidates per query.

**15. How do you test search quality?**
`backend/scripts/eval_search.py` has 14 queries with hand-labeled relevant images and 3 off-topic
queries. It prints P@5, recall, "relevant and strong" and off-topic results for keyword, semantic
and hybrid, and `--tune` grid-searches the constants. Run it with
`docker compose exec backend python scripts/eval_search.py`.

**16. Isn't the tuning overfit to 14 queries?**
Yes, partly. It is a sanity check against bad constants, not a proof (the docstring of `tune` says
this). With more time I would add more queries and keep a held-out set that the tuning never sees.

**17. Why does "STS-135" also show other STS missions as strong?**
Many STS captions have a cosine of 0.50 or more with "STS-135", so their meaning score is the full
1.0. The
20% word score puts the real STS-135 photos first, but the neighbours still score high. A re-ranker
would fix this.

**18. Why search on submit, not on each keystroke?**
Each run is a history entry. Typing "m", "ma", "mar" must not create three entries
(`frontend/src/components/SearchDock.tsx`).

## History

**19. Why snapshot instead of re-running?**
The requirement is to see the results again, which means what the user saw. A re-run would show
different results after the model, the constants or the data change. A snapshot is also a fast
primary-key read (`backend/repositories/history.py`, `get_by_id`).

**20. Why keyset pagination?**
Offset gets slower as you go deeper, and a delete shifts rows, so offset can skip or repeat
items. Keyset continues from `(created_at, id)` of the last row, uses the matching index
`ix_searches_created_at_id`, and costs the same at any depth. The `id` breaks ties when two
searches have the same `created_at`. A test checks that an old cursor still works after a delete
(`backend/tests/test_api.py`).

**21. Then why does the sources API use offset, and why does the archive load all 100?**
The catalogue has 100 fixed rows and does not change while you browse, so offset is fine there
(a comment in `backend/repositories/source.py` says this). The new archive canvas shows every image
at once, so it loads all 100 in one request (`useArchive` in `frontend/src/hooks/sources.ts`). At
scale both would change: keyset pages or viewport tiles. The index `ix_sources_date_created_id`
already matches the order.

**22. Why is the cursor opaque base64?**
The client only passes it back, so the key format can change without breaking the API. The
decoder rejects bad input with 400, including a naive datetime or a non-integer id
(`backend/services/cursor.py`).

**23. How does the history drawer work?**
It opens with `?history=1` on any page, so the page behind stays mounted and Back closes it
(`frontend/src/hooks/useHistoryDrawer.ts`). It loads 10 searches per page with a "Show 10 older
searches" button, groups rows by day, and shows "N images, K strong, best X%" from the summary
fields (`frontend/src/components/HistoryDrawer.tsx`).

**24. Is the delete really safe with undo?**
Yes. The row hides at once, but the DELETE request goes out only after 6 seconds, so Undo just
cancels the timer and there is nothing to restore on the server (`frontend/src/components/UndoDelete.tsx`).
If the tab closes during the 6 seconds, the request goes out with `keepalive`. If the DELETE fails,
the optimistic mutation puts the row back (`useDeleteSearch` in `frontend/src/hooks/searches.ts`).
On the server it is one statement, the results go with it (`ON DELETE CASCADE`), and a second
delete gives 404. One limit: another open tab still shows the row during the 6 seconds.

**25. Why optimistic delete?**
The row disappears at once, so the UI feels instant (after the undo window). `onMutate` saves the old pages and removes
the row, `onError` restores them, and `onSettled` refetches to sync with the server.

**26. Why is history global?**
There is no auth in the assignment. The next step is an `owner_id` on `searches`, and every
history query filtered by it.

## Backend design

**27. Why repositories return Pydantic models?**
Nothing above the repositories depends on SQLAlchemy (`backend/repositories/base.py`). In async
SQLAlchemy, touching a lazy relationship outside the session fails, and plain models avoid that.
The mapping is also where the flat `place_*` columns become a nested `place` (`to_source` in
`backend/repositories/source.py`).

**28. Why is `HistoryRepository` not a `Repository[T]`?**
History grows without limit, so it must not have a `get_all`. It has only pages
(`backend/repositories/history.py`). The search index is a query, not an entity store, so it is
not a `Repository[T]` either.

**29. Why no Alembic?**
The schema is created once from the models, and every statement in `backend/db/schema.py` is
idempotent. For a demo that is enough. `create_all` never changes an existing table, so Alembic is
the first production step.

**30. What was wrong with the original seed?**
It called `drop_all` on every start. With a history table, every restart would erase the history.
Now each step only fills what is missing (`backend/scripts/seed_db.py`).

**31. Why bake the model into the Docker image?**
Startup needs no network and cannot fail on a download. After the download, `HF_HUB_OFFLINE=1`
makes any accidental download fail fast (`backend/Dockerfile`).

**32. What does `/api/health` report?**
`status` (`ok`, `degraded` or `down`), `db`, and `embedder` (`minilm` or `keyword-only`). It returns
503 only when the database is down, because keyword-only search still serves users
(`backend/controllers/health.py`).

**33. How are the backend tests isolated?**
They use a separate database, `space_explorer_test`, dropped and re-seeded on every run. Each test
truncates `searches`. A `FakeEmbedder` (bag-of-words hashing) replaces the 90 MB model
(`backend/tests/conftest.py`).

## Frontend

**34. Why Vite instead of CRA?**
CRA is deprecated, and `react-scripts 5` blocks TypeScript 5, which current three.js and R3F types
need. Vite replaces the dev proxy with a few lines of config (`frontend/vite.config.ts`) and is
much faster.

**35. Why React Query and no global store?**
Almost all state is server state: lists, details, history. React Query gives caching, loading and
error states, infinite pages and optimistic mutations. The rest of the state lives in the URL.

**36. Why put state in the URL?**
A view can be shared, survives a reload, and Back works. Examples: `/search/:id`, `?image=<id>` for
the modal (`frontend/src/hooks/useImageParam.ts`), `?history=1` for the drawer, `?from=&to=` for the
year range on results (`frontend/src/hooks/useResultView.ts`), and `/scene?focus=` and `?search=`.

**37. How does the results page open with no second request, and how does the reflow work?**
`useRunSearch` puts the POST response in the cache under `["search", id]` before it navigates, and
`useSearch` has `staleTime: Infinity`. The navigation runs in `document.startViewTransition`
(`frontend/src/lib/viewTransition.ts`). Each photo has the same `view-transition-name` on both
pages, so it glides from the archive canvas to its ranked size and place.

**38. Why is the scene lazy-loaded?**
three.js is large. With `React.lazy` (`frontend/src/App.tsx`) the scene is its own chunk: 916 kB
(254 kB gzip), against 266 kB (84 kB gzip) for the rest of the app. The archive, the results and
the history never download it.

## The scene

**39. How does the scene stay fast?**
All pins are one `THREE.Points` cloud, cluster markers are a second one, and the leader lines are
one `LineSegments`. Each body's line art is one draw call (`frontend/src/scene/MarkerLayer.tsx`,
`frontend/src/scene/lines.ts`). The canvas renders on demand (`frameloop="demand"`), and the HTML
labels move with CSS transforms from a per-frame callback, without React renders.

**40. Why HTML labels and not 3D text?**
HTML text is sharp at any zoom, uses the real font, and needs no font atlas. Each frame,
`frontend/src/scene/Overlay.tsx` projects the 3D anchors to pixels with the same math as picking,
so labels, clicks and pins always agree.

**41. How does clustering work?**
A greedy pass: each pin joins the first cluster whose first member is within 2.5° (about 280 km on
Earth). Otherwise it starts a new cluster (`frontend/src/scene/cluster.ts`). A fixed angle keeps the
groups stable while you zoom. A click fans the cluster out on a sunflower spiral, with a line back
to each true spot.

**42. Where do the places come from? Is anything guessed at runtime?**
No. `backend/scripts/build_places.py` drafted a place for each image from rules (caption
coordinates, ID patterns, the location field, NASA centers). Then I reviewed all 100 by hand: 27
entries differ from the draft. The result is `backend/data/places.json`, with a provenance for each
place, which the UI shows.

**43. Why is the scene not to scale?**
Mars is about 12,000 Earth radii away, so at real scale every level would be a dot. Planet sizes
keep their real ratio, the orbit rings keep the real inclinations, and the distances between levels
are only "far enough to read as travel" (`frontend/src/scene/layout.ts`). The page says "Not to scale".

**44. What if the browser has no WebGL?**
An error boundary (`WebGLBoundary` in `frontend/src/pages/ScenePage.tsx`) shows a message, and the
rest of the app still works.

## Scale, security, next steps

**45. What breaks at 1M images?**
- The seed embeds all missing rows in one call at start, so it needs batching and a job queue.
- `/api/places` returns every row, and the scene clusters on the CPU, so both need server-side clusters for the visible area.
- An HNSW scan returns at most `hnsw.ef_search` rows (40 by default), so the 200-row candidate pool needs a higher setting or iterative scans.
- Ranking every full-text match with `ts_rank_cd` gets expensive for common words.
- The archive loads every image in one request, and the history `count(*)` runs on every page. They need keyset pages and an estimated or cached count.

The GIN and HNSW indexes are already there.

**46. What are the security concerns of the public demo?**
- There is no auth, so anyone can read or delete any search.
- The Worker limits `POST` and `DELETE` on `/api/searches` to 10 per minute per IP (`deploy/worker/src/index.ts`). But the VM's port 80 is open, so a client can skip the Worker. A Cloudflare Tunnel or a firewall that allows only Cloudflare would close this.
- CORS allows every origin (`backend/app.py`, from the scaffold). It is not needed, because the app is same-origin.
- Queries are 1–200 characters and SQL parameters are bound.
- React escapes all text. The seed strips HTML from captions.
- The production database has no host port (`docker-compose.prod.yml`).

**47. Why a Cloudflare Worker in front of the VM?**
It gives HTTPS on the custom domain and a rate limit, with no certificates or extra software on the
VM. It forwards every request to `ORIGIN` (`deploy/worker/wrangler.toml`).

**48. What does the default compose file run?**
`docker compose up --build` starts Postgres with pgvector, the backend on 5001 (seed, then uvicorn),
and nginx with the built frontend on 3001 (`docker-compose.yml`). The real production file is
`docker-compose.prod.yml`. It has no host ports for db and backend, a password from `.env`, and no
hot reload.

**49. What would you do with more time?**
- A cross-encoder re-ranker on the top 20, and query expansion (this fixes "red planet").
- A larger eval set with a held-out split.
- Auth and per-user history.
- Alembic.
- Cached query embeddings.
- Async embedding of new images.
- Observability: latency, keyword-only rate and "no strong match" rate.
- CLIP image vectors as a third signal.

**50. What are you most proud of, and what is the weakest part?**
Proud: the search is measured, not guessed, and every constant has a reason in the eval. Weakest:
the confidence for close neighbours (other STS missions) and for paraphrases ("red planet") still
depends on a small model. The next step is a re-ranker.
