import { describe, expect, it } from "vitest";
import {
  formatRank,
  isStrong,
  matchedTerms,
  rankSpan,
  rankTier,
  resultSummary,
  SCORING_NOTE,
  STRONG_MATCH,
  whyLine,
} from "./match";

describe("resultSummary", () => {
  it("covers every mix of strong and faint", () => {
    expect(resultSummary(5, 8)).toBe("5 strong matches, 8 faint");
    expect(resultSummary(0, 6)).toBe("No strong matches, 6 faint");
    expect(resultSummary(1, 0)).toBe("1 strong match");
    expect(resultSummary(0, 0)).toBe("No matches");
  });
});

describe("strong / faint", () => {
  it("splits at 0.5, inclusive", () => {
    expect(STRONG_MATCH).toBe(0.5);
    expect(isStrong(0.5)).toBe(true);
    expect(isStrong(0.4999)).toBe(false);
  });
});

describe("rankSpan and rankTier", () => {
  it("makes rank 1 the hero, 2–4 large, 5–10 wide, the rest single cells", () => {
    expect(rankSpan(1)).toEqual([4, 2]);
    expect([2, 3, 4].map(rankSpan)).toEqual([[2, 2], [2, 2], [2, 2]]);
    expect(rankSpan(5)).toEqual([2, 1]);
    expect(rankSpan(10)).toEqual([2, 1]);
    expect(rankSpan(11)).toEqual([1, 1]);
    expect(rankSpan(50)).toEqual([1, 1]);
  });

  it("pairs each size with its caption tier", () => {
    expect([1, 2, 4, 5, 10, 11].map(rankTier)).toEqual(["hero", "large", "large", "wide", "wide", "small"]);
  });

  it("pads ranks to two digits", () => {
    expect(formatRank(4)).toBe("04");
    expect(formatRank(12)).toBe("12");
  });
});

const marsBriefing = {
  title: "Mars Briefing",
  keywords: ["Mars", "Odyssey"],
  description: "A geophysicist speaks about the rover at NASA Headquarters.",
};

describe("matchedTerms", () => {
  it("finds the best field for each query word, reported as typed", () => {
    expect(matchedTerms("mars rover", marsBriefing)).toEqual([
      { term: "mars", field: "title" },
      { term: "rover", field: "description" },
    ]);
  });

  it("matches plurals through the shared stemmer", () => {
    expect(matchedTerms("rovers", marsBriefing)).toEqual([{ term: "rovers", field: "description" }]);
  });

  it("returns nothing for a pure meaning match", () => {
    expect(matchedTerms("red planet", marsBriefing)).toEqual([]);
  });

  it("matches the whole hyphenated word first", () => {
    const sts135 = { title: "STS-135 crew", keywords: [], description: "" };
    expect(matchedTerms("STS-135", sts135)).toEqual([{ term: "sts-135", field: "title" }]);
  });

  it("tries the hyphen-split parts, like Postgres does (halved STS-129)", () => {
    const sts129 = { title: "STS-129 Atlantis", keywords: [], description: "" };
    expect(matchedTerms("STS-135", sts129)).toEqual([{ term: "sts", field: "title" }]);
    expect(whyLine(matchedTerms("STS-135", sts129), 0.6)).toBe("Matched sts in the title");
  });

  it("still says similar in meaning when no part is there", () => {
    expect(matchedTerms("STS-135", marsBriefing)).toEqual([]);
  });

  it("keeps Mars and Marshall as different whole words", () => {
    const marshall = { title: "Marshall Space Flight Center", keywords: [], description: "" };
    expect(matchedTerms("Mars", marshall)).toEqual([]);
  });
});

describe("whyLine", () => {
  it("names one field when every word is there", () => {
    expect(whyLine([{ term: "mars", field: "title" }, { term: "rover", field: "title" }], 0.9)).toBe(
      "Matched mars, rover in the title",
    );
  });

  it("names each field when the words are spread out", () => {
    expect(
      whyLine([{ term: "rover", field: "description" }, { term: "mars", field: "keywords" }], 0.7),
    ).toBe("Matched mars in keywords, rover in the description");
  });

  it("says 'similar in meaning' when no word matched", () => {
    expect(whyLine([], 0.82)).toBe("Similar in meaning · Meaning 82%");
  });

  it("ends with the ID rule's note when there is one", () => {
    expect(whyLine([{ term: "sts", field: "title" }], 1, "halved: “STS-135” is not in this image")).toBe(
      "Matched sts in the title · halved: “STS-135” is not in this image",
    );
  });
});

describe("SCORING_NOTE", () => {
  it("states the backend weights", () => {
    expect(SCORING_NOTE).toBe(
      "Confidence blends meaning (80%) and matching words (20%). Hover a result for the breakdown.",
    );
  });
});

describe("matchedTerms: the NASA title", () => {
  it("says NASA title when only NASA's title has the word", () => {
    const marbles = {
      title: "Perseverance marble countdown",
      nasaTitle: "Perseverance Mars Rover Marble Countdown",
      keywords: [],
      description: "",
    };
    expect(whyLine(matchedTerms("mars rover", marbles), 0.9)).toBe("Matched mars, rover in the NASA title");
    expect(whyLine(matchedTerms("marble", marbles), 0.9)).toBe("Matched marble in the title");
  });
});
