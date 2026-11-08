import { describe, expect, it } from "vitest";
import { spanFor } from "./canvas";
import { inRange, isFullRange, layoutSquares, parseYearRange, yearExtent, yearSentence } from "./timeline";

const src = (id: number, year: number) => ({ id, date_created: `${year}-06-01T00:00:00Z` });

describe("layoutSquares", () => {
  const sources = [src(1, 2018), src(2, 2018), src(3, 2018), src(4, 1950)];
  const squares = layoutSquares(sources, new Map([[3, 0.9], [2, 0.3]]));
  const byId = new Map(squares.map((square) => [square.sourceId, square]));

  it("stacks results first, best first, then the rest", () => {
    expect([3, 2, 1].map((id) => byId.get(id)?.stack)).toEqual([0, 1, 2]);
    expect(byId.get(4)?.stack).toBe(0);
  });

  it("colors by tier", () => {
    expect([3, 2, 1].map((id) => byId.get(id)?.kind)).toEqual(["strong", "faint", "none"]);
  });
});

describe("year range", () => {
  const extent = yearExtent([src(1, 1950), src(2, 2024), src(3, 2011)]);

  it("computes the archive span from the data", () => {
    expect(extent).toEqual({ from: 1950, to: 2024 });
  });

  it("reads ?from=&to=, clamped to the archive", () => {
    expect(parseYearRange(new URLSearchParams("from=2000&to=2024"), extent)).toEqual({ from: 2000, to: 2024 });
    expect(parseYearRange(new URLSearchParams("from=1900"), extent)).toEqual({ from: 1950, to: 2024 });
    expect(parseYearRange(new URLSearchParams("from=abc&to=2010"), extent)).toEqual({ from: 1950, to: 2010 });
    expect(parseYearRange(new URLSearchParams("from=2010&to=2000"), extent)).toEqual({ from: 2000, to: 2010 });
  });

  it("knows a full range and filters by year", () => {
    expect(isFullRange({ from: 1950, to: 2024 }, extent)).toBe(true);
    expect(isFullRange({ from: 2000, to: 2024 }, extent)).toBe(false);
    expect(inRange(1999, { from: 2000, to: 2024 })).toBe(false);
    expect(inRange(2000, { from: 2000, to: 2024 })).toBe(true);
  });

  it("writes the A3 sentence", () => {
    expect(yearSentence(2018, 4)).toBe("Taken in 2018, one of 4 images from that year.");
    expect(yearSentence(1950, 1)).toBe("Taken in 1950, the only image from that year.");
  });
});

describe("spanFor", () => {
  it("is stable and close to the planned mix over 1000 ids", () => {
    expect(spanFor(42)).toEqual(spanFor(42));
    const counts = new Map<string, number>();
    for (let id = 1; id <= 1000; id++) {
      const key = spanFor(id).join("x");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    // The planned shares are 12/18/16/14/40%; a hash is never exact, so allow some slack.
    expect(counts.get("3x2")! / 10).toBeGreaterThan(6);
    expect(counts.get("1x1")! / 10).toBeGreaterThan(30);
  });
});
