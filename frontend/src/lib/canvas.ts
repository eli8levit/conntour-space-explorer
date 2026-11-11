// A1, the browse canvas: every image at once, as a dense grid of frames.
import type { Source } from "../api/types";
import type { Span } from "./match";

/**
 * Frame size from a stable hash of the id, so the canvas is identical on
 * every load (Math.random would reshuffle it on each visit).
 * 12% are 3×2, 18% 2×2, 16% 2×1, 14% 1×2, the rest 1×1.
 */
export function spanFor(id: number): Span {
  // Knuth's multiplicative hash: neighbouring ids land far apart.
  // `>>> 11` keeps the low 32 bits as an unsigned int and drops the 11 least-mixed ones.
  const r = ((id * 2654435761) >>> 11) % 100;
  if (r < 12) return [3, 2];
  if (r < 30) return [2, 2];
  if (r < 46) return [2, 1];
  if (r < 60) return [1, 2];
  return [1, 1];
}

/** Frames of 4+ cells are big enough for a title caption; smaller ones show only the plate number. */
export function isBigFrame([cols, rows]: Span): boolean {
  return cols * rows >= 4;
}

/** Oldest first: the canvas reads as a timeline, and the "plate number" is the position in it. */
export function byDate(sources: Source[]): Source[] {
  return [...sources].sort((a, b) => a.date_created.localeCompare(b.date_created) || a.id - b.id);
}

/** 13 -> "013". Three digits, because the archive has 100 plates. */
export function formatPlate(position: number): string {
  return String(position).padStart(3, "0");
}

// ---- The endless canvas: one "round" of the archive, packed into a grid. ----

/** Cell size and gap in px. `pitch` is the distance from one cell to the next. */
export interface Cells {
  cell: number;
  gap: number;
  pitch: number;
}

/**
 * The cell follows the window width. On a phone a desktop-size cell makes a
 * 3×2 frame almost as wide as the screen, so phones and tablets get smaller cells.
 */
export function cellsFor(width: number): Cells {
  const [cell, gap] = width < 640 ? [76, 6] : width < 1024 ? [96, 8] : [116, 8];
  return { cell, gap, pitch: cell + gap };
}

export interface Slot<T> {
  item: T;
  /** Grid position and size, in cells. */
  x: number;
  y: number;
  span: Span;
  /** A 1×1 copy that closes a hole on the last rows, so rounds stack with a straight seam. */
  filler: boolean;
}

export interface Round<T> {
  slots: Slot<T>[];
  /** Height in cells; the round is a full rectangle `cols` wide and `rows` tall. */
  rows: number;
}

/**
 * Packs items into `cols` columns, first fit, top to bottom: each item takes
 * the first free place where it fits (what CSS `grid-auto-flow: dense` does).
 * We pack in JS rather than with CSS grid because we need the exact height of
 * each round to stack rounds without a gap, and the free cells of the last
 * rows to fill them.
 */
export function packRound<T>(
  items: T[],
  spanOf: (item: T) => Span,
  cols: number,
  /** Photos a filler copy should not repeat (they sit across the seam in the next round). */
  avoid?: (item: T) => boolean,
): Round<T> {
  const taken: boolean[][] = [];
  const isFree = (x: number, y: number) => !taken[y]?.[x];
  const take = (x: number, y: number, [w, h]: Span) => {
    for (let dy = 0; dy < h; dy++) {
      const row = (taken[y + dy] ??= []);
      for (let dx = 0; dx < w; dx++) row[x + dx] = true;
    }
  };
  const fits = (x: number, y: number, [w, h]: Span) => {
    if (x + w > cols) return false;
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) if (!isFree(x + dx, y + dy)) return false;
    return true;
  };

  const slots: Slot<T>[] = [];
  let rows = 0;
  for (const item of items) {
    const [w0, h] = spanOf(item);
    const span: Span = [Math.min(w0, cols), h]; // a 3-wide frame on a 2-column phone grid shrinks
    let y = 0;
    for (;;) {
      const x = Array.from({ length: cols }, (_, i) => i).find((i) => fits(i, y, span));
      if (x !== undefined) {
        take(x, y, span);
        slots.push({ item, x, y, span, filler: false });
        rows = Math.max(rows, y + span[1]);
        break;
      }
      y++;
    }
  }

  // Close the holes on the ragged last rows with 1×1 copies. Each copy is the photo whose
  // original sits farthest from the hole (and is not in `avoid`, the photos facing the
  // next round), so a copy never lands next to its twin.
  const used = new Set<T>();
  const originals = [...slots];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!isFree(x, y) || originals.length === 0) continue;
      let best = originals[0]!;
      let bestScore = -Infinity;
      for (const slot of originals) {
        const dx = slot.x + slot.span[0] / 2 - x;
        const dy = slot.y + slot.span[1] / 2 - y;
        const score = Math.hypot(dx, dy) - (used.has(slot.item) ? 1000 : 0) - (avoid?.(slot.item) ? 500 : 0);
        if (score > bestScore) [best, bestScore] = [slot, score];
      }
      used.add(best.item);
      take(x, y, [1, 1]);
      slots.push({ item: best.item, x, y, span: [1, 1], filler: true });
    }
  }
  return { slots, rows };
}

/** Fisher–Yates: every round of the canvas shows the archive in a new order. */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
