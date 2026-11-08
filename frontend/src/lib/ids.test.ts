import { describe, expect, it } from "vitest";
import { parseId } from "./ids";

describe("parseId", () => {
  it("reads positive whole numbers", () => {
    expect(parseId("12")).toBe(12);
  });

  it("rejects everything else", () => {
    for (const raw of [undefined, null, "", "0", "-3", "1.5", "abc", "12abc", "99999999999999999999"]) {
      expect(parseId(raw)).toBeNull();
    }
  });
});
