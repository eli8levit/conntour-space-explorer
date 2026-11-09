import { describe, expect, it } from "vitest";
import { STAGGER_CAP, STAGGER_MS, TIMELINE_SPREAD_MS, TIMELINE_START_MS, rankDelay, timelineDelay } from "./motion";

describe("rankDelay", () => {
  it("starts rank 1 at once and steps one beat per rank", () => {
    expect(rankDelay(0)).toBe(0);
    expect(rankDelay(1)).toBe(STAGGER_MS);
  });

  it("caps the wait, so 50 results do not trail on", () => {
    expect(rankDelay(STAGGER_CAP + 20)).toBe(STAGGER_CAP * STAGGER_MS);
    expect(rankDelay(-3)).toBe(0);
  });
});

describe("timelineDelay", () => {
  it("lights the strongest square first", () => {
    expect(timelineDelay(0, 10)).toBe(TIMELINE_START_MS);
    expect(timelineDelay(1, 10)).toBeGreaterThan(timelineDelay(0, 10));
  });

  it("keeps a long list inside the spread", () => {
    expect(timelineDelay(99, 100)).toBeLessThanOrEqual(TIMELINE_START_MS + TIMELINE_SPREAD_MS + 0.001);
  });
});
