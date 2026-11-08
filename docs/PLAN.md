# Conntour Space Explorer — implementation plan

## Context

Eli has a home assignment from Conntour (https://github.com/join-conntour/conntour-space-explorer). Conntour's product is natural-language search over camera video, so the search part carries the most weight.
Requirements: (1) browse the NASA images from `/api/sources` with metadata, (2) free-text search with a confidence score for each result, (3) search history: revisit, delete one entry, paginate, (4) one creative "special feature", documented in the README with screenshots/GIF.
Eli presents tomorrow (2026-11-09) and must explain every part. So the code must stay small, layered, and boring where it can be. A design handoff from Claude Design arrives later; I own all the code. Eli runs Docker locally; I can run and test it.

What the scaffold gives us (I read every file):
- Backend: FastAPI + async SQLAlchemy + Postgres. Layers: `controllers/` → `repositories/` (generic `Repository[T]` ABC) → `db/`. One endpoint, `GET /api/sources`, which returns all rows.
- `backend/scripts/seed_db.py` runs on **every** backend start and calls `drop_all`. Once we add history tables, every restart would erase the search history. We must fix this, and it is a good talking point.
- The seed throws away most of the metadata: `nasa_id`, `center`, `keywords`, `photographer`, `location`, thumbnail link, `description_508`. The data has 100 images, all `media_type=image`. 50 have `location`, all have `center`, and the Mars (JPL) captions include `Latitude/Longitude`.
- Frontend: CRA (`react-scripts 5`, deprecated) + TS 4.9 + Tailwind 3 + axios. One `Sources.tsx` grid.
- Infra: compose (db, backend, nginx frontend), a dev compose with hot reload, nginx proxies `/api`.

## Decisions (answers to Eli's questions)

**Semantic search: text embeddings, not CLIP.** I agree with your idea. I make it the engine of requirement 2, not the special feature:
- The captions here are rich and specific. Many images are press photos (people, rooms, ceremonies), where CLIP pixel scores are noisy and hard to turn into an honest "confidence".
- A small text model (`BAAI/bge-small-en-v1.5`, 384 dims, about 67 MB ONNX through `fastembed`, no torch) handles "red planet" → Mars. It runs offline, it is deterministic, and its scores are easy to calibrate.
- **Hybrid** = Postgres full-text rank (exact words: names, mission IDs like "STS-135") + pgvector cosine (meaning). Both run in **one SQL query**. Python only embeds the query. The scale story: add a GIN index and an HNSW index and the same query serves millions of rows.
- Safety: if the model fails to load, the engine falls back to keyword-only and the UI says so. The demo cannot break.
- Proof: `scripts/eval_search.py` holds about 12 labeled queries. It prints precision@5 for keyword, semantic and hybrid. That answers "how do you know the search is good?", which matters for a search company.

**Special feature: "Where in space" scene.** Every image gets a place anywhere in space, not only on Earth. Eli confirmed this. Places are **detected ahead of time and hardcoded**; nothing is guessed at runtime:
- `backend/data/places.json` holds one entry for each of the 100 images: `{nasa_id, body: earth|orbit|moon|mars|deep_space, lat, lon, label, provenance}`. Provenance is one of `caption` / `location field` / `NASA center (approx.)` / `manual`.
- How I build the file:
  1. A one-off script (`scripts/build_places.py`) drafts the entries with rules:
     - Mars: parse `Latitude/Longitude` from the caption.
     - Earth: map the ~25 location strings to coordinates, then fall back to the 10 NASA center coordinates.
     - Orbit: `iss…`/`sts…` IDs, EVA, ISS keywords.
     - Deep space: Saturn, WISE, asteroids, telescopes.
  2. I review all 100 entries by hand against the caption and fix them, then commit the file. The seed loads it.
  3. Code to explain: a lookup, plus a small tested script.
- Scene levels: Earth ground → orbit ring → Moon (if any) → Mars → deep-space shell. Dense Earth spots (KSC 39, JSC 28) become one **cluster pin** that fans out on click.
- The card shows provenance ("from the caption" vs "approx.: NASA center").
- Frontend: a lazy-loaded react-three-fiber scene. Click a pin: the camera flies there and the image card opens.
- **It connects to search:** run a query and the scene lights the matching pins, dims the rest, and shows the confidence. "See where your results are."
- **Style:** minimal line art on near-black, following Eli's reference (Curiosity traverse screenshot):
  - A fine dot-grid background texture.
  - Faint grey thin lines for coastlines / Mars contours / orbits (`world-atlas` topojson, no tile servers).
  - Bright white thin lines only for the active item.
  - Sparse light-grey labels.
  - A left **year rail** ("today, 2025, 2023 … 1950"; the data spans 1950–2024). It filters pins by `date_created`, with the active year in white and the rest dim.

  I reuse ideas and small helpers from iss-now (lat/lon → vector), not the app. Eli's design handoff can override the details.

**Frontend tooling: move CRA → Vite + TS 5.** Why:
- CRA is deprecated.
- `react-scripts 5` pins TypeScript ≤4, and current `three`/R3F types need TS 5.
- Vite also replaces `setupProxy.js` with 5 lines of config.
- Low risk: `index.html` moves, the build dir changes `build` → `dist` in the Dockerfile, and the dev command changes.

We keep Tailwind 3 (tokens in `tailwind.config` / CSS variables, so the design handoff only replaces tokens and components). We add TanStack Query (cache, `useInfiniteQuery` for pagination, mutations for delete) and react-router (the URL holds the state: `/search?q=` and `/history/:id` can be shared and revisited). We remove axios and use `fetch` in one typed `api/client.ts`.

## Architecture

### Backend (extends the scaffold's layering: controllers → services → repositories → db)
```
backend/
  app.py              routers, lifespan: CREATE EXTENSION vector, create_all, load embedder once
  config.py           env settings + search constants (weights, threshold, calibration) in one place
  models.py           Pydantic API schemas: Source, Place, SearchHit, SearchDetail, SearchSummary, CursorPage[T]
  db/models.py        SourceModel (+ nasa_id, center, keywords[], photographer, location, thumb_url,
                      place_* columns, embedding Vector(384), search_vector TSVECTOR computed column
                      weighted A=title, B=keywords, C=description),
                      SearchModel(id, query, created_at, result_count, engine),
                      SearchResultModel(search_id FK ON DELETE CASCADE, source_id FK, rank, confidence,
                      keyword_score, semantic_score)  ← snapshot of what was returned
  repositories/       base.py (keep the ABC, add get_by_id), source.py (paged + filters),
                      search.py (hybrid SQL CTE), history.py (create, keyset list, get, delete)
  services/           embedding.py (Embedder protocol, FastEmbedEmbedder, NullEmbedder),
                      search.py (embed → hybrid query → calibrate → persist → return)
  data/places.json    hand-reviewed place for every image (loaded by the seed)
  controllers/        source.py, searches.py, health
  scripts/seed_db.py  idempotent: create tables, insert only when empty, fill missing embeddings/places
  scripts/eval_search.py, scripts/build_places.py (one-off draft generator)
  tests/              test_places.py (every source has a valid place), test_scoring.py (pure); test_api.py (httpx ASGITransport,
                      separate test DB, FakeEmbedder)
```
`pgvector` Python package for the SQLAlchemy `Vector` type. No Alembic (justification: `create_all` + idempotent seed is enough for one-shot schema; Alembic is the first step for production). After this change, an old dev volume needs `docker compose down -v` once.

### API contract (fixed up front so backend and frontend work in parallel)
- `GET /api/sources?limit=24&offset=0&center=&body=` → `{items: Source[], total}`
- `GET /api/sources/{id}` → `Source` (full metadata + `place`)
- `GET /api/sources/{id}/similar?limit=6` → `SearchHit[]` (cheap with embeddings; "more like this" in the image modal)
- `POST /api/searches {query}` → `SearchDetail {id, query, created_at, engine, results: SearchHit[]}`, where `SearchHit = {source, confidence, keyword_score, semantic_score, rank}`
- `GET /api/searches?limit=20&cursor=` → `{items: SearchSummary[], next_cursor}`, with `SearchSummary = {id, query, created_at, result_count, preview_thumbs[≤3]}`
- `GET /api/searches/{id}` → `SearchDetail` (the stored snapshot, not a re-run)
- `DELETE /api/searches/{id}` → 204
- `GET /api/places` → a light list for the scene `{source_id, title, thumb_url, body, lat, lon, provenance}`
- `GET /api/health` → `{db, embedder: "bge-small" | "keyword-only"}`

Key choices to explain:
- History uses **keyset pagination** (`created_at desc, id desc`, opaque base64 cursor). Offset slows down as the table grows and shifts rows when you delete one; keyset does not.
- Search runs on submit, not on each keystroke, so history stays clean.
- Each run is a history entry. The results are a **snapshot**, so if the ranking changes later, history still shows what the user saw.
- History is global: there is no auth (the next step is a per-user `owner_id`).

### Confidence score
- Postgres CTE: `kw = ts_rank_cd(search_vector, or_query, 32)` (an OR of the query lexemes, so "images of Mars rovers" does not need every word), and `sem = 1 - (embedding <=> :qvec)`.
- Calibrate each to 0–1: `sem_conf = clamp((cos − floor)/(ceil − floor))`, `kw_conf = min(1, kw/kw_ref)`.
- `confidence = 0.65·sem_conf + 0.35·kw_conf`. Return rows with `confidence ≥ threshold`, at most 50.
- The eval script tunes floor/ceil/weights/threshold. They live in `config.py`.
- The UI shows the confidence as a badge, and on hover the breakdown "Meaning 82% · Words 40%", plus matched words highlighted in the title.

### Frontend (Vite + React 18 + TS 5 + Tailwind 3 + TanStack Query + react-router)
```
frontend/src/
  api/          client.ts (typed fetch), types.ts (mirrors Pydantic schemas)
  hooks/        useSources, useSource, useSearch (mutation), useHistory (infinite), useDeleteSearch,
                usePlaces
  pages/        BrowsePage (/), SearchPage (/search?q=), HistoryPage (/history),
                HistoryDetailPage (/history/:id), ScenePage (/scene, React.lazy)
  components/   ImageCard, ImageGrid, ImageModal (metadata, place, similar), SearchBar, ConfidenceBadge,
                HistoryItem, Filters, EmptyState/ErrorState/Skeleton, Layout/Nav
  scene/        SpaceScene.tsx, Earth.tsx, Mars.tsx, OrbitRing.tsx, Pins.tsx, cameraFly.ts, geo.ts
```
Presentational components (`components/`) are split from data hooks, so the design handoff touches only `components/`, the tokens and `scene/` styling. Browse uses infinite scroll (24 per page) with center/body filters (bonus filtering). Delete in history is optimistic with rollback.

### Infra
- `db` image → `pgvector/pgvector:pg16`.
- Backend Dockerfile: copy `uv.lock`, `uv sync --frozen --no-dev`, bake the model at build time into `/models` (`FASTEMBED_CACHE_PATH`, outside the `./backend:/app` bind mount).
- Frontend Dockerfile: `dist`. Dockerfile.dev: `vite --host 0.0.0.0 --port 3001`.
- Ports stay at 5001/3001/5433.

## Execution (main session orchestrates; Opus subagents implement, per Eli's preference)

0. **Me:** switch `gh` to eli8levit, fork, clone to `~/Developer/conntour-space-explorer`, and commit the plan as `docs/PLAN.md`. Check that ports 5001/3001/5433 are free. Run `pgrep` before any GUI or browser test.
1. **Agent A: backend core** (owns `backend/`, `docker-compose*.yml`): schema, idempotent seed, sources/search/history APIs, embedder + fallback, hybrid SQL, `build_places.py` draft + `places.json`, `/api/places`, pytest, eval script. Test against the real compose stack. **Then I review all 100 places by hand** before the scene work depends on them.
2. **Agent B: frontend core**, in parallel (owns `frontend/`): Vite migration, router, query client, all pages against the contract above, neutral token-based styling. Test against A's stack when it is up. Until then use the vite dev server with typed fixtures.
3. **Agent C: scene**, after A ships `/api/places`. It works in this order, so a simple version is always demo-ready:
   - (a) levels + pins + click → card, in the dot-grid line-art style;
   - (b) cluster fan-out + year rail;
   - (c) search highlighting + camera fly.
4. **Me: independent validation**:
   - `docker compose up --build` from a clean volume, and a restart to confirm history survives.
   - curl every endpoint.
   - pytest + eval numbers.
   - The browser pass (Chrome) through every requirement, plus the GIF of the scene.
5. **Me: docs for the presentation**:
   - README "Special feature" section (name / why / implementation / demo GIF).
   - `docs/ARCHITECTURE.md`: mermaid component diagram, the request flow of one search, ERD, decisions + trade-offs, "at scale I would…", and a Q&A cheat sheet for "explain any part".
6. **When the design handoff arrives:** apply tokens/components, then validate again.

Each phase lands as small commits with clear messages, so the git history reads well in the review. No push without Eli's go.

## Verification
- `docker compose down -v && docker compose up --build`: the stack is healthy, `/api/health` reports `embedder: bge-small`, and the frontend is on :3001.
- `docker compose restart backend`: history rows are still there (the seed bug is fixed).
- Search checks: "red planet" returns Mars images without the word Mars; "STS-135" ranks the exact keyword hits first; "solar flares" returns low or no confidence (that topic is not in the data), and the UI says "no strong matches".
- History: 30+ searches → keyset "load more" works, deleting one updates the list, and opening an entry shows the stored snapshot.
- `docker compose exec backend uv run pytest` passes. `uv run python scripts/eval_search.py` prints the P@5 table and hybrid ≥ the others.
- Browser: every page at desktop and phone width, the scene loads lazily, pins are clickable, search highlights show in the scene, and the console has no errors.
