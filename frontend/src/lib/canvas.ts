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
