// From 3D to screen pixels. Used by the HTML labels and by click/hover picking,
// so a label, a click target and the drawn pin always agree on where a pin is.
import { type Camera, Vector3 } from "three";
import { occludedBySphere } from "./geo";
import type { Sphere } from "./layout";

export interface ScreenPoint {
  x: number;
  y: number;
  /** False when the point is behind the camera or hidden behind its planet. */
  visible: boolean;
}

const ndc = new Vector3();

export function toScreen(world: Vector3, camera: Camera, width: number, height: number, occluder: Sphere | null): ScreenPoint {
  ndc.copy(world).project(camera);
  const inFront = ndc.z < 1 && ndc.z > -1;
  const hidden = occluder ? occludedBySphere(camera.position, world, occluder.center, occluder.radius) : false;
  return { x: ((ndc.x + 1) / 2) * width, y: ((1 - ndc.y) / 2) * height, visible: inFront && !hidden };
}

/** Index of the visible point nearest to (x, y) within `maxPx`, or -1. */
export function nearestPoint(points: ScreenPoint[], x: number, y: number, maxPx: number): number {
  let best = -1;
  let bestDistance = maxPx;
  points.forEach((p, i) => {
    if (!p.visible) return;
    const distance = Math.hypot(p.x - x, p.y - y);
    if (distance <= bestDistance) {
      best = i;
      bestDistance = distance;
    }
  });
  return best;
}
