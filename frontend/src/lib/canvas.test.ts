import { describe, expect, it } from "vitest";
import { packRound, shuffle, spanFor } from "./canvas";

describe("packRound", () => {
  const ids = Array.from({ length: 100 }, (_, i) => i + 1);

  it.each([3, 8, 13, 22])("fills a full %i-column rectangle with no overlap", (cols) => {
    const { slots, rows } = packRound(ids, spanFor, cols);
    const grid = Array.from({ length: rows }, () => Array<number>(cols).fill(0));
    for (const { x, y, span } of slots) {
      for (let dy = 0; dy < span[1]; dy++) for (let dx = 0; dx < span[0]; dx++) grid[y + dy]![x + dx]!++;
    }
    expect(grid.flat().every((count) => count === 1)).toBe(true);
  });

  it("places every item exactly once, plus 1×1 fillers", () => {
    const { slots } = packRound(ids, spanFor, 13);
    const placed = slots.filter((slot) => !slot.filler).map((slot) => slot.item);
    expect([...placed].sort((a, b) => a - b)).toEqual(ids);
    expect(slots.filter((slot) => slot.filler).every((slot) => slot.span[0] === 1 && slot.span[1] === 1)).toBe(true);
  });

  it("shrinks a frame wider than the grid", () => {
    const { slots } = packRound([1], () => [3, 2], 2);
    expect(slots[0]!.span).toEqual([2, 2]);
  });
});

describe("shuffle", () => {
  it("keeps every item and does not touch the input", () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffle(input, () => 0);
    expect(input).toEqual([1, 2, 3, 4, 5]);
    expect([...out].sort()).toEqual(input);
    expect(out).not.toEqual(input);
  });
});
