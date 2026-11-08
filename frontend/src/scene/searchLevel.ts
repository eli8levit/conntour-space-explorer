import { isStrong } from "../lib/match";
import { type Level, LEVEL_ORDER } from "./layout";

/**
 * The level a search opens on: the one with the most strong matches. Ties go to the level with the
 * most matches in total, then to Earth, then to the order of the level bar. Null when nothing matches.
 */
export function searchLevel(rows: { source_id: number; body: Level }[], confidences: Map<number, number>): Level | null {
  const tally = new Map<Level, { strong: number; total: number }>();
  for (const r of rows) {
    const c = confidences.get(r.source_id);
    if (c === undefined) continue;
    const t = tally.get(r.body) ?? { strong: 0, total: 0 };
    t.total += 1;
    if (isStrong(c)) t.strong += 1;
    tally.set(r.body, t);
  }
  const order = LEVEL_ORDER;
  let best: Level | null = null;
  for (const l of order) {
    const t = tally.get(l);
    if (!t) continue;
    const b = best ? tally.get(best)! : null;
    if (!b || t.strong > b.strong || (t.strong === b.strong && t.total > b.total)) best = l;
  }
  return best;
}
