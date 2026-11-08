import { describe, expect, it } from "vitest";
import { dayLabel, groupByDay, historyMeta, olderLabel } from "./history";

// Local-time dates, so the tests pass in any time zone. Monday 9 Nov 2026, 10:00.
const now = new Date(2026, 10, 9, 10, 0);
const at = (day: number, hour = 12, month = 10, year = 2026) => new Date(year, month, day, hour).toISOString();

describe("dayLabel", () => {
  it("says Today and Yesterday by calendar day, not by 24 hours", () => {
    expect(dayLabel(at(9, 0), now)).toBe("Today");
    expect(dayLabel(at(8, 23), now)).toBe("Yesterday");
    expect(dayLabel(at(8, 0), now)).toBe("Yesterday");
  });

  it("names the weekday within the last week", () => {
    expect(dayLabel(at(6), now)).toBe("Friday 6 November");
  });

  it("uses the month for anything older, with the year only when it differs", () => {
    expect(dayLabel(at(1), now)).toBe("November");
    expect(dayLabel(at(15, 12, 9), now)).toBe("October");
    expect(dayLabel(at(15, 12, 9, 2025), now)).toBe("October 2025");
  });
});

describe("groupByDay", () => {
  it("keeps the order and puts each day under one header", () => {
    const items = [at(9, 9), at(9, 8), at(8), at(6), at(15, 12, 9), at(10, 12, 9)].map((created_at, id) => ({
      id,
      created_at,
    }));
    const groups = groupByDay(items, now);
    expect(groups.map((group) => group.label)).toEqual(["Today", "Yesterday", "Friday 6 November", "October"]);
    expect(groups.map((group) => group.items.length)).toEqual([2, 1, 1, 2]);
  });
});

describe("historyMeta", () => {
  it("counts strong matches and the best score", () => {
    expect(historyMeta({ result_count: 13, strong_count: 5, best_confidence: 1 })).toBe("13 images, 5 strong, best 100%");
  });

  it("says 'all strong' when every result is strong", () => {
    expect(historyMeta({ result_count: 2, strong_count: 2, best_confidence: 0.97 })).toBe("2 images, all strong, best 97%");
  });

  it("describes a single result by its score", () => {
    expect(historyMeta({ result_count: 1, strong_count: 1, best_confidence: 0.79 })).toBe("1 image, 79% match");
    expect(historyMeta({ result_count: 1, strong_count: 0, best_confidence: 0.18 })).toBe("1 image, a faint 18% match");
  });

  it("says plainly when nothing matched", () => {
    expect(historyMeta({ result_count: 0, strong_count: 0, best_confidence: null })).toBe(
      "Nothing matched in the 100 images",
    );
  });

  it("says '0 strong' when only faint matches came back", () => {
    expect(historyMeta({ result_count: 8, strong_count: 0, best_confidence: 0.42 })).toBe("8 images, 0 strong, best 42%");
  });
});

describe("olderLabel", () => {
  it("offers the next page size, or the remainder", () => {
    expect(olderLabel(6, 24, 10)).toBe("Show 10 older searches");
    expect(olderLabel(20, 24, 10)).toBe("Show 4 older searches");
    expect(olderLabel(23, 24, 10)).toBe("Show 1 older search");
  });

  it("drops the number when the total is unknown", () => {
    expect(olderLabel(10, undefined, 10)).toBe("Show older searches");
  });
});
