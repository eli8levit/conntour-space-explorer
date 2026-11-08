import { describe, expect, it } from "vitest";
import { orbitPosition, RINGS, ringOf } from "./layout";

describe("orbit placement", () => {
  it("keeps every orbit photo on its ring", () => {
    for (let i = 0; i < 11; i++) expect(orbitPosition(i, 11, 0.3, RINGS.iss).length()).toBeCloseTo(RINGS.iss.radius);
  });

  it("spaces photos evenly along the ring", () => {
    const a = orbitPosition(0, 4, 0, RINGS.shuttle);
    const b = orbitPosition(1, 4, 0, RINGS.shuttle);
    const c = orbitPosition(2, 4, 0, RINGS.shuttle);
    expect(a.distanceTo(b)).toBeCloseTo(b.distanceTo(c));
    expect(a.distanceTo(c)).toBeCloseTo(2 * RINGS.shuttle.radius); // opposite sides
  });

  it("tilts the ISS ring to its 51.6° inclination", () => {
    const heights = Array.from({ length: 360 }, (_, i) => orbitPosition(i, 360, 0, RINGS.iss).y);
    const highest = Math.max(...heights);
    expect(Math.asin(highest / RINGS.iss.radius) * (180 / Math.PI)).toBeCloseTo(51.6, 0);
  });

  it("drifts with the phase", () => {
    const moved = orbitPosition(0, 4, 0.5, RINGS.iss).distanceTo(orbitPosition(0, 4, 0, RINGS.iss));
    expect(moved).toBeGreaterThan(0.1);
  });

  it("puts ISS photos on the ISS ring and the rest on the Shuttle ring", () => {
    expect(ringOf("ISS")).toBe("iss");
    expect(ringOf("Space Shuttle Discovery")).toBe("shuttle");
  });
});
