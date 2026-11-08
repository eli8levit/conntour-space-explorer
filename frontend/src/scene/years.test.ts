import { describe, expect, it } from "vitest";
import { groupByYear, inYearRange, rangeBetween, yearBounds, yearOf } from "./years";

describe("yearOf", () => {
  it("reads the year in UTC, so New Year's midnight is not the previous year", () => {
    expect(yearOf("2011-01-01T00:00:00Z")).toBe(2011);
  });
});

describe("year filter", () => {
  it("keeps everything when there is no range", () => {
    expect(inYearRange("1950-05-01T00:00:00Z", null)).toBe(true);
  });

  it("includes both ends of the range, whichever way you drag", () => {
    const range = rangeBetween(2011, 2004);
    expect(range).toEqual({ from: 2004, to: 2011 });
    expect(inYearRange("2004-01-01T00:00:00Z", range)).toBe(true);
    expect(inYearRange("2011-12-31T00:00:00Z", range)).toBe(true);
    expect(inYearRange("2012-01-01T00:00:00Z", range)).toBe(false);
  });

  it("finds the data's first and last year", () => {
    const dates = ["2018-06-25T00:00:00Z", "1950-01-01T00:00:00Z", "2024-09-04T00:00:00Z"];
    expect(yearBounds(dates)).toEqual({ from: 1950, to: 2024 });
  });

  it("groups items by year", () => {
    const rows = [
      { date_created: "2011-02-01T00:00:00Z" },
      { date_created: "2011-07-01T00:00:00Z" },
      { date_created: "2004-03-01T00:00:00Z" },
    ];
    const byYear = groupByYear(rows);
    expect(byYear.get(2011)).toHaveLength(2);
    expect(byYear.get(2004)).toHaveLength(1);
  });
});
