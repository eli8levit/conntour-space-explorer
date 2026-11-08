// Flies the camera to a new pose whenever `poseKey` changes (a level button,
// a pin click, ?focus=). OrbitControls owns the camera the rest of the time.
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { easeInOutCubic, flyPose, type Pose } from "./flight";

interface Flight {
  from: Pose;
  to: Pose;
  start: number;
  duration: number; // ms
}

interface CameraRigProps {
  pose: Pose;
  /** A new key starts a new flight. (Comparing poses by value would restart flights on every render.) */
  poseKey: string;
  /** Zoom limits for where we arrive, as distances from the target. */
  limits: { min: number; max: number };
  reducedMotion: boolean;
}

export function CameraRig({ pose, poseKey, limits, reducedMotion }: CameraRigProps) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const invalidate = useThree((s) => s.invalidate);
  const flight = useRef<Flight | null>(null);
  const current = useRef<Pose>({ target: new Vector3(), position: new Vector3() });

  useEffect(() => {
    if (!controls) return;
    const from = { target: controls.target.clone(), position: camera.position.clone() };
    const travel = from.target.distanceTo(pose.target);
    // Reduced motion: no flight, the camera is simply there.
    const duration = reducedMotion ? 0 : travel > 0.5 ? 1800 : 1100;
    flight.current = { from, to: { target: pose.target.clone(), position: pose.position.clone() }, start: performance.now(), duration };
    // During a flight the distance to the target passes through values outside the
    // destination's zoom limits; OrbitControls would clamp them and the camera would jerk.
    controls.minDistance = 0;
    controls.maxDistance = Infinity;
    invalidate();
    // Only the key starts a flight: `pose` is a new object on every render.
  }, [poseKey, controls]);

  // Grabbing the globe mid-flight stops the flight where it is: the user wins.
  useEffect(() => {
    if (!controls) return;
    const stop = () => {
      if (!flight.current) return;
      flight.current = null;
      controls.minDistance = limits.min;
      controls.maxDistance = limits.max;
    };
    controls.addEventListener("start", stop);
    return () => controls.removeEventListener("start", stop);
  }, [controls, limits]);

  useFrame(() => {
    const f = flight.current;
    if (!f || !controls) return;
    const t = f.duration === 0 ? 1 : Math.min(1, (performance.now() - f.start) / f.duration);
    flyPose(f.from, f.to, easeInOutCubic(t), current.current);
    controls.target.copy(current.current.target);
    camera.position.copy(current.current.position);
    camera.lookAt(controls.target);
    if (t < 1) {
      invalidate(); // keep drawing until we arrive (the canvas draws on demand)
    } else {
      flight.current = null;
      controls.minDistance = limits.min;
      controls.maxDistance = limits.max;
      controls.update();
    }
  });

  return null;
}
