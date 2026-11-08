// Grouping pins that sit on top of each other (40 photos at Kennedy Space Center
// would otherwise be one unreadable blob), and spreading a group out on click.
import { angularDistanceDeg } from "./geo";

export interface LatLon {
  lat: number;
  lon: number;
}

export interface Cluster<T> extends LatLon {
  members: T[];
}

/**
 * Greedy clustering: walk the items once; each item joins the first cluster whose
 * first member is within `maxDeg`, otherwise it starts a new cluster.
 * O(items × clusters), which is nothing for 100 pins, and easy to explain.
 * A fixed angle (not screen pixels) keeps the groups stable while you zoom.
 */
export function clusterNearby<T extends LatLon>(items: T[], maxDeg: number): Cluster<T>[] {
  const clusters: { seed: T; members: T[] }[] = [];
  for (const item of items) {
    const home = clusters.find(
      (c) => angularDistanceDeg(c.seed.lat, c.seed.lon, item.lat, item.lon) <= maxDeg,
    );
    if (home) home.members.push(item);
    else clusters.push({ seed: item, members: [item] });
  }
  // The marker sits at the members' average spot. (Fine for groups a few degrees wide,
  // which never straddle the ±180° line in this data.)
  return clusters.map(({ members }) => ({
    members,
    lat: members.reduce((sum, m) => sum + m.lat, 0) / members.length,
    lon: members.reduce((sum, m) => sum + m.lon, 0) / members.length,
  }));
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ≈ 137.5°

/**
 * Fan-out positions for `count` pins around a center: a sunflower spiral.
 * Each point turns by the golden angle and steps out by √i, so the points fill
 * a disc evenly and never land on each other, for any count.
 */
export function fanOut(center: LatLon, count: number, spacingDeg: number): LatLon[] {
  const lonScale = 1 / Math.max(0.2, Math.cos((center.lat * Math.PI) / 180)); // a degree of lon shrinks toward the poles
  return Array.from({ length: count }, (_, i) => {
    const r = spacingDeg * Math.sqrt(i + 0.5);
    const theta = i * GOLDEN_ANGLE;
    return { lat: center.lat + r * Math.sin(theta), lon: center.lon + r * Math.cos(theta) * lonScale };
  });
}

/** Angular radius of a fan of `count` pins (the outermost ring), in degrees. */
export function fanRadiusDeg(count: number, spacingDeg: number): number {
  return spacingDeg * Math.sqrt(count - 0.5);
}
