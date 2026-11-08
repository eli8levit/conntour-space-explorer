import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { angularDistanceDeg, fitDistance, latLonToVector, occludedBySphere } from "./geo";

describe("latLonToVector", () => {
  it("puts lat 0, lon 0 toward +z, the north pole at +y, and east at +x", () => {
    const front = latLonToVector(0, 0);
    expect([front.x, front.y, front.z].map((v) => Math.round(v * 1e6) / 1e6 + 0)).toEqual([0, 0, 1]);
    expect(latLonToVector(90, 0).y).toBeCloseTo(1);
    expect(latLonToVector(0, 90).x).toBeCloseTo(1);
  });

  it("keeps every point on the sphere's radius", () => {
    expect(latLonToVector(28.57, -80.65, 2.5).length()).toBeCloseTo(2.5);
  });
});

describe("angularDistanceDeg", () => {
  it("measures a quarter turn along the equator as 90°", () => {
    expect(angularDistanceDeg(0, 0, 0, 90)).toBeCloseTo(90);
  });

  it("knows Kennedy Space Center and Houston are about 13° apart", () => {
    expect(angularDistanceDeg(28.57, -80.65, 29.56, -95.09)).toBeCloseTo(12.6, 0);
  });
});

describe("occludedBySphere", () => {
  const camera = new Vector3(0, 0, 5);
  const center = new Vector3(0, 0, 0);

  it("hides a point on the far side of the planet", () => {
    expect(occludedBySphere(camera, new Vector3(0, 0, -1.01), center, 1)).toBe(true);
  });

  it("shows a point on the near side, and one beside the planet", () => {
    expect(occludedBySphere(camera, new Vector3(0, 0, 1.01), center, 1)).toBe(false);
    expect(occludedBySphere(camera, new Vector3(2, 0, -1), center, 1)).toBe(false);
  });
});

describe("fitDistance", () => {
  it("backs off further on a portrait screen", () => {
    expect(fitDistance(1, 40, 0.5)).toBeCloseTo(2 * fitDistance(1, 40, 1.6));
  });
});
