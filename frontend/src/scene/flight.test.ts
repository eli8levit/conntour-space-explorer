import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { easeInOutCubic, flyPose, type Pose } from "./flight";

const earth: Pose = { target: new Vector3(0, 0, 0), position: new Vector3(0, 0, 3) };
const mars: Pose = { target: new Vector3(11, 1.5, -10), position: new Vector3(11, 1.5, -8) };
const blank = (): Pose => ({ target: new Vector3(), position: new Vector3() });

describe("flyPose", () => {
  it("starts at the first pose and ends at the second", () => {
    expect(flyPose(earth, mars, 0, blank()).position.distanceTo(earth.position)).toBeCloseTo(0);
    const end = flyPose(earth, mars, 1, blank());
    expect(end.position.distanceTo(mars.position)).toBeCloseTo(0);
    expect(end.target.distanceTo(mars.target)).toBeCloseTo(0);
  });

  it("swings around a planet instead of through it", () => {
    const behind: Pose = { target: new Vector3(), position: new Vector3(0, 0, -3) };
    const side: Pose = { target: new Vector3(), position: new Vector3(3, 0, 0) };
    for (const t of [0.25, 0.5, 0.75]) expect(flyPose(behind, side, t, blank()).position.length()).toBeGreaterThan(1);
  });
});

describe("easeInOutCubic", () => {
  it("is 0 at the start, 1 at the end and half way in the middle", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5);
  });
});
