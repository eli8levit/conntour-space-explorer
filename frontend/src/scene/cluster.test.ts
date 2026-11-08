import { describe, expect, it } from "vitest";
import { clusterNearby, fanOut, fanRadiusDeg } from "./cluster";
import { angularDistanceDeg } from "./geo";

const KSC = { lat: 28.57, lon: -80.65 };
const PAD_39A = { lat: 28.61, lon: -80.6 };
const HOUSTON = { lat: 29.56, lon: -95.09 };

describe("clusterNearby", () => {
  it("groups pins within the radius and keeps far ones apart", () => {
    const clusters = clusterNearby([KSC, HOUSTON, PAD_39A], 2.5);
    expect(clusters.map((c) => c.members.length)).toEqual([2, 1]);
  });

  it("puts the cluster marker at the members' average spot", () => {
    const [cluster] = clusterNearby([KSC, PAD_39A], 2.5);
    expect(cluster?.lat).toBeCloseTo(28.59);
    expect(cluster?.lon).toBeCloseTo(-80.625);
  });

  it("keeps every item exactly once", () => {
    const items = Array.from({ length: 30 }, (_, i) => ({ lat: (i % 7) * 3, lon: i * 1.1 }));
    const total = clusterNearby(items, 2.5).reduce((n, c) => n + c.members.length, 0);
    expect(total).toBe(30);
  });
});

describe("fanOut", () => {
  const spots = fanOut(KSC, 40, 0.75);

  it("spreads 40 pins so no two land on each other", () => {
    let closest = Infinity;
    spots.forEach((a, i) =>
      spots.slice(i + 1).forEach((b) => {
        closest = Math.min(closest, angularDistanceDeg(a.lat, a.lon, b.lat, b.lon));
      }),
    );
    expect(closest).toBeGreaterThan(0.75 * 0.6);
  });

  it("stays inside the fan radius (within 2%: the lat/lon offsets are a flat approximation)", () => {
    const farthest = Math.max(...spots.map((s) => angularDistanceDeg(KSC.lat, KSC.lon, s.lat, s.lon)));
    expect(farthest).toBeLessThanOrEqual(fanRadiusDeg(40, 0.75) * 1.02);
  });
});
