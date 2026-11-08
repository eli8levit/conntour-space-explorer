// Turns place rows into the markers the scene draws: single pins, cluster
// markers, and the fanned-out pins of an open cluster. No React, no WebGL:
// tested in markers.test.ts.
import { Vector3 } from "three";
import type { Body, PlaceRow } from "../api/types";
import { clusterNearby, fanOut, type LatLon } from "./cluster";
import { latLonToVector } from "./geo";
import { deepSpaceAnchor, EARTH, MARS, MOON, orbitPosition, RINGS, ringOf, type RingName, type Sphere } from "./layout";

/** Pins closer than this (great-circle degrees) share one cluster marker. ~280 km on Earth. */
export const CLUSTER_DEG = 2.5;
/** Spacing between fanned-out pins, in degrees, on Earth. Scaled by radius on other bodies. */
export const FAN_SPACING_DEG = 0.75;

const SURFACES: Partial<Record<Body, Sphere>> = { earth: EARTH, moon: MOON, mars: MARS };

/** One spot on the map: a single photo, or several photos clustered together. */
export interface Group {
  key: string;
  body: Body;
  rows: PlaceRow[];
  lat: number | null;
  lon: number | null;
}

/** strong/faint: a search result (≥ 50% or below). dim: not a result. normal: no search. */
export type Tier = "normal" | "strong" | "faint" | "dim";

export interface Marker {
  key: string;
  kind: "pin" | "cluster";
  body: Body;
  rows: PlaceRow[];
  tier: Tier;
  /** Exactly one of these says where the marker is. */
  at: { surface: LatLon } | { orbit: { ring: RingName; index: number; count: number } } | { fixed: Vector3 };
  /** For a fanned-out pin: its true spot, where the thin leader line starts. */
  trueSpot?: LatLon;
}

const sortByDate = (a: PlaceRow, b: PlaceRow) => a.date_created.localeCompare(b.date_created);

/**
 * Surface photos (Earth, Moon, Mars) are clustered by distance.
 * Orbit and deep-space photos have no coordinates, so each is its own group.
 * Surface rows without coordinates are skipped (none today; they still count in the totals).
 */
export function groupRows(rows: PlaceRow[]): Group[] {
  const groups: Group[] = [];
  for (const body of Object.keys(SURFACES) as Body[]) {
    const located = rows
      .filter((r) => r.body === body && r.lat !== null && r.lon !== null)
      .map((r) => ({ row: r, lat: r.lat as number, lon: r.lon as number }));
    for (const cluster of clusterNearby(located, CLUSTER_DEG)) {
      const members = cluster.members.map((m) => m.row).sort(sortByDate);
      // The key comes from the lowest id, so it stays the same when the order changes.
      const key = `c${Math.min(...members.map((m) => m.source_id))}`;
      groups.push({ key, body, rows: members, lat: cluster.lat, lon: cluster.lon });
    }
  }
  for (const row of rows) {
    if (row.body === "orbit" || row.body === "deep_space") {
      groups.push({ key: `p${row.source_id}`, body: row.body, rows: [row], lat: null, lon: null });
    }
  }
  return groups;
}

export function tierOf(sourceId: number, confidences: Map<number, number> | null): Tier {
  if (!confidences) return "normal";
  const confidence = confidences.get(sourceId);
  if (confidence === undefined) return "dim";
  return confidence >= 0.5 ? "strong" : "faint";
}

const TIER_RANK: Record<Tier, number> = { dim: 0, normal: 1, faint: 2, strong: 3 };

/** A cluster shows its best member: one strong match inside makes the whole marker orange. */
export function bestTier(tiers: Tier[]): Tier {
  return tiers.reduce((best, t) => (TIER_RANK[t] > TIER_RANK[best] ? t : best), "dim" as Tier);
}

/** Fan spacing for a body: the same on-screen spread on a small planet as on Earth. */
export function fanSpacing(body: Body): number {
  const sphere = SURFACES[body] ?? EARTH;
  return FAN_SPACING_DEG / sphere.radius;
}

export function buildMarkers(groups: Group[], openKey: string | null, confidences: Map<number, number> | null): Marker[] {
  const markers: Marker[] = [];
  const orbitRows = groups.filter((g) => g.body === "orbit").map((g) => g.rows[0] as PlaceRow);
  const deepRows = groups.filter((g) => g.body === "deep_space").map((g) => g.rows[0] as PlaceRow);

  for (const group of groups) {
    const row = group.rows[0] as PlaceRow;
    const pin = (r: PlaceRow, at: Marker["at"], trueSpot?: LatLon): Marker => ({
      key: `p${r.source_id}`,
      kind: "pin",
      body: group.body,
      rows: [r],
      tier: tierOf(r.source_id, confidences),
      at,
      trueSpot,
    });

    if (group.body === "orbit") {
      const ring = ringOf(row.label);
      const onRing = orbitRows.filter((r) => ringOf(r.label) === ring).sort(sortByDate);
      markers.push(pin(row, { orbit: { ring, index: onRing.indexOf(row), count: onRing.length } }));
    } else if (group.body === "deep_space") {
      markers.push(pin(row, { fixed: deepSpaceAnchor(row.label, deepRows.indexOf(row)) }));
    } else if (group.rows.length === 1) {
      markers.push(pin(row, { surface: { lat: group.lat as number, lon: group.lon as number } }));
    } else if (group.key === openKey) {
      // The open cluster: every member at its own fan spot, with a line back to its true spot.
      const center = { lat: group.lat as number, lon: group.lon as number };
      const spots = fanOut(center, group.rows.length, fanSpacing(group.body));
      group.rows.forEach((r, i) => {
        markers.push(pin(r, { surface: spots[i] as LatLon }, { lat: r.lat as number, lon: r.lon as number }));
      });
    } else {
      markers.push({
        key: group.key,
        kind: "cluster",
        body: group.body,
        rows: group.rows,
        tier: bestTier(group.rows.map((r) => tierOf(r.source_id, confidences))),
        at: { surface: { lat: group.lat as number, lon: group.lon as number } },
      });
    }
  }
  return markers;
}

/** The most common place label in a group, to name a cluster: "Kennedy Space Center". */
export function mainLabel(rows: PlaceRow[]): string {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.label, (counts.get(r.label) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
}

/** Just above the ground, so pins draw on top of the coastlines. */
const LIFT = 1.006;

export function surfacePosition(body: Body, spot: LatLon, out = new Vector3()): Vector3 {
  const sphere = SURFACES[body] ?? EARTH;
  return latLonToVector(spot.lat, spot.lon, sphere.radius * LIFT, out).add(sphere.center);
}

/** World position of a marker. `phase` is the orbit drift angle (radians). */
export function positionOf(marker: Marker, phase: number, out = new Vector3()): Vector3 {
  const at = marker.at;
  if ("surface" in at) return surfacePosition(marker.body, at.surface, out);
  if ("orbit" in at) return orbitPosition(at.orbit.index, at.orbit.count, phase, RINGS[at.orbit.ring], out);
  return out.copy(at.fixed);
}
