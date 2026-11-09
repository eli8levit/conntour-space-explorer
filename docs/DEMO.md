# Demo script

This is the presentation script. It takes about 8 minutes.
Every number below comes from the running app (hybrid search, 100 images). Re-check them before the demo.

## Setup checklist

- [ ] Run `docker compose up -d`.
- [ ] Open http://localhost:3001 and check `/api/health` shows `"status":"ok"` and `"db":true`.
- [ ] Use Chrome at 1440 px wide. Close DevTools.
- [ ] Run the 6 demo queries once, so the model is warm and history has real rows.
- [ ] Add 12 to 15 more good searches, so history has day groups and a "Show older searches" button.
- [ ] Push the commits. Check that the live-demo link answers. If it does not, do not mention it.
- [ ] Open the terminal in the repo folder, ready for the last step.

## The 9 steps

1. **Browse.** Hover a big frame. It shows the title, NASA ID, center and year, and a note with date and coordinates. All 100 images are on screen. Press `/` to focus the search box.
2. **"images of Mars rovers".** The grid reflows by rank. The header says "4 strong matches, 12 faint". Rank 1 is Gale Crater at 60%, then El Capitan 59%, Ganges Chasma 56% and Curiosity 52%. Show the why-lines. Hover Gale Crater for the breakdown ("Meaning 62% · Words 55%"). Show the year squares.
3. **Open Gale Crater.** Show the full image and the highlighted caption. Show the Taken, Center and NASA ID fields. Show the place: "from the caption". Press the right arrow twice. Press Esc. The URL has `?image=`, and Back closes the image.
4. **"storm seen from space".** Rank 1 is "Spring Storm Hits New England" at 58%. It is the only strong result. Open it. Show the pin and where it came from. Say one sentence about the places pipeline.
5. **"animals".** Only 2 results, both faint: the great blue heron (KSC-2011-1022, 22%) and the manatees (13%). No caption says "animals". The words score is 0%. This shows the meaning search finds them. It also shows the honest part: nothing is strong. Until 2026-11-09 they scored 37% and 22%, also faint.
6. **"STS-135".** 3 strong (81%, 72%, 63%; all contain the ID), then 35 faint (38 results). Say: "An ID decides the tier." Halved rows show "halved: “STS-135” is not in this image" (for example STS-129 CDR Hobaugh, 31%). Drag the years to 2010 to 2012. Ranks keep their numbers. The URL gets `?from=&to=`. Click "Reset years".
7. **"astronaut spacewalk".** 3 strong, 47 faint (50 results). Click "See these in space". The scene opens on Orbit: all 3 strong results are in Earth orbit. Show Earth and the Kennedy cluster fan-out. Show Mars. Keep this under 90 seconds.
8. **History.** Open it from the header. Show the day groups. Use "Find a past search" and type "mars". Delete one row and press Undo. Delete it again. Open a past search. It shows the same snapshot of results.
9. **Close on the terminal.** Run `docker compose exec backend python scripts/eval_search.py`. Hybrid gets P@5 0.83 and recall 0.97. "Relevant among strong" is 0.55. Gibberish results: 0. Strong results without the ID: 0. Say: "The search was measured, not guessed."

## The search story (short)

"The top-5 metric looked fine, but I had not measured whether the orange results were right. I measured: only 30% of strong results were relevant (132 strong results). The meaning score saturated at cosine 0.50, so a real rover photo (0.67) and an orbital Mars photo with no rover (0.55) both read "Meaning 100%". I raised the ceiling from 0.50 to 0.70. That kept top-5 and recall, and 55% of orange results are now relevant. The remaining limit: a small text model reads "mars rover" as mostly "Mars". A next step is a rule that partial matches of a multi-word query cannot be strong, or a re-ranker."

Demo tip: run "mars rover". Rank 1 is El Capitan (86%), then Curiosity anniversary (77%), Perseverance marble countdown (70%) and Gale Crater (63%). Then orbital photos follow: Lycus Sulci 61%, Ganges Chasma 56%, Ophir Chasma 51%. That is 7 strong of 19, so some orbital photos are still strong. Now flip the toggle from Combined to Keywords. The orbital photos drop to about 22% (faint). Say: "The small text model reads 'mars rover' as mostly 'Mars'."

## Queries to avoid typing live

These give weak or odd results. Do not type them in front of people.

| Query | Live result |
| --- | --- |
| "red planet" | 9 results, none strong. Top is Lycus Sulci at 25%. Do not say it is in the right order. |
| "night launch" | 24 results, none strong. Top is 31%. |
| "launch pad at night" | 9 results, none strong. Top is 37%. |
| "earth from space" | 14 results, none strong. Top is 35%. |
| "helicopter" | 2 results, both under 25%. The search has no image signal. |
| "jupiter" | 8 results, none strong. The archive has no Jupiter image. |
| "women in space" | 44 results, none strong. Top is a training photo at 44%, not a clear answer. |
| "launch in 2011", "2011" | A bare year is not an ID. "launch in 2011" gives 13 results, none strong. "2011" alone gives 0 results. |
| "astronuat" (a typo) | 0 results. There is no typo tolerance. |
| "rocket launch" | Press events rank above the real launch photos (Columbia #14, Atlantis #29): the search reads captions, not pixels. "space shuttle launch" works. See QA 17c. |
| An exact title in Keywords mode | Tops out at about 83%, not 100% (the words score is a rank on a curve). See QA 17a. |

## The five hardest questions

**1. "The breakdown says Meaning 100% and Words 27%, but the score is 43%. Which is it?"**
The score is 80% meaning plus 20% words. Then the ID rule applies. If you type an ID such as "STS-135", images without that ID get half their score. So they can never be strong. The breakdown now says "halved: “STS-135” is not in this image". Images with the ID are raised to at least 50%.

**2. "You tuned the constants on the same 15 queries. Is that overfit?"**
Yes, it is in-sample. The eval is a regression guard, not a benchmark. Next steps: more queries, a held-out split, and a re-ranker on the top 20.

**3. "Hand-written titles and places do not scale."**
The dataset is fixed at 100 images. A rules script drafted the titles and places, and a review changed 27 of them. The app stores and shows where each place came from. At scale, the review becomes a queue.

**4. "Why an in-process text model and pgvector? Why not CLIP or a vector database?"**
One process, no network call, 0.7 ms per query. A thread pool keeps the event loop free. pgvector keeps search and the history snapshot in one store and one transaction. CLIP would add an image signal. Today "helicopter" misses for that reason.

**5. "History is global, anyone can delete, and the rate limit can be bypassed."**
The brief has no users. Next steps: an `owner_id` on searches, a firewall that allows only Cloudflare (or a tunnel), and `limit_req` in nginx.

## Do not claim

- Do not claim a live demo unless the link answers.
- Do not say "red planet" gives results in the right order.
- Do not say the score is a calibrated probability. Say it is a 0 to 1 score with a tuned strong line (0.5). Strong results are not always right: 55% of them are relevant in the eval.
- Do not say a strong "mars rover" result has a rover in it. Orbital Mars photos can still be strong (Lycus Sulci 61%, Ganges Chasma 56%).
- Do not claim typo tolerance.
- Do not say the search sees pixels. It reads text.
- Do not say the 3D scene is to scale.
- Do not quote old test counts. Run the tests and quote the new numbers (now 84 backend, 142 frontend).
- Do not say a year is an ID. A year from 1900 to 2099 is never an ID, so "Apollo 1969" is not halved.
