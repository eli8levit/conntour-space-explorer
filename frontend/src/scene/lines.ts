// Line art for the bodies, as flat arrays of segment pairs [x1,y1,z1, x2,y2,z2, ...].
// Each array becomes ONE THREE.LineSegments, so all of Earth's coastlines are a
// single draw call. WebGL draws these lines 1px wide, which is the thin look we want.
import { mesh } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
// Natural Earth land outlines at 1:110m (55 KB), bundled: no tile or texture server.
import land from "world-atlas/land-110m.json";
import { Vector3 } from "three";
import { latLonToVector } from "./geo";

type Segments = number[];

function pushPath(out: Segments, points: Vector3[]) {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1] as Vector3;
    const b = points[i] as Vector3;
    out.push(a.x, a.y, a.z, b.x, b.y, b.z);
  }
}

/** Parallels and (optionally) meridians every `stepDeg`, sampled every 3° so they curve with the sphere. */
export function graticule(radius: number, stepDeg = 15, meridians = true): Float32Array {
  const out: Segments = [];
  for (let lat = -90 + stepDeg; lat < 90; lat += stepDeg) {
    const ring: Vector3[] = [];
    for (let lon = -180; lon <= 180; lon += 3) ring.push(latLonToVector(lat, lon, radius));
    pushPath(out, ring);
  }
  for (let lon = -180; meridians && lon < 180; lon += stepDeg) {
    const meridian: Vector3[] = [];
    for (let lat = -90; lat <= 90; lat += 3) meridian.push(latLonToVector(lat, lon, radius));
    pushPath(out, meridian);
  }
  return new Float32Array(out);
}

/** Earth's coastlines: topojson `mesh` gives every land border once, as polylines of [lon, lat]. */
export function coastlines(radius: number): Float32Array {
  const topology = land as unknown as Topology<{ land: GeometryCollection }>;
  const lines = mesh(topology, topology.objects.land);
  const out: Segments = [];
  for (const line of lines.coordinates) {
    pushPath(out, line.map(([lon, lat]) => latLonToVector(lat as number, lon as number, radius)));
  }
  return new Float32Array(out);
}

/** A small circle drawn on a sphere around a point (the named features on Mars). */
export function circleOnSphere(lat: number, lon: number, angularRadiusDeg: number, radius: number, steps = 32): Float32Array {
  const center = latLonToVector(lat, lon, 1);
  // Two directions along the surface at that point: east and north.
  const east = new Vector3(0, 1, 0).cross(center).normalize();
  if (east.lengthSq() < 1e-6) east.set(1, 0, 0); // at a pole, any direction is "east"
  const north = new Vector3().crossVectors(center, east);
  const a = (angularRadiusDeg * Math.PI) / 180;
  const points = Array.from({ length: steps + 1 }, (_, i) => {
    const t = (2 * Math.PI * i) / steps;
    return center
      .clone()
      .multiplyScalar(Math.cos(a))
      .addScaledVector(east, Math.sin(a) * Math.cos(t))
      .addScaledVector(north, Math.sin(a) * Math.sin(t))
      .multiplyScalar(radius);
  });
  const out: Segments = [];
  pushPath(out, points);
  return new Float32Array(out);
}

/** A flat circle as segments, in the XZ plane (rings, orbits). Rotate it with its parent group. */
export function flatCircle(radius: number, steps = 128): Float32Array {
  const points = Array.from({ length: steps + 1 }, (_, i) => {
    const t = (2 * Math.PI * i) / steps;
    return new Vector3(radius * Math.cos(t), 0, radius * Math.sin(t));
  });
  const out: Segments = [];
  pushPath(out, points);
  return new Float32Array(out);
}
