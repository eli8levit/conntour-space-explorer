import { describe, expect, it } from "vitest";
import { queryTerms, splitHighlights } from "./highlight";

const matches = (text: string, query: string) =>
  splitHighlights(text, queryTerms(query))
    .filter((part) => part.match)
    .map((part) => part.text);

describe("queryTerms", () => {
  it("drops stop words and short words, and stems plurals", () => {
    expect(queryTerms("images of a Mars rovers")).toEqual(["mar", "rover"]);
  });

  it("removes duplicates", () => {
    expect(queryTerms("Rovers rover")).toEqual(["rover"]);
  });

  it("keeps mission IDs with dashes as one term", () => {
    expect(queryTerms("STS-135 launch")).toEqual(["sts-135", "launch"]);
  });

  it("returns nothing for an empty query", () => {
    expect(queryTerms("   ")).toEqual([]);
  });
});

describe("splitHighlights", () => {
  it("marks singular and plural forms, case-insensitive", () => {
    expect(matches("Curiosity Rover on Mars", "mars rovers")).toEqual(["Rover", "Mars"]);
  });

  it("matches whole words only", () => {
    // "Marshall" must not light up for "Mars".
    expect(matches("Marshall Space Flight Center", "mars")).toEqual([]);
  });

  it("matches mission IDs", () => {
    expect(matches("Atlantis (STS-135) launch", "sts-135")).toEqual(["STS-135"]);
  });

  it("always joins back to the original text", () => {
    const text = "Space Shuttle Atlantis (STS-135) launch!";
    const parts = splitHighlights(text, queryTerms("sts-135 launch"));
    expect(parts.map((part) => part.text).join("")).toBe(text);
  });

  it("returns the text unchanged without terms", () => {
    expect(splitHighlights("Gale Crater", [])).toEqual([{ text: "Gale Crater", match: false }]);
  });
});
