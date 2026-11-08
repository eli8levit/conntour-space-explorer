import { describe, expect, it } from "vitest";
import {
  firstQueryId,
  formatCoordinates,
  formatDate,
  formatTime,
  yearOf,
  formatPercent,
  formatRelativeTime,
  isBody,
  idRuleNote,
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
  const hit = { semantic_score: 0.82, keyword_score: 0.4, id_rule: null };

  it("shows both signals", () => {
    expect(scoreBreakdown(hit, true, "mars")).toBe("Meaning 82% · Words 40%");
  });

  it("shows only words when semantic search is off", () => {
    expect(scoreBreakdown(hit, false, "mars")).toBe("Words 40%");
  });

  it("says when the ID rule halved the score", () => {
    // The live case: STS-129 shows 43%, while 0.8 × 100% + 0.2 × 27% would be 85%.
    const other = { semantic_score: 1, keyword_score: 0.27, id_rule: "halved" as const };
    expect(scoreBreakdown(other, true, "STS-135")).toBe(
      "Meaning 100% · Words 27% · halved: “STS-135” is not in this image",
    );
  });

  it("says when the ID rule raised the score", () => {
    const exact = { semantic_score: 0.2, keyword_score: 0.3, id_rule: "raised" as const };
    expect(scoreBreakdown(exact, false, "Expedition 61 crew")).toBe("Words 30% · raised: it has “Expedition 61”");
  });
});

describe("firstQueryId", () => {
  it("names the ID the way the user typed it", () => {
    expect(firstQueryId("STS-135 crew")).toBe("STS-135");
    expect(firstQueryId("PIA22505")).toBe("PIA22505");
    expect(firstQueryId("Soyuz MS-13 landing")).toBe("MS-13");
    expect(firstQueryId("Expedition 61")).toBe("Expedition 61");
    expect(firstQueryId("61")).toBe("61");
  });

  it("prefers a letters-and-digits ID over a bare year", () => {
    expect(firstQueryId("launch in 2011 STS-135")).toBe("STS-135");
  });

  it("is null without digits", () => {
    expect(firstQueryId("red planet")).toBeNull();
  });
});

describe("idRuleNote", () => {
  it("is null when the rule changed nothing", () => {
    expect(idRuleNote(null, "STS-135")).toBeNull();
  });

  it("falls back to 'the ID' when it cannot name one", () => {
    expect(idRuleNote("halved", "")).toBe("halved: the ID is not in this image");
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
    expect(formatDate("2024-09-04T00:00:00Z")).toBe("4 Sep 2024");
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
