# Space Explorer — design handoff ("Signal")

For the Claude Code session building `conntour-space-explorer`. This is the design-only part. It does not replace `docs/PLAN.md`: the backend, API contract, routes, hooks and data layer in that plan stay as they are. This doc says what each screen looks like and how it behaves, mapped onto the code that already exists in the frontend worktree.

**Deadline:** Mon 9 Nov, 19:00 (Asia/Jerusalem). The priorities in §12 assume that.

**Files in this folder**
| File | What it is |
|---|---|
| `HANDOFF.md` | This spec |
| `tokens.css` | Drop-in replacement for the `:root` block in `frontend/src/index.css` |
| `screens/A1-browse.jpg` … `A4-history.jpg` | Clean renders at 2× (2880×1800) of the 1440×900 design |
| `screens/*.annotated.jpg` | The same renders with numbered cyan callouts. Each number maps to a numbered note in §5–§8 (e.g. **A2·9** = screen A2, callout 9) |
| `reference/A1-browse.dc.html` … `A4-history.dc.html` | The design source: plain HTML with inline styles. Open it to read exact sizes and colors. Image URLs inside (`/_blob/…`) are design-tool placeholders and will not load, so use `thumb_url`/`image_url` from the API |

> **The numbers in the mockups are not the backend's numbers.** The mockups were scored with a simple keyword formula (title 100% / keywords 80% / description 50%, averaged per word). The real backend uses the hybrid score in `services/scoring.py` (65% meaning + 35% words, min 0.35). Build every percentage, count and "why it matched" line from the API, never from the mockups. The **layout rules** are the spec, not the values.

> **Some thumbnails in the mockups are stand-ins** (e.g. "Curiosity Rover's First Anniversary" shows a Parker Solar Probe photo) because the design tool couldn't download every NASA image. Ignore which photo appears where.

---

## 1. Concept in one paragraph

The whole archive is one dark, slowly drifting canvas of photos (A1). There is no "home page" and no list: you see all 100 images at once, with small annotations. The search box sits at the bottom, like a command line. When you search, the same canvas **reflows by rank** (A2): rank 1 becomes the biggest frame, frames shrink as confidence drops, and everything that didn't match fades to 16% grey. A ranking list on the right and a year timeline under the results explain the result set. Clicking any frame opens a large details modal (A3) with the full image, real NASA description and metadata, why it matched, and where in space it was taken. That last part links into the 3D Space view, the special feature. History (A4) is a drawer that slides out from the left edge over whatever page you're on.

One accent color (orange `#FF5A1F`) means exactly one thing: **strong match / active**. Everything else is warm greys on near-black. Corners are square everywhere.

---

## 2. Screens and routes (mapped to the existing router)

| Screen | Design file | Existing route / component | Notes |
|---|---|---|---|
| A1 Browse: the whole archive | `A1-browse.dc.html` | `/` → `BrowsePage` | Load all 100 sources (`GET /api/sources?limit=100`). No pagination and no filter bar on this screen. |
| A2 Search results | `A2-search-results.dc.html` | `/search/:id` → `SearchResultsPage` | Submit → `POST /api/searches` → navigate to `/search/{id}`. Reopening from History uses the same route (stored snapshot). |
| A3 Image details | `A3-image-details.dc.html` | `?image=<id>` → `ImageModal` (via `useImageParam`) | A modal over A1 or A2. Keep the existing URL behavior (Back closes it). |
| A4 History | `A4-history.dc.html` | `/history` → `HistoryPage` | Rendered as a **left drawer over the page behind it**. Recommended: `?history=1` on any route, so the page behind stays mounted, and `/history` redirects to `/?history=1`. If changing the router is too much, render `/history` as the A1 canvas with the drawer open. Either is fine. |
| Space view (special feature) | not designed here | `/scene` → `ScenePage` (lazy) | Keep the line-art style from `PLAN.md`. This doc only defines the entry points into it (A3·13) and the shared tokens (§9). |

**Global keyboard:** `/` focuses search. `Enter` submits. `Esc` closes the modal → closes the drawer → clears search (in that order of precedence). `↑`/`↓` step through results on A2. `←`/`→` move to the previous/next result in A3.

---

## 3. Tokens

Use `tokens.css`. It keeps the variable names already in `tailwind.config.ts` and adds `soft`, `accent`, `accent-text` and `bar-faint`.

**Color roles (strict)**
- `accent` `#FF5A1F`: fills and bars for **strong** matches, the active search box border, the hovered-frame brackets, the current-history-row bar. Never decorative.
- `accent-text` `#FF8A5C`: the same meaning when it's text (percentages, rank numbers in the rail). `#FF5A1F` passes contrast (6.4:1) but looks heavy and slightly blurry as thin small text on near-black; `#FF8A5C` (8.6:1) reads cleaner. Convention: fills use `accent`, text uses `accent-text`.
- Faint matches use `fg` (off-white) badges and `bar-faint` bars, so orange always means "this one is good".
- Text: `fg` primary, `soft` long descriptions, `muted` labels, `faint` hints and axis labels.

