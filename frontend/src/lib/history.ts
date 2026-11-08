// A4, the history drawer: day groups and the one-line summary of each search.
import type { SearchSummary } from "../api/types";
import { formatPercent } from "./format";
import { isStrong } from "./match";

/** "2026-11-08" in the user's own time zone: history groups by the user's day, not UTC. */
function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** Whole local days between two dates (DST-safe: compares calendar dates, not milliseconds). */
function daysBetween(earlier: Date, later: Date): number {
  const a = Date.UTC(earlier.getFullYear(), earlier.getMonth(), earlier.getDate());
  const b = Date.UTC(later.getFullYear(), later.getMonth(), later.getDate());
  return Math.round((b - a) / 86_400_000);
}

/**
 * "Today", "Yesterday", "Friday 6 November" within the last week, then the
 * month ("October", or "October 2025" in an earlier year).
 * `now` is a parameter so tests are deterministic.
 */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const days = daysBetween(date, now);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) {
    return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" })
      .format(date)
      .replace(",", "");
  }
  const sameYear = date.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat("en-GB", sameYear ? { month: "long" } : { month: "long", year: "numeric" }).format(
    date,
  );
}

export interface DayGroup<T> {
  label: string;
  items: T[];
}

/**
 * Consecutive searches under one header. The list is newest first, so equal
 * labels are always next to each other.
 */
export function groupByDay<T extends { created_at: string }>(items: T[], now: Date = new Date()): DayGroup<T>[] {
  const groups: (DayGroup<T> & { key: string })[] = [];
  for (const item of items) {
    const label = dayLabel(item.created_at, now);
    // Older than a week groups by month, so the key is the label, not the calendar day.
    const key = label === "Today" || label === "Yesterday" ? localDayKey(new Date(item.created_at)) : label;
    const last = groups.at(-1);
    if (last && last.key === key) last.items.push(item);
    else groups.push({ key, label, items: [item] });
  }
  return groups.map(({ label, items }) => ({ label, items }));
}

type MetaInput = Pick<SearchSummary, "result_count" | "strong_count" | "best_confidence">;

/**
 * The part of the row's meta line after the time (A4·6):
 *   "13 images, 5 strong, best 100%"
 *   "2 images, all strong, best 100%"
 *   "1 image, 79% match" / "1 image, a faint 18% match"
 *   "Nothing matched in the 100 images"
 */
export function historyMeta(search: MetaInput, archiveSize = 100): string {
  const { result_count: count, strong_count: strong, best_confidence: best } = search;
  if (count === 0) return `Nothing matched in the ${archiveSize} images`;
  if (best === null) return count === 1 ? "1 image" : `${count} images`;

  if (count === 1) return isStrong(best) ? `1 image, ${formatPercent(best)} match` : `1 image, a faint ${formatPercent(best)} match`;

  const strength = strong === count ? "all strong" : `${strong} strong`;
  return `${count} images, ${strength}, best ${formatPercent(best)}`;
}

/** "Show 10 older searches", or without a number when the total is unknown. */
export function olderLabel(shown: number, total: number | undefined, pageSize: number): string {
  if (total === undefined) return "Show older searches";
  const next = Math.min(pageSize, total - shown);
  return next === 1 ? "Show 1 older search" : `Show ${next} older searches`;
}
