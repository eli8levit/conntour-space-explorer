// Where each level of the scene lives. NOT to scale on purpose: real distances
// (Mars is ~12,000 Earth radii away) would make every level a dot. Planet sizes
// keep their real ratio (Mars ≈ 0.53 Earth); the distances between levels are
// just "far enough that the camera flight reads as travel".
import { Vector3 } from "three";
import type { Body } from "../api/types";
import { latLonToVector } from "./geo";

export type Level = Body;

export interface Sphere {
  center: Vector3;
  radius: number;
}

export interface LevelSpec {
  name: string;
  /** What the camera looks at and orbits around on this level. */
  center: Vector3;
  /** Camera position relative to `center` when you arrive. */
  cameraOffset: Vector3;
  /** Zoom limits (distance from `center`). */
  minDistance: number;
  maxDistance: number;
}

export const EARTH: Sphere = { center: new Vector3(0, 0, 0), radius: 1 };
export const MOON: Sphere = { center: new Vector3(3.4, 0.8, -2.6), radius: 0.27 };
export const MARS: Sphere = { center: new Vector3(11, 1.5, -10), radius: 0.53 };
const DEEP_CENTER = new Vector3(24, 9, 8); // off to the side: never in the background of Earth or Mars
export const SATURN: Sphere = { center: DEEP_CENTER.clone().add(new Vector3(-0.8, 0.15, 0)), radius: 0.42 };
/** The middle of the short asteroid-belt arc drawn in the deep-space level. */
export const BELT_CENTER = DEEP_CENTER.clone().add(new Vector3(0.95, -0.25, 0.3));

export const LEVELS: Record<Level, LevelSpec> = {
  // Start above the US east coast, where most Earth photos were taken.
  earth: { name: "Earth", center: EARTH.center, cameraOffset: latLonToVector(30, -82, 3.6), minDistance: 1.12, maxDistance: 7 },
  orbit: { name: "Orbit", center: EARTH.center, cameraOffset: latLonToVector(34, -40, 4.3), minDistance: 1.5, maxDistance: 8 },
  moon: { name: "Moon", center: MOON.center, cameraOffset: latLonToVector(10, 0, 1.0), minDistance: 0.32, maxDistance: 2.5 },
  mars: { name: "Mars", center: MARS.center, cameraOffset: latLonToVector(12, -60, 2.3), minDistance: 0.6, maxDistance: 4 },
  deep_space: { name: "Deep space", center: DEEP_CENTER, cameraOffset: new Vector3(0.2, 0.8, 4.4), minDistance: 1.2, maxDistance: 9 },
};

export const LEVEL_ORDER: Level[] = ["earth", "orbit", "moon", "mars", "deep_space"];

/** The planet a pin sits on, if any. Earth and orbit pins share Earth: it hides what is behind it. */
export function homeSphere(body: Body): Sphere | null {
  if (body === "earth" || body === "orbit") return EARTH;
  if (body === "moon") return MOON;
  if (body === "mars") return MARS;
  return null;
}

/** Earth and orbit are one neighborhood: labels of both show when you are on either level. */
export function neighborhood(level: Level): Level {
  return level === "orbit" ? "earth" : level;
}

// --- Orbit ---------------------------------------------------------------

export interface Ring {
  radius: number;
  inclinationDeg: number; // tilt from the equator
  nodeDeg: number; // where the tilted ring crosses the equator
  label: string;
}

// Two rings with the real inclinations: the ISS orbits at 51.6°, and most
// Shuttle flights from Florida flew at about 28.5°. Altitudes are exaggerated.
export const RINGS = {
  iss: { radius: 1.32, inclinationDeg: 51.6, nodeDeg: 20, label: "ISS orbit, 51.6°" },
  shuttle: { radius: 1.18, inclinationDeg: 28.5, nodeDeg: 60, label: "Shuttle orbits, 28.5°" },
} satisfies Record<string, Ring>;

export type RingName = keyof typeof RINGS;

export function ringOf(label: string): RingName {
  return label.startsWith("ISS") ? "iss" : "shuttle";
}

const Y_AXIS = new Vector3(0, 1, 0);
const X_AXIS = new Vector3(1, 0, 0);

/** A point on a ring at `angle` (radians), around Earth's center. */
export function ringPoint(ring: Ring, angle: number, out = new Vector3()): Vector3 {
  out.set(ring.radius * Math.cos(angle), 0, ring.radius * Math.sin(angle));
  out.applyAxisAngle(X_AXIS, (ring.inclinationDeg * Math.PI) / 180); // tilt the ring
  out.applyAxisAngle(Y_AXIS, (ring.nodeDeg * Math.PI) / 180); // turn it around the pole
  return out.add(EARTH.center);
}

/**
 * Orbit photos have no coordinates (the camera was moving at 7.7 km/s), so we
 * space them evenly along their ring. `phase` slowly grows to make them drift.
 */
export function orbitPosition(index: number, count: number, phase: number, ring: Ring, out = new Vector3()): Vector3 {
  return ringPoint(ring, phase + (2 * Math.PI * index) / Math.max(1, count), out);
}

// --- Deep space ----------------------------------------------------------

/**
 * Deep-space photos have a named target, not coordinates. Known targets get a
 * hand-placed anchor (Saturn: on its face toward the camera; asteroids: in the
 * belt). Anything new goes on a small spiral around the level center.
 */
export function deepSpaceAnchor(label: string, index: number, out = new Vector3()): Vector3 {
  const name = label.toLowerCase();
  if (name.includes("saturn")) {
    const toCamera = LEVELS.deep_space.cameraOffset.clone().normalize();
    return out.copy(SATURN.center).addScaledVector(toCamera, SATURN.radius * 1.02);
  }
  if (name.includes("asteroid")) return out.copy(BELT_CENTER);
  const angle = index * 2.4;
  return out.copy(DEEP_CENTER).add(new Vector3(Math.cos(angle), Math.sin(angle) * 0.6, 0).multiplyScalar(0.6 + 0.15 * index));
}
