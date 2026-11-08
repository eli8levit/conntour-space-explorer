// The year filter behind the left rail. Pure functions, tested in years.test.ts.

export interface YearRange {
  from: number;
  to: number;
}

/** NASA dates are midnight UTC, so read the year in UTC (local time could give the previous year). */
export function yearOf(iso: string): number {
  return new Date(iso).getUTCFullYear();
}

/** The first and last year in the data (1950 to 2024 today). */
export function yearBounds(dates: string[]): YearRange {
  if (dates.length === 0) return { from: 1950, to: 2024 };
  const years = dates.map(yearOf);
  return { from: Math.min(...years), to: Math.max(...years) };
}

/** A drag can go up or down the rail; the range is always from ≤ to. */
export function rangeBetween(a: number, b: number): YearRange {
  return { from: Math.min(a, b), to: Math.max(a, b) };
}

/** `null` means "all years". */
export function inYearRange(iso: string, range: YearRange | null): boolean {
  if (!range) return true;
  const year = yearOf(iso);
  return year >= range.from && year <= range.to;
}

/** Items grouped by year, for the rail's square-per-image rows. */
export function groupByYear<T extends { date_created: string }>(items: T[]): Map<number, T[]> {
  const byYear = new Map<number, T[]>();
  for (const item of items) {
    const year = yearOf(item.date_created);
    byYear.set(year, [...(byYear.get(year) ?? []), item]);
  }
  return byYear;
}
