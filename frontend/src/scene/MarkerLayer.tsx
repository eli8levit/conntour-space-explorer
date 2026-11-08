// All pins in a handful of draw calls. 100 photos as 100 meshes would be 100
// draw calls; instead every pin is one vertex of a THREE.Points cloud (WebGL draws
// each point as a small screen-aligned square, exactly the "small square" pin we want).
// One cloud for pins, one for cluster markers, one line batch for fan-out leaders.
import { useFrame, useThree } from "@react-three/fiber";
import { type MutableRefObject, useEffect, useMemo } from "react";
import { BufferAttribute, BufferGeometry, type Color, Vector3 } from "three";
import { type Marker, positionOf, surfacePosition, type Tier } from "./markers";
import { mix, type Palette } from "./tokens";

/** Radians per second: one lap of the ring in about 4 minutes. Calm, not busy. */
const DRIFT_SPEED = 0.025;

export function tierColor(tier: Tier, palette: Palette): Color {
  if (tier === "strong") return palette.accent;
  if (tier === "faint") return palette.fg;
  if (tier === "dim") return mix(palette.bg, palette.muted, 0.16); // "set aside", like the 16% grey on A2
  return palette.muted;
}

/** The active pin is orange (its white outline is drawn by the HTML overlay); a hovered one turns white. */
function markerColor(m: Marker, selectedKey: string | null, hoverKey: string | null, palette: Palette): Color {
  if (m.key === selectedKey) return palette.accent;
  if (m.key === hoverKey) return palette.fg;
  return tierColor(m.tier, palette);
}

function pointCloud(markers: Marker[], phase: number, colorOf: (m: Marker) => Color): BufferGeometry {
  const positions = new Float32Array(markers.length * 3);
  const colors = new Float32Array(markers.length * 3);
  const p = new Vector3();
  markers.forEach((marker, i) => {
    positionOf(marker, phase, p).toArray(positions, i * 3);
    colorOf(marker).toArray(colors, i * 3);
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  return geometry;
}

interface MarkerLayerProps {
  markers: Marker[];
  palette: Palette;
  selectedKey: string | null;
  hoverKey: string | null;
  /** The orbit drift angle, shared with picking and labels so they agree with what is drawn. */
  phase: MutableRefObject<number>;
  drifting: boolean;
}

export function MarkerLayer({ markers, palette, selectedKey, hoverKey, phase, drifting }: MarkerLayerProps) {
  const invalidate = useThree((s) => s.invalidate);
  const pins = useMemo(() => markers.filter((m) => m.kind === "pin"), [markers]);
  const clusters = useMemo(() => markers.filter((m) => m.kind === "cluster"), [markers]);

  // Rebuilt only when the markers or their colors change (a click, a hover, a filter), not per frame.
  const pinGeometry = useMemo(
    () => pointCloud(pins, phase.current, (m) => markerColor(m, selectedKey, hoverKey, palette)),
    [pins, selectedKey, hoverKey, palette, phase],
  );
  const clusterGeometry = useMemo(
    () => pointCloud(clusters, 0, (m) => markerColor(m, selectedKey, hoverKey, palette)),
    [clusters, selectedKey, hoverKey, palette],
  );

  // Fanned-out pins get a thin line back to where they really are.
  const leaders = useMemo(() => {
    const fanned = pins.filter((m) => m.trueSpot);
    const positions = new Float32Array(fanned.length * 6);
    const a = new Vector3();
    const b = new Vector3();
    fanned.forEach((m, i) => {
      surfacePosition(m.body, m.trueSpot!, a).toArray(positions, i * 6);
      positionOf(m, 0, b).toArray(positions, i * 6 + 3);
    });
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    return geometry;
  }, [pins]);

  // Free GPU memory when a geometry is replaced.
  useEffect(() => () => pinGeometry.dispose(), [pinGeometry]);
  useEffect(() => () => clusterGeometry.dispose(), [clusterGeometry]);
  useEffect(() => () => leaders.dispose(), [leaders]);
  // A new geometry needs one new frame (the canvas only draws on demand).
  useEffect(() => invalidate(), [pinGeometry, clusterGeometry, leaders, invalidate]);

  // The orbit drift: move only the orbit pins, in place, and ask for the next frame.
  const p = useMemo(() => new Vector3(), []);
  useFrame((_, delta) => {
    if (!drifting) return;
    phase.current += Math.min(delta, 0.1) * DRIFT_SPEED;
    const attribute = pinGeometry.getAttribute("position") as BufferAttribute;
    pins.forEach((m, i) => {
      if ("orbit" in m.at) positionOf(m, phase.current, p).toArray(attribute.array, i * 3);
    });
    attribute.needsUpdate = true;
    invalidate();
  });

  return (
    <>
      <points geometry={pinGeometry}>
        <pointsMaterial size={5} sizeAttenuation={false} vertexColors />
      </points>
      <points geometry={clusterGeometry}>
        <pointsMaterial size={9} sizeAttenuation={false} vertexColors />
      </points>
      <lineSegments geometry={leaders}>
        <lineBasicMaterial color={palette["line-strong"]} />
      </lineSegments>
    </>
  );
}
