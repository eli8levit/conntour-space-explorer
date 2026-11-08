import { describe, expect, it } from "vitest";
import {
  formatCoordinates,
  formatDate,
  formatTime,
  yearOf,
  formatPercent,
  formatRelativeTime,
  isBody,
  provenanceLabel,
  scoreBreakdown,
} from "./format";

describe("formatPercent", () => {
  it("rounds to a whole percent", () => {
    expect(formatPercent(0.823)).toBe("82%");
    expect(formatPercent(0.825)).toBe("83%");
  });

  it("clamps scores outside 0–1", () => {
    expect(formatPercent(1.2)).toBe("100%");
    expect(formatPercent(-0.1)).toBe("0%");
  });
});

describe("scoreBreakdown", () => {
  const hit = { semantic_score: 0.82, keyword_score: 0.4 };

  it("shows both signals", () => {
    expect(scoreBreakdown(hit, true)).toBe("Meaning 82% · Words 40%");
  });

  it("shows only words when semantic search is off", () => {
    expect(scoreBreakdown(hit, false)).toBe("Words 40%");
  });
});

describe("isBody", () => {
  it("accepts known bodies only", () => {
    expect(isBody("mars")).toBe(true);
    expect(isBody("pluto")).toBe(false);
    expect(isBody("toString")).toBe(false);
  });
});

describe("formatDate", () => {
  it("formats midnight UTC as that same day in every time zone", () => {
    expect(formatDate("2018-06-25T00:00:00Z")).toBe("25 Jun 2018");
    expect(yearOf("2018-01-01T00:00:00Z")).toBe(2018);
  });
});

describe("formatTime", () => {
  it("uses a 24-hour clock", () => {
    // Built from local parts, so the test passes in any time zone.
    expect(formatTime(new Date(2026, 10, 8, 23, 31).toISOString())).toBe("23:31");
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-11-08T12:00:00Z");

  it("says just now for the last few seconds", () => {
    expect(formatRelativeTime("2026-11-08T11:59:30Z", now)).toBe("just now");
  });

  it("uses the largest whole unit", () => {
    expect(formatRelativeTime("2026-11-08T11:55:00Z", now)).toBe("5 minutes ago");
    expect(formatRelativeTime("2026-11-08T09:00:00Z", now)).toBe("3 hours ago");
    expect(formatRelativeTime("2026-11-07T12:00:00Z", now)).toBe("yesterday");
    expect(formatRelativeTime("2026-10-25T12:00:00Z", now)).toBe("2 weeks ago");
  });
});

describe("place labels", () => {
  it("shows approximate places honestly", () => {
    expect(provenanceLabel("NASA center (approx.)")).toBe("approx.: NASA center");
  });

  it("formats coordinates, or null when there are none", () => {
    expect(formatCoordinates({ lat: -5.20235, lon: 138.126 })).toBe("\u22125.20°, 138.13°");
    expect(formatCoordinates({ lat: -0.001, lon: 0 })).toBe("0.00°, 0.00°");
    expect(formatCoordinates({ lat: null, lon: null })).toBeNull();
  });
});
