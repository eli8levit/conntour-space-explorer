// Camera flights between levels and pins. Pure math, tested in flight.test.ts;
// CameraRig.tsx only calls it once per frame while a flight runs.
import { Vector3 } from "three";

export interface Pose {
  /** The point the camera looks at (and orbits around afterwards). */
  target: Vector3;
  position: Vector3;
}

/** Slow start, fast middle, slow stop: reads as a deliberate move, not a jump. */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/**
 * The camera pose at progress `t` (0..1, already eased) of a flight.
 * We move the target in a straight line and turn the camera's *offset from the
 * target* (direction and length separately). Turning the offset, instead of moving
 * the camera in a straight line, swings around a planet instead of through it.
 * A small pull-back in the middle (`lift`) shows where you are going.
 */
export function flyPose(from: Pose, to: Pose, t: number, out: Pose): Pose {
  out.target.lerpVectors(from.target, to.target, t);

  const fromOffset = new Vector3().subVectors(from.position, from.target);
  const toOffset = new Vector3().subVectors(to.position, to.target);
  const length = fromOffset.length() + (toOffset.length() - fromOffset.length()) * t;
  const direction = fromOffset.normalize().lerp(toOffset.normalize(), t);
  // Opposite directions would cancel out to zero: fall back to the destination's.
  if (direction.lengthSq() < 1e-6) direction.copy(toOffset);
  direction.normalize();

  const travels = from.target.distanceTo(to.target) > 0.01;
  const lift = 1 + (travels ? 0.45 : 0.15) * Math.sin(Math.PI * t);

  out.position.copy(out.target).addScaledVector(direction, length * lift);
  return out;
}
