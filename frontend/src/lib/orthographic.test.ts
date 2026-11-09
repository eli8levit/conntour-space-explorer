import { describe, expect, it } from "vitest";
import { dotsPath, graticule, hemisphere, linesPath, project, smallCircle, type View } from "./orthographic";

const view: View = { lon0: -80.65, lat0: 28.57, cx: 200, cy: 100, r: 80 };

describe("project", () => {
  it("puts the centre point at the centre of the disc", () => {
    const p = project(view, [-80.65, 28.57]);
    expect(p.x).toBeCloseTo(200);
    expect(p.y).toBeCloseTo(100);
    expect(p.visible).toBe(true);
  });

  it("hides the antipode", () => {
    expect(project(view, [99.35, -28.57]).visible).toBe(false);
  });

  it("puts a point 90° east on the equator-centred limb", () => {
    const p = project({ ...view, lon0: 0, lat0: 0 }, [90, 0]);
    expect(p.x).toBeCloseTo(280);
    expect(p.y).toBeCloseTo(100);
  });

  it("draws north up", () => {
    expect(project({ ...view, lat0: 0 }, [view.lon0, 30]).y).toBeLessThan(100);
  });
});

describe("linesPath", () => {
  it("lifts the pen where a line goes round the back", () => {
    // Along the equator from the centre, round the far side, and back to the front.
    const line = [0, 60, 120, 180, 240, 300, 350].map((lon) => [lon, 0] as const);
    const d = linesPath({ ...view, lon0: 0, lat0: 0 }, [line]);
    expect(d.match(/M/g)).toHaveLength(2);
    expect(d).not.toContain("NaN");
  });

  it("draws nothing for a line wholly on the far side", () => {
    expect(linesPath({ ...view, lon0: 0, lat0: 0 }, [[[150, 0], [180, 0]]])).toBe("");
  });
});

describe("helpers", () => {
  it("dotsPath skips hidden points", () => {
    expect(dotsPath({ ...view, lon0: 0, lat0: 0 }, [[0, 0], [180, 0]], 1).match(/M/g)).toHaveLength(1);
  });

  it("smallCircle stays the same arc away from its centre", () => {
    for (const [lon, lat] of smallCircle([138, -5], 4)) {
      const cos =
        Math.sin((-5 * Math.PI) / 180) * Math.sin((lat * Math.PI) / 180) +
        Math.cos((-5 * Math.PI) / 180) * Math.cos((lat * Math.PI) / 180) * Math.cos(((lon - 138) * Math.PI) / 180);
      expect((Math.acos(Math.min(1, cos)) * 180) / Math.PI).toBeCloseTo(4, 5);
    }
  });

  it("graticule has parallels and meridians", () => {
    expect(graticule(30)).toHaveLength(5 + 12);
  });

  it("hemisphere letters replace the sign", () => {
    expect(hemisphere(-80.649, "lon")).toBe("80.65° W");
    expect(hemisphere(28.5729, "lat")).toBe("28.57° N");
  });
});
