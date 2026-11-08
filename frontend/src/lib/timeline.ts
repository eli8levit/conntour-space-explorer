// YearTimeline (§6.4): a strip histogram of the archive by year, one small
// square per image. Pure layout math here; the component only draws it.
import type { Source } from "../api/types";
import { yearOf } from "./format";
import { isStrong } from "./match";

export interface YearRange {
  from: number;
  to: number;
}

/** The years the archive covers (1950–2024 today), computed from the data. */
export function yearExtent(sources: Pick<Source, "date_created">[]): YearRange {
  const years = sources.map((source) => yearOf(source.date_created));
  if (years.length === 0) return { from: 1950, to: new Date().getUTCFullYear() };
  return { from: Math.min(...years), to: Math.max(...years) };
}

export type SquareKind = "strong" | "faint" | "none";

export interface Square {
  sourceId: number;
  year: number;
  /** 0 = on the baseline, 1 = one step up, … */
  stack: number;
  kind: SquareKind;
  confidence: number | null;
}

/**
 * One square per image, stacked in its year column. Inside a column the
 * matches come first, best first, then the rest: the colored squares sit on
 * the baseline, where the eye lands.
 */
export function layoutSquares(
  sources: Pick<Source, "id" | "date_created">[],
  confidenceById: ReadonlyMap<number, number>,
): Square[] {
  const columns = new Map<number, Pick<Source, "id" | "date_created">[]>();
  for (const source of sources) {
    const year = yearOf(source.date_created);
    columns.set(year, [...(columns.get(year) ?? []), source]);
  }
  const score = (id: number) => confidenceById.get(id) ?? -1;

  return [...columns.entries()].flatMap(([year, column]) =>
    [...column]
      .sort((a, b) => score(b.id) - score(a.id) || a.id - b.id)
      .map((source, stack) => {
        const confidence = confidenceById.get(source.id) ?? null;
        const kind: SquareKind = confidence === null ? "none" : isStrong(confidence) ? "strong" : "faint";
        return { sourceId: source.id, year, stack, kind, confidence };
      }),
  );
}

/** Reads ?from=&to= from the URL, clamped to the archive. Missing or bad values mean "no limit". */
export function parseYearRange(params: URLSearchParams, extent: YearRange): YearRange {
  const read = (key: string, fallback: number) => {
    const value = Number(params.get(key));
    return params.has(key) && Number.isInteger(value) ? Math.min(extent.to, Math.max(extent.from, value)) : fallback;
  };
  const from = read("from", extent.from);
  const to = read("to", extent.to);
  // A swapped pair in a hand-edited URL still means "between these two years".
  return from <= to ? { from, to } : { from: to, to: from };
}

export function isFullRange(range: YearRange, extent: YearRange): boolean {
  return range.from <= extent.from && range.to >= extent.to;
}

export function inRange(year: number, range: YearRange): boolean {
  return year >= range.from && year <= range.to;
}

/** "Taken in 2018, one of 4 images from that year." (A3 mini timeline) */
export function yearSentence(year: number, countThatYear: number): string {
  return countThatYear <= 1
    ? `Taken in ${year}, the only image from that year.`
    : `Taken in ${year}, one of ${countThatYear} images from that year.`;
}
