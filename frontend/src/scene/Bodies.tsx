// The line-art bodies: Earth, the orbit rings, the Moon, Mars and deep space.
// Static geometry, built once. Everything here is thin grey lines; only the
// pins (MarkerLayer) and the active pin's outline are bright.
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { type Group, Vector3 } from "three";
import type { PlaceRow } from "../api/types";
import { BELT_CENTER, EARTH, MARS, MOON, RINGS, SATURN, type Sphere } from "./layout";
import { circleOnSphere, coastlines, flatCircle, graticule } from "./lines";
import type { Palette } from "./tokens";

interface LinesProps {
  positions: Float32Array;
  color: Palette[keyof Palette];
  opacity?: number;
}

/** A batch of 1px line segments in one draw call. */
function Lines({ positions, color, opacity = 1 }: LinesProps) {
  return (
    <lineSegments>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color={color} transparent={opacity < 1} opacity={opacity} depthWrite={false} />
    </lineSegments>
  );
}

/**
 * A sphere filled with the page background. It is invisible against the page,
 * but it writes depth, so lines and pins on the far side of a planet are hidden.
 * That turns a wire ball into a readable globe.
 */
function Occluder({ radius, color }: { radius: number; color: Palette[keyof Palette] }) {
  return (
    <mesh>
      <sphereGeometry args={[radius * 0.995, 64, 32]} />
      <meshBasicMaterial color={color} />
    </mesh>
  );
}

const UNIT_CIRCLE = flatCircle(1, 128);

/**
 * The planet's outline as seen from the camera. For a sphere seen in perspective,
 * the visible edge is a circle slightly smaller than the radius and nearer the camera;
 * we move and turn one unit circle to match it every frame.
 */
function Limb({ sphere, color }: { sphere: Sphere; color: Palette[keyof Palette] }) {
  const group = useRef<Group>(null);
  const toCamera = useMemo(() => new Vector3(), []);
  useFrame(({ camera }) => {
    if (!group.current) return;
    toCamera.subVectors(camera.position, sphere.center);
    const d = toCamera.length();
    const r = sphere.radius;
    if (d <= r) return;
    group.current.position.copy(sphere.center).addScaledVector(toCamera, (r * r) / (d * d));
    group.current.scale.setScalar(r * Math.sqrt(1 - (r * r) / (d * d)));
    group.current.lookAt(camera.position);
  });
  return (
    <group ref={group}>
      {/* flatCircle lies in XZ; turn it to XY so it faces the camera after lookAt. */}
      <group rotation={[Math.PI / 2, 0, 0]}>
        <Lines positions={UNIT_CIRCLE} color={color} />
      </group>
    </group>
  );
}

function Planet({ sphere, palette, step, children }: { sphere: Sphere; palette: Palette; step: number; children?: React.ReactNode }) {
  const grid = useMemo(() => graticule(sphere.radius * 1.001, step), [sphere.radius, step]);
  return (
    <>
      <group position={sphere.center}>
        <Occluder radius={sphere.radius} color={palette.bg} />
        <Lines positions={grid} color={palette.line} />
        {children}
      </group>
      <Limb sphere={sphere} color={palette["line-strong"]} />
    </>
  );
}

function Earth({ palette }: { palette: Palette }) {
  const coast = useMemo(() => coastlines(EARTH.radius * 1.002), []);
  return (
    <Planet sphere={EARTH} palette={palette} step={15}>
      <Lines positions={coast} color={palette.faint} opacity={0.55} />
    </Planet>
  );
}

function OrbitRings({ palette }: { palette: Palette }) {
  return (
    <>
      {Object.values(RINGS).map((ring) => (
        // Same rotation as ringPoint(): tilt around x first, then turn around y ('YXZ' order).
        <group key={ring.label} rotation={[(ring.inclinationDeg * Math.PI) / 180, (ring.nodeDeg * Math.PI) / 180, 0, "YXZ"]}>
          <Lines positions={flatCircle(ring.radius, 192)} color={palette["line-strong"]} />
        </group>
      ))}
    </>
  );
}

/** Mars: a graticule plus a small circle around each named feature that has photos. */
function Mars({ palette, rows }: { palette: Palette; rows: PlaceRow[] }) {
  const features = useMemo(() => {
    const parts = rows
      .filter((r) => r.body === "mars" && r.lat !== null && r.lon !== null)
      .map((r) => Array.from(circleOnSphere(r.lat as number, r.lon as number, 4, MARS.radius * 1.003)));
    return new Float32Array(parts.flat());
  }, [rows]);
  return (
    <Planet sphere={MARS} palette={palette} step={30}>
      {features.length > 0 && <Lines positions={features} color={palette.faint} opacity={0.7} />}
    </Planet>
  );
}

/** A tiny seeded random generator, so the asteroid belt looks the same on every load. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function DeepSpace({ palette }: { palette: Palette }) {
  // Saturn: parallels only (they read as its cloud bands), plus three ring lines.
  const bands = useMemo(() => graticule(SATURN.radius * 1.001, 20, false), []);
  // The belt: a short, loose arc of dust.
  const belt = useMemo(() => {
    const random = seeded(7);
    const points: number[] = [];
    for (let i = 0; i < 260; i++) {
      const angle = (random() - 0.5) * 0.9; // a slice of a big circle, curving across the view
      const radius = 2 + (random() - 0.5) * 0.3;
      points.push(
        BELT_CENTER.x + radius * Math.sin(angle),
        BELT_CENTER.y + radius * (Math.cos(angle) - 1) * 0.6 + (random() - 0.5) * 0.08,
        BELT_CENTER.z + (random() - 0.5) * 0.3,
      );
    }
    return new Float32Array(points);
  }, []);
  return (
    <>
      <group position={SATURN.center}>
        <Occluder radius={SATURN.radius} color={palette.bg} />
        <Lines positions={bands} color={palette.line} />
        <group rotation={[0.47, 0, 0.12]}>
          {[1.35, 1.6, 1.95].map((r) => (
            <Lines key={r} positions={flatCircle(SATURN.radius * r, 160)} color={palette["line-strong"]} />
          ))}
        </group>
      </group>
      <Limb sphere={SATURN} color={palette["line-strong"]} />
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[belt, 3]} />
        </bufferGeometry>
        <pointsMaterial size={1.5} sizeAttenuation={false} color={palette.faint} transparent opacity={0.6} />
      </points>
    </>
  );
}

export function Bodies({ palette, rows, showMoon }: { palette: Palette; rows: PlaceRow[]; showMoon: boolean }) {
  return (
    <>
      <Earth palette={palette} />
      <OrbitRings palette={palette} />
      {showMoon && <Planet sphere={MOON} palette={palette} step={30} />}
      <Mars palette={palette} rows={rows} />
      <DeepSpace palette={palette} />
    </>
  );
}
