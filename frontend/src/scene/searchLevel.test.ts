import { describe, expect, it } from "vitest";
import { searchLevel } from "./searchLevel";

const row = (id: number, body: "earth" | "mars" | "orbit") => ({ source_id: id, body });

describe("searchLevel", () => {
  it("picks the level with the most strong matches", () => {
    const rows = [row(1, "earth"), row(2, "mars"), row(3, "mars"), row(4, "earth")];
    const c = new Map([[1, 0.9], [2, 0.8], [3, 0.7], [4, 0.2]]);
    expect(searchLevel(rows, c)).toBe("mars");
  });
  it("breaks a tie by total matches, then Earth", () => {
    const rows = [row(1, "earth"), row(2, "mars"), row(3, "mars")];
    expect(searchLevel(rows, new Map([[1, 0.9], [2, 0.9], [3, 0.1]]))).toBe("mars");
    expect(searchLevel(rows, new Map([[1, 0.9], [2, 0.9]]))).toBe("earth");
  });
  it("ignores images that are not in the search, and returns null for no matches", () => {
    expect(searchLevel([row(1, "mars")], new Map())).toBeNull();
  });
});
