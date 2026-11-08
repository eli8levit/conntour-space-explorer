import { describe, expect, it } from "vitest";
import {
  confidenceLevel,
  formatCoordinates,
  formatDate,
  formatPercent,
  formatRelativeTime,
  provenanceLabel,
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

describe("confidenceLevel", () => {
  it("maps scores to three levels", () => {
    expect(confidenceLevel(0.9)).toBe("high");
    expect(confidenceLevel(0.7)).toBe("high");
    expect(confidenceLevel(0.5)).toBe("medium");
    expect(confidenceLevel(0.1)).toBe("low");
  });
});

describe("formatDate", () => {
  it("formats midnight UTC as that same day in every time zone", () => {
    expect(formatDate("2018-06-25T00:00:00Z")).toBe("Jun 25, 2018");
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
    expect(formatCoordinates({ lat: -5.20235, lon: 138.126 })).toBe("-5.20°, 138.13°");
    expect(formatCoordinates({ lat: null, lon: null })).toBeNull();
  });
});