**Typography: Instrument Sans only (400 / 500 / 600)**
- Install `@fontsource/instrument-sans` and import weights 400, 500 and 600. **Remove** `@fontsource/inter` and `@fontsource/ibm-plex-mono`.
- There is **no monospace**. NASA IDs, coordinates, years and percentages use the same font with `font-variant-numeric: tabular-nums` (set on `body`).
- **Sentence case everywhere.** No uppercase labels, no letter-spaced small caps. (Eli's explicit feedback: uppercase-mono labels read as "AI slop".)
- `body { letter-spacing: 0.006em }`. Large text gets negative tracking (below).

| Use | Size / weight / tracking | Where |
|---|---|---|
| Drawer title "History" | 56 / 400 / −0.03em, line-height 1 | A4·1 |
| Modal title | 44 / 400 / −0.025em, lh 1 | A3·6 |
| Big match % in modal | 40 / 400 / −0.03em | A3·10 |
| History query | 27 / 400 / −0.02em | A4·5 |
| Rank-1 badge / % on the rank-1 frame | 26 / 600 badge, 26 / 400 % | A2·2–3 |
| Search input text | 22 (A1) / 24 (A2), weight 400 | A1·9, A2·14 |
| Rank-1 caption title | 19 / 400 | A2·3 |
| Wordmark "Space Explorer" | 17 / 600 / −0.01em | A1·1 |
| Description body | 15 / 400, lh 1.6, color `soft` | A3·7 |
| Rail title, metadata values, buttons | 14–15 / 400–500 | |
| Default UI text | 13 / 400 | |
| Labels, hints, ticks | 12 (11 for the smallest hint lines) / 400, `muted` or `faint` | |

**Spacing and shape**
- Grid gap **8px** everywhere photos tile. Page side padding 32px (header) and 48px (content).
- `border-radius: 0` on everything except the two timeline handles (2px).
- Borders are 1px (`line` or `line-strong`). The orange search border is 1px.
- Shadows only on floating things: the search dock `0 20px 50px rgba(0,0,0,.6)`, the modal `0 40px 120px rgba(0,0,0,.7)`, the drawer `40px 0 120px rgba(0,0,0,.6)`.

---

## 4. Shared components (what to change in `src/components/`)

| Component | Change |
|---|---|
| `Layout` | Fixed 64px header bar over the canvas: `bg` at 90% opacity + `backdrop-filter: blur(14px)`, 1px bottom `line`. Left: wordmark + "100 images from the NASA Image Library" (13, `faint`). Center: a status line (see A1·2 / A2·1). Right: keyboard hints (13, `faint`). There are **no nav links in the header**: History is the left edge tab and Space view is reached from the modal (plus one entry point, §9). |
| `SearchBar` | Becomes the **search dock** (A1·8–10, A2·11–15): a bottom-anchored floating bar. Details in §5 and §6. |
| `ImageCard` → **Frame** | A photo tile with no border and no radius, `object-fit: cover`, placeholder fill `raised`. Variants: *idle* (A1), *hovered* (A1·5–6), *ranked* (A2·2–5), *dimmed* (A2·6). |
| `ImageGrid` | Two layouts: the drifting dense canvas (A1) and the ranked reflow (A2). See §5 and §6 for the grid rules. |
| `ConfidenceBadge` | Becomes **RankBadge** + **MatchBar** (A2·2–3). Two tiers only: strong ≥ 0.50 → orange, faint < 0.50 → off-white. Replace `confidenceLevel` (high/medium/low) with `isStrong(c) = c >= 0.5`, defined in one place as `STRONG_MATCH = 0.5`. |
| `HighlightedText` | Keep the logic. Restyle `mark` as an orange underline (`tokens.css`). Use it in the A3 description as well as titles. |
| `HistoryItem` | Rebuilt as the A4 row (§8). |
| `ImageModal` | Rebuilt as A3 (§7). |
| `EmptyState` / `ErrorState` / `Skeleton` | Restyle with the tokens. Copy in §10. |
| **New: `YearTimeline`** | §6.4. Used large on A2 and small in A3. |
| **New: `Toast`** | The undo toast (A4·12). |
| **New: `LocatorMini`** | The small "where this was seen" figure in A3 (§7, A3·12). |

---

## 5. A1 — Browse: the whole archive

`screens/A1-browse.annotated.jpg`

**Layout**
- A full-viewport canvas (`overflow: hidden`, `100vh`) with the header over it, the History tab on the left edge, and the search dock at the bottom center.
- **Canvas grid:** CSS grid with fixed 116px columns and rows, gap 8, `grid-auto-flow: dense`. It is wider and taller than the viewport (design: 16 columns, starting at left −262px / top −96px), so frames are cropped at every edge. That's intended: it should feel like a window onto a bigger table.
- **Frame spans** come from a stable hash of the image id, so the layout is the same on every load:
  - 12% are 3×2
  - 18% are 2×2
  - 16% are 2×1
  - 14% are 1×2
  - the rest are 1×1

```ts
// Deterministic, so the canvas is identical across reloads.
function spanFor(id: number): [cols: number, rows: number] {
  const r = ((id * 2654435761) >>> 11) % 100;
  if (r < 12) return [3, 2];
  if (r < 30) return [2, 2];
  if (r < 46) return [2, 1];
  if (r < 60) return [1, 2];
  return [1, 1];
}
```
- Order: `date_created` ascending ("plate number" = position in date order, 001–100), so the canvas reads oldest → newest.

**Callouts**
1. **Wordmark.** "Space Explorer" 17/600 plus the subtitle. Clicking it goes to `/` and clears the search.
2. **Status line.** An orange dot (6px circle), then "100 images · 10 NASA centers · 1950–2024", 12–13px, `faint` with the first item in `fg`. Compute these from the data (facets endpoint or the loaded list); don't hardcode them.
3. **Big-frame caption** (frames with area ≥ 4 cells). Two stacked chips bottom-left at 8px inset, background `--chip-bg`: the title (12px, `fg`) and a meta line (10–11px, `muted`: `NASA_ID · CENTER · YEAR`). The plate number sits top-right in a chip.
4. **Small-frame label** (area < 4). Only the plate number "013", bottom-left, 9–10px chip.
5. **Hovered frame.**
   - A 1px orange outline.
   - Four orange corner brackets (14px, 1.5px stroke, offset −6px outside the frame).
   - A faint orange crosshair through the center (1px lines, accent at 55% opacity).
   - Raised `z-index`.
   - Show it on hover and on keyboard focus. Only one frame is "hot" at a time.
6. **Hover annotation.** Chips stacked to the right of the hovered frame (14px gap); flip to the left near the right edge:
   - an orange chip with dark text: `Title · NASA_ID`
   - a dark chip with `accent-text` text: `CENTER · 25 Jun 2018 · Body`
   - a dark chip with `muted` text: coordinates `−5.20°, 138.13°`, only when `place.lat/lon` exist

   Clicking the frame opens A3 (`?image=id`).
7. **History tab.** A vertical tab fixed to the left edge at about 40% height, no left border. A history icon (16px), the vertical text "History · 24" (the count comes from the API; show it once the first history page loads), and a chevron. It opens the A4 drawer.
8. **Hint row** above the search box (12px, `muted`): "Drag to explore · hover a frame for details" on the left, "Press / to search" on the right.
9. **Search box.**
   - Size: 680px wide, 64px tall, centered, 36px from the bottom.
   - Background `#0B0B0C`, 1px `line-strong` border (it becomes orange on focus), the dock shadow.
   - An orange magnifier icon (20px).
   - Placeholder "Describe what you're looking for" at 22px.
10. **Search button.** Solid orange, dark text "Search ⏎" at 12–13px, 12×16 padding. Disabled while the input is empty or only whitespace (the backend returns 422 for that).
11. **Canvas motion.**
    - A very slow drift: `translate(0,0) → (−30px,−22px) → (0,0)` over 56s, ease-in-out, infinite.
    - It pauses while the pointer is over the canvas, and is off under `prefers-reduced-motion`.
    - **Drag to pan** (pointer events, translate the grid, clamp so it can't scroll past the edges).
    - A bottom scrim, 220px tall: a gradient from transparent to `bg` at 95% from 55%, so the dock reads over the photos.

**States**
- Loading: the same grid with `raised` placeholders at their spans (no spinners) and the photos fading in as they load (`opacity` 0→1, 200ms).
- Image failed to load: keep the `raised` block and the caption chips.
- API down: `ErrorState` centered above the dock (§10).

---

## 6. A2 — Search results: ranked reflow + timeline

`screens/A2-search-results.annotated.jpg`

**Layout**
- Header (64px), then the result grid on the left starting at `left 48 / top 88`, the **ranking rail** fixed on the right (344px wide, full height under the header), the History tab on the left edge, and the **search dock** at the bottom of the left area.
- **Result grid:** 8 columns × 120px, rows 100px, gap 8, `grid-auto-flow: row dense`. On narrower screens use `repeat(auto-fill, minmax(104px, 1fr))` and keep the span rules.
- **Frame size by rank** (this is how "bigger = more confident" reads):

```ts
function rankSpan(rank: number): [cols: number, rows: number] {
  if (rank === 1) return [4, 2];
  if (rank <= 4) return [2, 2];
  if (rank <= 10) return [2, 1];
  return [1, 1];
}
```
- After the results, render the **non-matching** images as 1×1 frames at 16% opacity, grayscale (A2·6). The archive is still "there", just set aside. With up to 50 results the non-matches mostly scroll below the fold, which is fine.
- **Reflow animation** (nice to have, P2): going A1 → A2, animate each frame from its old box to its new one. The cheapest route is the View Transitions API: `view-transition-name: frame-${id}` on each frame and `document.startViewTransition(() => flushSync(navigate(...)))`. Skip it where unsupported and under reduced motion.

**Callouts**
1. **Header summary.** An orange dot, then "**5 strong matches, 8 faint** · 87 images set aside" (14px; the first part in `fg`, the rest `muted`).
   - Strong = `confidence ≥ 0.5`; faint = the rest of the returned results; set aside = `total − results.length`.
   - If `engine === "keyword"`, append " · keyword search only" in `faint` (the embedding model didn't load).
2. **Rank badge.** Top-left of every result frame, square, dark text 600.
   - Fill orange when strong, `fg` when faint.
   - Size scales with the frame: rank 1 is 26px text (6×12 padding); 2×2 frames 17px; small frames 12px.
   - Two digits, zero-padded ("01").
3. **Caption strip.** Pinned to the bottom of the frame, background `--caption-bg`:
   - a row with the title (ellipsis) on the left and the percentage on the right
   - under it, a **3px confidence bar** the width of the frame, filled to `confidence × 100%` (orange if strong, `fg` if faint, track `#26262A`)
   - text sizes: rank 1 is 19px title / 26px %; 2×2 frames are 14 / 18; small frames 12 / 12
   - the % is `accent-text` when strong
4. **2×1 frames** (ranks 5–10): the same caption, smaller.
5. **1×1 frames** (rank 11+): no title, only the badge and the % with its bar.
6. **Set-aside images.** 16% opacity, grayscale, no caption, not focusable. They're still clickable (opening A3 without a match block).
7. **History tab.** Same as A1·7; the count is +1 after this search.
8. **Ranking rail: strong rows.** For each strong result:
   - the rank (12/600, `accent-text`)
   - the title (13, ellipsis) and the % (13, `accent-text`)
   - a 2px bar (orange)
   - **a "why" line** (11px, `faint`), see §6.3

   Hover or focus on a row highlights the frame in the grid (the A1·5 bracket treatment), and vice versa. Click opens A3.
9. **Faint divider.** When the first faint result appears, insert "Faint matches, under 50%." (12px, `muted`). Faint rows have no why-line, their rank is `faint`, their bar is `bar-faint`, and their % is `fg`.
10. **Scoring note** (bottom of the rail, 12px, `muted`). Replace the mockup's text, which describes the old formula, with: **"Confidence blends meaning (65%) and matching words (35%). Hover a result for the breakdown."** On hover of a rail row or a frame, show the existing `scoreBreakdown()` ("Meaning 82% · Words 40%") as a tooltip.
11. **Timeline header** (§6.4).
12. **Range handles** (§6.4).
13. **"1950 to 2024" + "Reset years".** The current range and a reset link (12px, `muted`, underlined). Hide "Reset years" when the range is the full span.
14. **Search input with the query.** 24px, the border stays **orange** while results are shown. Editing and pressing Enter runs a new search, which navigates to the new `/search/:id`.
15. **"Clear ×".** A ghost button (1px `line-strong`, 13px, `muted`). Goes back to `/` (A1) and keeps the history.
16. **Collapse rail** (28px square chevron button). It hides the rail, and the grid takes the full width. Optional (P2).

### 6.1 Rail row height budget
At 1440×900, 13 results fit only because faint rows are one line. With 50 results the rail scrolls (`overflow-y: auto`) and the scoring note stays pinned at the bottom.

### 6.2 Empty and edge states for A2
- **0 results** (the backend filtered everything below 0.35):
  - Keep the canvas, all dimmed.
  - The rail shows "Nothing in the 100 images matches “nebula”." plus "Try a broader word, such as “telescope”, “Mars” or “launch”." (static suggestions are fine).
  - The header says "No matches · 100 images set aside".
  - The timeline shows all-grey squares.
- **Only faint results:** the header says "No strong matches, 6 faint". There is no divider; the rail starts with the faint label.
- **Loading** (after submit): the dock border pulses orange (opacity 0.4↔1, 900ms), the grid keeps the previous state at 50% opacity, and the input is read-only. No spinners.
- **Error** (5xx or network): an inline message above the dock, "Search failed. Your query was not saved. Try again." with a Retry button.

### 6.3 The "why it matched" line (client side)
The API doesn't return matched words, so derive them in the browser with the existing `queryTerms()` from `lib/highlight.ts`:

```ts
// For each query term, find the best field it appears in. Same stemming as HighlightedText.
type Field = "title" | "keywords" | "description";
function matchedTerms(query: string, s: Source): { term: string; field: Field }[] {
  const terms = queryTerms(query);
  const fields: [Field, string][] = [
    ["title", s.title], ["keywords", s.keywords.join(" ")], ["description", s.description],
  ];
  return terms.flatMap((term) => {
    const hit = fields.find(([, text]) => queryTerms(text).includes(term));
    return hit ? [{ term, field: hit[0] }] : [];
  });
}
```
Copy rules:
- All terms in the same field → "Matched mars, rover in the title".
- Mixed fields → "Matched mars in keywords, rover in the description".
- **No literal term matched** (a pure semantic hit, e.g. "red planet" → Mars) → "Similar in meaning · Meaning 82%". This is the moment that shows off the hybrid search, so don't hide it.

### 6.4 YearTimeline (Eli specifically wants this kept)
What it is: a strip histogram of the whole archive by year (1950–2024, 75 columns). **Each image is one small square**, stacked within its year column. It sits in the dock right above the search input, full width of the result area (1016px in the design).

- **Data:** the years of all 100 sources (from `date_created`, UTC) plus the current results' confidences. It's all client side.
- **Square:** column width = `width / 75`, square width = column − 3px, **height 5px**, vertical step 7px, stacked from the bottom. The tallest column is 2011 with 10 images (70px).
- **Order inside a column:** results first, sorted by confidence, then non-matches. That way the colored squares sit on the baseline where the eye lands.
- **Color:** strong → `accent`; faint → `fg` at 75% opacity; non-match → `line-strong` `#2A2A2E`.
- **Axis:** a 1px baseline in `line-strong`, then tick labels at 1950, 1960 … 2020 (12px, `faint`).
- **Header:** "**When these were taken.** Each square is one image. Drag the handles to narrow by year." (13px, `fg` for the bold part, `muted` for the rest). On the right, the range label "1950 to 2024" and "Reset years".
- **Handles:** two vertical 2px `fg` lines spanning the strip, each with a 12×22 grab knob (radius 2).
  - Drag snaps to whole years.
  - Keyboard: each handle is a `role="slider"` with `aria-valuemin/max/now` and ←/→ moves one year.
  - Outside the range, squares drop to 30% opacity.
- **Filtering:** the range filters the **displayed results only** (grid, rail and header counts recompute; ranks keep their original numbers so "04" stays "04"). Store it in the URL as `?from=2000&to=2024`, so a link reproduces it. Don't create a new history entry for a year change.
- **Interaction:**
  - Hovering a square shows a tooltip "Gale Crater · 2018 · 65%".
  - Clicking a lit square opens that image (A3).
  - Hovering a frame or rail row lights its square with a 1px `fg` outline.
- **A3 mini version** (A3·11): 236px wide, 3px squares at a 4px step, all grey except the current image (orange), plus a 1px orange marker line with the year label above it. Copy: "Taken in 2018, one of 4 images from that year." (computed).

---

## 7. A3 — Image details modal

`screens/A3-image-details.annotated.jpg`

**Layout**
- A scrim (`--scrim`) over the whole page (the page behind stays visible but dark).
- The dialog is 1280×788 at 1440×900, centered; on smaller viewports `min(1280px, 100vw − 64px)` × `min(788px, 100vh − 64px)`. Background `#0D0D0F`, 1px `line-strong` border, the modal shadow.
- Two columns: the **image pane** (720px, background `#050506`) and the **info column** (rest, padding 26/30/24, a flex column with 20px gap).
- Below 900px wide, stack them (image on top at 55vh, info scrolls).
- Focus trap. `Esc` closes. Focus returns to the frame that opened it. `role="dialog"`, `aria-label="<title>, details"`.

**Callouts**
1. **Rank + match chip** (only when opened from a search):
   - an orange (or `fg` if faint) rank badge "04"
   - a dark chip "65% match · 4 of 13"
   - top-left at 20/18
2. **Prev / next.** 44×56 buttons, vertically centered at the pane edges, dark translucent background with a 1px `line-strong` border. They step through the **current result list** in rank order, falling back to date order on A1, and update `?image=`. `←`/`→` do the same.
3. **The full image.** `object-fit: contain`, height 100% of the pane, never cropped. Use `image_url` (the medium rendition) with `thumb_url` as the blurred placeholder while it loads.
4. **Size chip.** "660 × 1280 · medium". Only show it if the API gives dimensions; otherwise drop it (it's not in `Source` today).
5. **"Open full resolution ↗".** A link to the original asset in a new tab. If only the medium URL is available, label it "Open image ↗".
6. **Eyebrow + title.**
   - The eyebrow is `place.label`'s body plus the first meaningful keyword, e.g. "Mars · Mars Odyssey" (13px, `muted`). If there's nothing good, use the center name.
   - The title is 44/400.
   - The close button "×" is a 36px square with a 1px `line-strong` border.
7. **Description.** The **full** NASA `description`: 15px, line-height 1.6, color `soft`. Query terms are wrapped in `<mark>` (orange underline) via `HighlightedText`.
   - Strip the trailing URL and the "Orbit Number … Captured …" key/value tail from Mars captions, because those values move into the metadata grid.
   - If the description is longer than about 8 lines, clamp it with a "Show more" link.
8. **Metadata grid.** 3 columns, label above value; labels 12px `muted`, values 14px; a 1px `line` rule above and between the rows. Fields, in order, shown only when present:
   - Taken (`date_created`, "25 Jun 2018", UTC)
   - Center
   - NASA ID
   - Photographer
   - Location
   - Instrument / Orbit / Captured: parsed from Mars captions only (e.g. `Instrument: VIS`, `Orbit Number: 72297`, `Captured: 2018-04-02 02:54`); skip if absent
   - Credit (`secondary_creator` if the seed kept it)

   **Missing field copy:** don't show empty cells. If a whole group is missing, say so plainly ("Credit: not in the NASA record") instead of leaving a gap.
9. **Keywords.** Chips (13px, 5×10 padding, 1px `line-strong` border). Chips that matched a query term get an orange border and `accent-text` text. A trailing note "Highlighted words matched your search" (12px, `muted`) appears only when at least one chip matched. If there are no keywords: "No keywords in the NASA record."
10. **Match block** (only when opened from a search):
    - the label "Match for “mars rover”"
    - the big % (40px, `accent-text` if strong)
    - a 2px bar
    - the why-line from §6.3 (12px, `muted`)
    - on hover, the `scoreBreakdown()` tooltip
11. **"Its place in time".** The mini timeline from §6.4.
12. **LocatorMini.** A 220×150 box (background `#050506`, 1px `line`). It shows the body the image is on (`place.body`) with a pin at `place.lat/lon`.
    - **Do not use the textured globe images from the mockup**: they were placeholders. Draw it in the **same line-art style as the Space view** (thin `line-strong` outline, faint graticule, one orange pin ring of 12px), so the modal previews the scene honestly.
    - It's a static SVG with an orthographic projection centered on the pin's longitude: `x = cx + r·cos(lat)·sin(lon − lon0)`, `y = cy − r·sin(lat)`.
    - `orbit`: Earth outline with a thin orbit ellipse and the pin on the ellipse.
    - `deep_space`: a small circle labelled with the place name, no coordinates.
    - Text beside it:
      - "Where this was seen" (12px, `muted`)
      - the place label + body, e.g. "Gale Crater, Mars" (17px)
      - the coordinates when present, "−5.20°, 138.13°" (12px, `soft`; use the true minus sign U+2212)
      - **the provenance** (12px, `faint`): "from the caption" / "from the location field" / "approx.: NASA center" / "set by hand"
13. **"Fly there in Space view →".** Links to `/scene?focus=<source_id>`. The scene flies the camera to that pin and opens its card. This is the main door into the special feature.
14. **Close.** Same as `Esc`.

---

## 8. A4 — History drawer

`screens/A4-history.annotated.jpg`

**Layout**
- A drawer 720px wide (100vw on phones), anchored left, full height, background `#0B0B0C`, 1px right border `line-strong`, the drawer shadow. The page behind gets the scrim.
- Slide in from the left (`translateX(−100%) → 0`, 220ms ease-out; a fade under reduced motion).
- Inside: a header block, the find field, a scrolling list, and a footer pinned at the bottom.
- Content padding is 40px left and right.

**Callouts**
1. **Title + count.** "History" 56/400 and "24 searches, newest first." (14px, `muted`). The count is the total; if the API doesn't give a total, say "Newest first." and drop the number (see the API note below).
2. **Find a past search.** An underline-only input (1px `line-strong` bottom border, 16px text, 44px tall).
   - It filters the **loaded** items client-side by substring.
   - With no hits: "No past search contains “xyz”." plus "Clear the filter".
   - (Server-side filtering would be `?q=` on `GET /api/searches`: optional.)
3. **Day group headers.** "Today", "Yesterday", then "Friday 6 November", then month names for anything older than a week (13px/500, `muted`, 18px top padding). Group by the user's local date.
4. **Current-search marker.** The row whose `id` matches the open `/search/:id` gets a 3px orange inset bar on the left edge (full-bleed to the drawer edge) and a `#111113` background. No text label.
5. **Query.** 27/400, one line, ellipsis.
6. **Meta line** (13px, `muted`, one line, `nowrap`): `23:31 · 13 images, 5 strong, best 100%`. Variants:
   - all results strong → `2 images, all strong, best 100%`
   - one result → `1 image, 79% match` (`1 image, a faint 18% match` when it's faint)
   - zero → `Nothing matched in the 100 images`
7. **Thumbnails.** Up to 3 (46×32, `object-fit: cover`), each with a 2px confidence bar along its bottom edge (orange if strong, `fg` if faint, width = confidence). Thumbnail opacity is `max(0.4, confidence)`, so faint ones read dimmer. Then "+10" (13px, `faint`) for the rest.
8. **"Open results".** 14px/500, underlined, goes to `/search/:id` (the stored snapshot). For zero-result rows it reads "Search again" and re-runs the query (`POST`).
9. **"Delete".** 14px, `faint` → `fg` on hover. Its aria-label is `Delete search “mars rover”`.
   - **Optimistic:** remove the row immediately (the existing `useDeleteSearch` with rollback) and show the toast.
   - If the deleted search is the one open behind the drawer, navigate the page behind to `/`.
10. **Zero-result row.** No thumbnails; the action reads "Search again".
11. **Pagination footer.** Pinned at the bottom with a 1px `line` top border: "Show 10 older searches" (15px/500, underlined), then "Showing 6 of 24" (14px, `muted`).
    - This maps directly onto the existing keyset `useInfiniteQuery`. Fetch `limit=10` per page; "Show N older" uses `min(10, remaining)` when the total is known, otherwise just "Show older searches".
    - At the end: "That's every search you've made." with no button.
12. **Undo toast.** Floats **outside the drawer**, bottom-left of the visible page (left 760, bottom 28 at 1440px; centered at the bottom on phones). Background `fg`, text `bg`.
    - Text: "Deleted “apollo” and its saved results." Then "Undo" (600, underlined), then a countdown "Gone in 6 s" (13px, `#55534E`).
    - **Undo implementation** (pick one):
      - (a) Delay the actual `DELETE` call by 6s and cancel it on Undo. This needs no API change; flush pending deletes on `beforeunload`.
      - (b) Delete immediately and re-create on Undo. Not possible with snapshots, so **use (a)**.
    - `role="status"`. Only one toast at a time; a new delete commits the previous one.
13. **Close.** A 40px square "×", top-right. `Esc` closes. Clicking the scrim closes.
14. **Page behind.** The current page (A1 canvas or A2 results) stays rendered under the scrim, not blank.

**API note for history (small backend change, recommended).** `SearchSummary` today has `result_count` and `preview_thumbs: string[]`. The row design needs three more things:
```py
class SearchPreview(BaseModel):
    thumb_url: str
    confidence: float

class SearchSummary(BaseModel):
    id: int
    query: str
    created_at: datetime
    result_count: int
    strong_count: int          # results with confidence >= 0.5
    best_confidence: float | None
    previews: list[SearchPreview]   # top 3 by rank (replaces preview_thumbs)
```
All of it comes from `search_results` in the same query `HistoryRepository.get_page` already runs (`count(*) filter (where confidence >= 0.5)`, `max(confidence)`). Put the 0.5 constant in `config.py` as `STRONG_MATCH`, and expose the same value to the frontend (hardcode it in one place there and reference the backend constant in a comment). The drawer header count also wants a `total` on `SearchHistoryPage`; it's optional, and there's a fallback in callout 1.
**If there's no time for this:** show `13 images` without the strong/best part, and thumbnails without bars. The design still works.

---

## 9. Special feature hooks (Space view)

Keep `PLAN.md`'s scene and its line-art style. The design asks only for these connections:
- **Entry 1:** A3·13 "Fly there in Space view →" opens `/scene?focus=<id>`: the camera flies to the pin and its card opens.
- **Entry 2:** on A2, add a small text link in the header-right slot (replacing the keyboard hint while results are shown): **"See these in space →"**. It opens `/scene?search=<search_id>`, where matching pins are lit with the same two-tier colors (strong orange, faint `fg`) and the rest dimmed.
- **Entry 3:** on A1, the header-right slot shows "Space view →" (13px, `muted`, hover `fg`).
- **Shared language:** the scene uses the same tokens (`bg`, `line-strong` for outlines, `accent` for the active pin, Instrument Sans for labels in sentence case) and the same provenance copy as A3·12. Its year rail should use the **same colors and the square-per-image idea as `YearTimeline`**, so the two read as one system.
- The README "Special feature" section can use the A3 → Space view flow as its demo GIF.

---

## 10. Copy (all of it, sentence case)

| Where | Text |
|---|---|
| Search placeholder | Describe what you're looking for |
| Search button | Search ⏎ |
| A1 hints | Drag to explore · hover a frame for details / Press / to search |
| A2 header | {strong} strong matches, {faint} faint · {setAside} images set aside |
| A2 header, keyword fallback | … · keyword search only |
| Rail title | {n} results, ranked by match |
| Rail faint divider | Faint matches, under 50%. |
| Rail scoring note | Confidence blends meaning (65%) and matching words (35%). Hover a result for the breakdown. |
| Why-line | Matched {terms} in the title / in keywords / in the description · Similar in meaning · Meaning {x}% |
| Timeline header | When these were taken. Each square is one image. Drag the handles to narrow by year. |
| Timeline range | {from} to {to} · Reset years |
| No results | Nothing in the 100 images matches “{q}”. Try a broader word, such as “telescope”, “Mars” or “launch”. |
| Search error | Search failed. Your query was not saved. Try again. |
| API down (A1) | Can't reach the archive. Check that the backend is running, then reload. |
| A3 match label | Match for “{q}” |
| A3 time | Taken in {year}, one of {n} images from that year. |
| A3 place | Where this was seen · {label}, {Body} · {lat}, {lon} · from the caption |
| A3 link | Fly there in Space view → |
| Keyword note | Highlighted words matched your search |
| Missing data | Not in the NASA record |
| History title | History · {n} searches, newest first. |
| History find | Find a past search |
| History zero row | Nothing matched in the 100 images · Search again |
| History footer | Show {k} older searches · Showing {shown} of {total} / That's every search you've made. |
| Toast | Deleted “{q}” and its saved results. Undo · Gone in {s} s |

Numbers: percentages are rounded integers with no decimals ("65%"). Dates are "25 Jun 2018" (UTC). Times are 24h local ("23:31"). Coordinates have 2 decimals with a degree sign and the U+2212 minus.

---

## 11. Accessibility checklist
- Every frame is a real link (`<a href="?image=id">`, as today) with an `aria-label` of "{title}, {year}" plus ", rank 4, 65% match" on A2. Dimmed set-aside frames are `tabindex="-1"`.
- The rank rail is an ordered list (`<ol>`).
- The timeline has `role="img"` with an `aria-label` summary; the handles are `role="slider"`.
- Every color-only signal also has text: strong/faint shows up in the % and the divider, and the current history row has `aria-current="true"`.
- Contrast on `#09090A` (measured): `fg` 16.1:1, `muted` 8.0:1, `faint` 5.9:1, `accent` 6.4:1, `accent-text` 8.6:1. All pass AA for normal text. Keep the convention anyway: fills use `accent`, text uses `accent-text`.
- `prefers-reduced-motion`: no drift, no reflow animation, no pulsing; the drawer fades instead of sliding.
- Focus rings: keep the existing 1px `fg` outline.

## 12. Priorities for today

**P0 (requirements + the look)**
1. Swap in the tokens and the font (§3).
2. A1 canvas with hover annotation and the bottom search dock (no drag-to-pan yet).
3. A2 ranked grid, rail, header counts and why-lines (§6.3).
4. A3 modal with the full image, description with highlights, metadata and keywords.
5. A4 drawer with open, delete with the undo toast, and "Show older" pagination.
6. Empty, error and loading states (§6.2, §10).

**P1**
- `YearTimeline` on A2 with the range filter, and the mini timeline in A3.
- `LocatorMini` + "Fly there in Space view" + `/scene?focus=`.
- The `SearchSummary` additions (§8) for strong/best and the thumbnail bars.

**P2**
- Drag-to-pan and the drift on A1.
- The A1→A2 reflow with View Transitions.
- Rail collapse.
- "See these in space" with `?search=`.
- Find in history.

## 13. Acceptance (check in the browser at 1440×900 and at 390×844)
- [ ] No Inter, no IBM Plex Mono, no uppercase labels anywhere; numbers align in columns.
- [ ] Orange appears only on strong matches, the active search box, the hovered frame and the current history row.
- [ ] Searching "mars rover": rank 1 is the 4×2 frame, ranks 2–4 are 2×2, 5–10 are 2×1, the rest 1×1; non-matches are grey at 16%.
- [ ] The header counts equal what the rail shows; strong is `confidence ≥ 0.5`.
- [ ] A semantic-only hit (try "red planet") shows "Similar in meaning" instead of an empty why-line.
- [ ] Dragging the timeline handles to 2000–2024 removes older results from the grid and rail, the counts update, ranks keep their numbers, and the URL has `?from=2000&to=2024`.
- [ ] A3 shows the full image (not cropped), the full description with highlights, every available metadata field, keywords with matches outlined, and the place with its provenance.
- [ ] A3 ←/→ walks the result list; `Esc` closes; Back closes.
- [ ] History: open a past search → the same snapshot; delete → the row disappears and the toast appears; Undo restores it; after 6s the `DELETE` is sent; "Show older" loads the next keyset page.
- [ ] Reduced motion: nothing moves.
- [ ] Console is clean.
