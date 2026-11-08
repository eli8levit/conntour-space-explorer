// Small geometry helpers for the scene. Pure functions, unit-tested in geo.test.ts.
import { Vector3 } from "three";

const DEG = Math.PI / 180;

/**
 * Latitude/longitude (degrees) to a point on a sphere of `radius` around the origin.
 * Axes: y is north, lon 0 faces +z (toward the default camera), east is +x.
 * The same formula the A3 LocatorMini uses, so the modal and the scene agree.
 */
export function latLonToVector(lat: number, lon: number, radius = 1, out = new Vector3()): Vector3 {
  const phi = lat * DEG;
  const lambda = lon * DEG;
  return out.set(
    radius * Math.cos(phi) * Math.sin(lambda),
    radius * Math.sin(phi),
    radius * Math.cos(phi) * Math.cos(lambda),
  );
}

/** Great-circle angle between two lat/lon points, in degrees (haversine: stable for small angles). */
export function angularDistanceDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = (lat2 - lat1) * DEG;
  const dLon = (lon2 - lon1) * DEG;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.sin(dLon / 2) ** 2;
  return (2 * Math.asin(Math.min(1, Math.sqrt(h)))) / DEG;
}

/**
 * True when the straight line from the camera to `point` passes through the sphere.
 * Used so hover, click and labels ignore pins on the far side of a planet,
 * exactly like the depth buffer hides them on screen.
 */
export function occludedBySphere(camera: Vector3, point: Vector3, center: Vector3, radius: number): boolean {
  const dir = new Vector3().subVectors(point, camera);
  const length = dir.length();
  dir.divideScalar(length);
  // Closest approach of the ray to the sphere center.
  const toCenter = new Vector3().subVectors(center, camera);
  const along = toCenter.dot(dir);
  if (along < 0) return false; // the sphere is behind the camera
  const missSq = toCenter.lengthSq() - along * along;
  if (missSq > radius * radius) return false; // the ray misses the sphere
  const entry = along - Math.sqrt(radius * radius - missSq);
  return entry > 0 && entry < length; // the ray enters the sphere before it reaches the point
}

/**
 * How far the camera must be from a thing `span` wide to fit it on screen.
 * On a portrait phone the horizontal field of view is the narrow one, so we divide by the aspect.
 */
export function fitDistance(span: number, fovDeg: number, aspect: number): number {
  const half = span / 2 / Math.tan((fovDeg * DEG) / 2);
  return half / Math.min(1, aspect);
}
