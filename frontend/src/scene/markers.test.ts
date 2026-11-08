import { describe, expect, it } from "vitest";
import type { PlaceRow } from "../api/types";
import { bestTier, buildMarkers, groupRows, tierOf } from "./markers";

let nextId = 1;
function row(body: PlaceRow["body"], lat: number | null, lon: number | null, label = "Somewhere"): PlaceRow {
  const id = nextId++;
  return {
    source_id: id,
    nasa_id: `N${id}`,
    title: `Photo ${id}`,
    short_title: null,
    thumb_url: "",
    date_created: `20${10 + (id % 10)}-01-01T00:00:00Z`,
    body,
    lat,
    lon,
    label,
    provenance: "caption",
  };
}

const ksc = [row("earth", 28.57, -80.65), row("earth", 28.61, -80.6), row("earth", 28.52, -80.65)];
const rows = [
  ...ksc,
  row("earth", 29.56, -95.09), // Houston: too far from KSC to join it
  row("mars", -5.2, 138.1, "Gale Crater"),
  row("orbit", null, null, "ISS"),
  row("deep_space", null, null, "Saturn"),
];

describe("groupRows", () => {
  it("clusters nearby Earth pins and leaves the rest single", () => {
    const sizes = groupRows(rows).map((g) => [g.body, g.rows.length]);
    expect(sizes).toContainEqual(["earth", 3]);
    expect(sizes).toContainEqual(["earth", 1]);
    expect(sizes).toContainEqual(["mars", 1]);
    expect(sizes).toContainEqual(["orbit", 1]);
  });
});

describe("buildMarkers", () => {
  it("shows a closed cluster as one marker", () => {
    const markers = buildMarkers(groupRows(rows), null, null);
    expect(markers.filter((m) => m.kind === "cluster")).toHaveLength(1);
    expect(markers).toHaveLength(5);
  });

  it("fans an open cluster out into pins that remember their true spots", () => {
    const groups = groupRows(rows);
    const kscKey = groups.find((g) => g.rows.length === 3)!.key;
    const markers = buildMarkers(groups, kscKey, null);
    expect(markers.filter((m) => m.trueSpot)).toHaveLength(3);
    expect(markers.some((m) => m.kind === "cluster")).toBe(false);
  });
});

describe("search tiers", () => {
  const confidences = new Map([
    [1, 0.72],
    [2, 0.41],
  ]);

  it("splits results at 50% and dims the rest", () => {
    expect(tierOf(1, confidences)).toBe("strong");
    expect(tierOf(2, confidences)).toBe("faint");
    expect(tierOf(3, confidences)).toBe("dim");
    expect(tierOf(3, null)).toBe("normal");
  });

  it("colors a cluster by its best member", () => {
    expect(bestTier(["dim", "faint", "strong"])).toBe("strong");
    expect(bestTier(["dim", "dim"])).toBe("dim");
  });
});
