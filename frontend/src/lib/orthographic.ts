// A3·12, the locator: an orthographic globe drawn as SVG path strings.
// Pure math, no DOM: the component re-projects once per animation frame and
// writes one path string per layer, so the cost is a few thousand points.

/** [longitude, latitude] in degrees, the GeoJSON order (the world-atlas data uses it). */
export type LonLat = readonly [number, number];

/** Where the globe is drawn and which point of the body faces the viewer. */
export interface View {
  /** The longitude and latitude at the centre of the disc. */
  lon0: number;
  lat0: number;
  cx: number;
  cy: number;
  r: number;
}

const rad = (degrees: number) => (degrees * Math.PI) / 180;
const deg = (radians: number) => (radians * 180) / Math.PI;

/**
 * The orthographic projection, rotated so (lon0, lat0) is at the centre:
 *   x = r·cos φ·sin(λ − λ0)
 *   y = r·(cos φ0·sin φ − sin φ0·cos φ·cos(λ − λ0))
 * A point is on the near side when cos c = sin φ0·sin φ + cos φ0·cos φ·cos(λ − λ0) ≥ 0.
 * SVG y grows downwards, hence `cy − y`.
 */
export function project(view: View, [lon, lat]: LonLat): { x: number; y: number; visible: boolean } {
  const phi = rad(lat);
  const phi0 = rad(view.lat0);
  const dLambda = rad(lon - view.lon0);
  const cosC = Math.sin(phi0) * Math.sin(phi) + Math.cos(phi0) * Math.cos(phi) * Math.cos(dLambda);
  return {
    x: view.cx + view.r * Math.cos(phi) * Math.sin(dLambda),
    y: view.cy - view.r * (Math.cos(phi0) * Math.sin(phi) - Math.sin(phi0) * Math.cos(phi) * Math.cos(dLambda)),
    visible: cosC >= 0,
  };
}

const fixed = (value: number) => Math.round(value * 10) / 10;

/**
 * Polylines as one SVG path. A line that goes round to the far side is cut
 * there and starts again with a new "M" where it comes back, so the back of
 * the globe never shows through.
 */
export function linesPath(view: View, lines: readonly (readonly LonLat[])[]): string {
  let d = "";
  for (const line of lines) {
    let penDown = false;
    for (const point of line) {
      const p = project(view, point);
      if (!p.visible) {
        penDown = false;
        continue;
      }
      d += `${penDown ? "L" : "M"}${fixed(p.x)} ${fixed(p.y)}`;
      penDown = true;
    }
  }
  return d;
}

/** Small dots (two half-circle arcs each) for the points on the near side. */
export function dotsPath(view: View, points: readonly LonLat[], radius: number): string {
  let d = "";
  for (const point of points) {
    const p = project(view, point);
    if (!p.visible) continue;
    d += `M${fixed(p.x - radius)} ${fixed(p.y)}a${radius} ${radius} 0 1 0 ${radius * 2} 0a${radius} ${radius} 0 1 0 ${-radius * 2} 0`;
  }
  return d;
}

/** Parallels and meridians every `step` degrees, sampled every 3° so they curve with the sphere. */
export function graticule(step: number): LonLat[][] {
  const lines: LonLat[][] = [];
  for (let lat = -90 + step; lat < 90; lat += step) {
    const parallel: LonLat[] = [];
    for (let lon = -180; lon <= 180; lon += 3) parallel.push([lon, lat]);
    lines.push(parallel);
  }
  for (let lon = -180; lon < 180; lon += step) {
    const meridian: LonLat[] = [];
    for (let lat = -90; lat <= 90; lat += 3) meridian.push([lon, lat]);
    lines.push(meridian);
  }
  return lines;
}

/**
 * A circle on the sphere, `radiusDeg` of arc around a point (the named Mars
 * features). The destination-point formula walks that arc in every bearing.
 */
export function smallCircle([lon, lat]: LonLat, radiusDeg: number, steps = 24): LonLat[] {
  const phi1 = rad(lat);
  const delta = rad(radiusDeg);
  return Array.from({ length: steps + 1 }, (_, index) => {
    const bearing = (2 * Math.PI * index) / steps;
    const phi2 = Math.asin(Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(bearing));
    const lambda = Math.atan2(
      Math.sin(bearing) * Math.sin(delta) * Math.cos(phi1),
      Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2),
    );
    return [lon + deg(lambda), deg(phi2)] as const;
  });
}

/** 28.5729 -> "28.57° N"; the hemisphere letter replaces the sign, as on a chart. */
export function hemisphere(value: number, axis: "lat" | "lon"): string {
  const letter = axis === "lat" ? (value < 0 ? "S" : "N") : value < 0 ? "W" : "E";
  return `${Math.abs(value).toFixed(2)}° ${letter}`;
}
