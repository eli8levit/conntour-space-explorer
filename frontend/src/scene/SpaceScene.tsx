// "Where in space": the scene and its HTML controls. State lives here; the 3D
// parts (Bodies, MarkerLayer, CameraRig) only draw what they are given.
import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { type MutableRefObject, type PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { type Camera, Vector3 } from "three";
import type { PlaceRow } from "../api/types";
import { Bodies } from "./Bodies";
import { CameraRig } from "./CameraRig";
import { fanRadiusDeg } from "./cluster";
import type { Pose } from "./flight";
import { fitDistance } from "./geo";
import {
  BELT_CENTER,
  EARTH,
  homeSphere,
  type Level,
  LEVEL_ORDER,
  LEVELS,
  MARS,
  MOON,
  neighborhood,
  RINGS,
  ringPoint,
  SATURN,
} from "./layout";
import { MarkerLayer } from "./MarkerLayer";
import {
  buildMarkers,
  fanSpacing,
  type Group,
  groupRows,
  mainLabel,
  type Marker,
  positionOf,
  surfacePosition,
  type Tier,
  tierOf,
} from "./markers";
import { type FrameListener, type Label, Overlay } from "./Overlay";
import { ClusterCard, PinCard } from "./PinCard";
import { nearestPoint, toScreen } from "./screen";
import { cssColor, readPalette } from "./tokens";
import { useReducedMotion } from "./useReducedMotion";
import { YearRail } from "./YearRail";
import { inYearRange, yearBounds, type YearRange } from "./years";

const FOV = 40;

export interface SceneSearch {
  query: string;
  /** source_id → confidence (0–1) for every result of the stored search. */
  confidences: Map<number, number>;
}

interface SpaceSceneProps {
  rows: PlaceRow[];
  search: SceneSearch | null;
  onClearSearch: () => void;
  /** The active pin's source_id. It lives in the URL (?focus=) so a link opens it. */
  focusId: number | null;
  onFocus: (id: number | null) => void;
}

/** Runs last in every frame: hands the fresh camera to the HTML labels and to picking. */
function FrameBridge({ listener }: { listener: MutableRefObject<FrameListener> }) {
  useFrame(({ camera, size }) => {
    camera.updateMatrixWorld(); // labels must use this frame's camera, not the last one
    listener.current(camera, size.width, size.height);
  });
  return null;
}

/** Camera above a spot on a sphere, looking at the sphere's center (so dragging turns the globe). */
function poseAbove(center: Vector3, spot: Vector3, distance: number): Pose {
  const direction = spot.clone().sub(center).normalize();
  return { target: center.clone(), position: center.clone().addScaledVector(direction, distance) };
}

/** Far enough to see a whole fanned-out cluster, with room for the card. */
function fanDistance(group: Group, aspect: number): number {
  const sphere = homeSphere(group.body) ?? EARTH;
  const radians = (fanRadiusDeg(group.rows.length, fanSpacing(group.body)) * Math.PI) / 180;
  return sphere.radius + fitDistance(2 * sphere.radius * Math.sin(radians) * 1.6, FOV, aspect);
}

/** Where the ring names sit: the point of each ring nearest the orbit camera, nudged sideways. */
function ringLabelPoint(ring: (typeof RINGS)[keyof typeof RINGS]): Vector3 {
  const camera = LEVELS.orbit.cameraOffset.clone().normalize();
  const right = new Vector3().crossVectors(new Vector3(0, 1, 0), camera).normalize();
  let best = new Vector3();
  let bestScore = -Infinity;
  for (let i = 0; i < 72; i++) {
    const p = ringPoint(ring, (i / 72) * Math.PI * 2);
    const score = p.dot(camera) + 0.8 * p.dot(right);
    if (score > bestScore) [best, bestScore] = [p, score];
  }
  return best;
}

function countColor(tier: Tier): string {
  if (tier === "strong") return cssColor("accent-text");
  if (tier === "dim") return cssColor("faint", 0.4);
  return cssColor("fg");
}

/** Names of the bodies themselves, placed once. */
const BODY_LABELS: { key: string; level: Level; text: string; at: Vector3 }[] = [
  { key: "b-earth", level: "earth", text: "Earth", at: new Vector3(0, EARTH.radius + 0.12, 0) },
  { key: "b-iss", level: "earth", text: RINGS.iss.label, at: ringLabelPoint(RINGS.iss) },
  { key: "b-shuttle", level: "earth", text: RINGS.shuttle.label, at: ringLabelPoint(RINGS.shuttle) },
  { key: "b-moon", level: "moon", text: "Moon", at: MOON.center.clone().add(new Vector3(0, MOON.radius + 0.06, 0)) },
  { key: "b-mars", level: "mars", text: "Mars", at: MARS.center.clone().add(new Vector3(0, MARS.radius + 0.08, 0)) },
  { key: "b-saturn", level: "deep_space", text: "Saturn", at: SATURN.center.clone().add(new Vector3(0, SATURN.radius + 0.35, 0)) },
  { key: "b-belt", level: "deep_space", text: "Asteroid belt", at: BELT_CENTER.clone().add(new Vector3(0.25, 0.32, 0)) },
];

export function SpaceScene({ rows, search, onClearSearch, focusId, onFocus }: SpaceSceneProps) {
  const reducedMotion = useReducedMotion();
  const palette = useMemo(readPalette, []);
  const confidences = search?.confidences ?? null;

  const focusRow = rows.find((r) => r.source_id === focusId) ?? null;
  const [level, setLevel] = useState<Level>(focusRow?.body ?? "earth");
  const [range, setRange] = useState<YearRange | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [levelVisits, setLevelVisits] = useState(0); // re-fly when the same level is clicked again

  // Mutable, per-frame values: kept out of React state so the scene does not re-render 60 times a second.
  const phase = useRef(0);
  const live = useRef<{ camera: Camera; width: number; height: number } | null>(null);
  const overlayListener = useRef<FrameListener | null>(null);
  const frameListener = useRef<FrameListener>((camera, width, height) => {
    live.current = { camera, width, height };
    overlayListener.current?.(camera, width, height);
  });

  const bounds = useMemo(() => yearBounds(rows.map((r) => r.date_created)), [rows]);
  const visibleRows = useMemo(() => rows.filter((r) => inYearRange(r.date_created, range)), [rows, range]);
  const groups = useMemo(() => groupRows(visibleRows), [visibleRows]);
  const markers = useMemo(() => buildMarkers(groups, openKey, confidences), [groups, openKey, confidences]);
  const openGroup = groups.find((g) => g.key === openKey) ?? null;
  const selected = markers.find((m) => m.kind === "pin" && m.rows[0]?.source_id === focusId) ?? null;

  // A new focus (click or ?focus=): go to its level, and open its cluster if it is in one.
  useEffect(() => {
    if (!focusRow) return;
    setLevel(focusRow.body);
    const group = groups.find((g) => g.rows.includes(focusRow));
    setOpenKey(group && group.rows.length > 1 ? group.key : null);
  }, [focusRow, groups]);

  // Esc steps back: card → cluster → nothing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (focusId !== null) onFocus(null);
      else setOpenKey(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusId, onFocus]);

  // --- Where the camera should be --------------------------------------------
  const aspect = window.innerWidth / Math.max(1, window.innerHeight - 64);
  let pose: Pose;
  let poseKey: string;
  let limits = { min: LEVELS[level].minDistance, max: LEVELS[level].maxDistance };
  // What we are looking at: the active pin, or else the open cluster's center.
  const focus = selected
    ? { body: selected.body, spot: positionOf(selected, phase.current) }
    : openGroup && openGroup.lat !== null && openGroup.lon !== null
      ? { body: openGroup.body, spot: surfacePosition(openGroup.body, { lat: openGroup.lat, lon: openGroup.lon }) }
      : null;
  const sphere = focus ? homeSphere(focus.body) : null;
  if (focus && sphere) {
    const distance = openGroup ? fanDistance(openGroup, aspect) : focus.body === "orbit" ? 3.1 : sphere.radius * 2;
    pose = poseAbove(sphere.center, focus.spot, distance);
    poseKey = selected ? `pin:${selected.key}` : `cluster:${openKey}`;
  } else if (focus) {
    // Deep space has no planet to turn: look at the object itself from the level's usual angle.
    pose = { target: focus.spot.clone(), position: focus.spot.clone().addScaledVector(LEVELS.deep_space.cameraOffset, 0.4) };
    poseKey = `pin:${selected?.key}`;
    limits = { min: 0.3, max: 9 };
  } else {
    const spec = LEVELS[level];
    pose = { target: spec.center.clone(), position: spec.center.clone().add(spec.cameraOffset) };
    poseKey = `level:${level}:${levelVisits}`;
  }

  // --- Picking: the nearest visible marker on screen ----------------------------
  const pointerDown = useRef<{ x: number; y: number } | null>(null);
  const pick = (e: PointerEvent): Marker | null => {
    const frame = live.current;
    if (!frame) return null;
    const rect = e.currentTarget.getBoundingClientRect();
    const points = markers.map((m) =>
      toScreen(positionOf(m, phase.current), frame.camera, frame.width, frame.height, homeSphere(m.body)),
    );
    const index = nearestPoint(points, e.clientX - rect.left, e.clientY - rect.top, e.pointerType === "touch" ? 24 : 12);
    return markers[index] ?? null;
  };
  const onPointerUp = (e: PointerEvent) => {
    const start = pointerDown.current;
    pointerDown.current = null;
    if (!start || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 5) return; // that was a drag
    const hit = pick(e);
    if (hit?.kind === "cluster") {
      onFocus(null);
      setOpenKey(hit.key);
    } else if (hit) {
      onFocus(hit.rows[0]!.source_id);
    } else if (focusId !== null) {
      onFocus(null); // a click on empty space closes the card...
    } else {
      setOpenKey(null); // ...and then the fan
    }
  };
  const onPointerMove = (e: PointerEvent) => {
    if (e.buttons) return;
    setHoverKey(pick(e)?.key ?? null);
  };

  const goToLevel = (next: Level) => {
    onFocus(null);
    setOpenKey(null);
    setLevel(next);
    setLevelVisits((n) => n + 1);
  };

  // --- Labels: sparse. Body names, cluster counts, Mars feature names, the active outline, the hover tip.
  const labels = useMemo(() => {
    const here = neighborhood(level);
    const anchorOf = (m: Marker) => (out: Vector3) => positionOf(m, phase.current, out);
    const list: Label[] = BODY_LABELS.filter((b) => b.level === here).map((b) => ({
      key: b.key,
      anchor: (out: Vector3) => out.copy(b.at),
      occluder: null,
      content: b.text,
      className: "text-[12px] text-faint",
    }));
    for (const m of markers) {
      if (neighborhood(m.body) !== here) continue;
      if (m.kind === "cluster") {
        list.push({
          key: `n-${m.key}`,
          anchor: anchorOf(m),
          occluder: homeSphere(m.body),
          // The count takes its best member's color: orange means a strong match inside.
          content: <span style={{ color: countColor(m.tier) }}>{m.rows.length}</span>,
          className: "text-[12px]",
        });
      } else if ((m.body === "mars" || m.body === "moon") && !m.trueSpot) {
        list.push({ key: `n-${m.key}`, anchor: anchorOf(m), occluder: homeSphere(m.body), content: m.rows[0]!.label, className: "text-[12px] text-muted" });
      }
    }
    if (selected) {
      list.push({
        key: "active",
        anchor: anchorOf(selected),
        occluder: homeSphere(selected.body),
        content: <span className="block h-[13px] w-[13px] border border-fg" />,
        align: "center",
      });
    }
    const hovered = markers.find((m) => m.key === hoverKey);
    if (hovered && hovered !== selected) {
      const row = hovered.rows[0]!;
      list.push({
        key: "hover",
        anchor: anchorOf(hovered),
        occluder: homeSphere(hovered.body),
        content:
          hovered.kind === "cluster"
            ? `${hovered.rows.length} images · ${mainLabel(hovered.rows)}`
            : `${row.title.length > 52 ? `${row.title.slice(0, 50)}…` : row.title} · ${row.date_created.slice(0, 4)}`,
        className: "bg-bg/80 px-2 py-1 text-[12px] text-fg",
      });
    }
    return list;
  }, [markers, level, selected, hoverKey]);

  // --- Counts and the search legend ---------------------------------------------
  const countOf = (body: Level) => visibleRows.filter((r) => r.body === body).length;
  const levels = LEVEL_ORDER.filter((l) => l !== "moon" || rows.some((r) => r.body === "moon"));
  const results = confidences ? [...confidences.values()] : [];
  const strongCount = results.filter((c) => c >= 0.5).length;

  const card = focusRow ? (
    <PinCard
      row={focusRow}
      confidence={confidences?.get(focusRow.source_id)}
      onClose={() => onFocus(null)}
      onBack={openGroup?.rows.includes(focusRow) ? () => onFocus(null) : undefined}
    />
  ) : openGroup ? (
    <ClusterCard
      rows={openGroup.rows}
      confidences={confidences}
      palette={palette}
      onPick={(row) => onFocus(row.source_id)}
      onClose={() => setOpenKey(null)}
    />
  ) : null;

  return (
    <>
      <div
        className="absolute inset-0"
        style={{ cursor: hoverKey ? "pointer" : "grab" }}
        onPointerDown={(e) => (pointerDown.current = { x: e.clientX, y: e.clientY })}
        onPointerUp={onPointerUp}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setHoverKey(null)}
      >
        <Canvas
          frameloop="demand" // draw only when something changes: a flight, a drag, the orbit drift
          flat // no tone mapping: the token colors come out exactly as written
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true }}
          camera={{ fov: FOV, near: 0.01, far: 200, position: LEVELS.earth.cameraOffset.clone().multiplyScalar(1.7).toArray() }}
          aria-label="3D map of where each image was taken"
        >
          <Bodies palette={palette} rows={rows} showMoon={levels.includes("moon")} />
          <MarkerLayer
            markers={markers}
            palette={palette}
            selectedKey={selected?.key ?? null}
            hoverKey={hoverKey}
            phase={phase}
            drifting={!reducedMotion && level === "orbit" && focusId === null}
          />
          <OrbitControls makeDefault enablePan={false} enableDamping={!reducedMotion} rotateSpeed={0.5} zoomSpeed={0.7} />
          <CameraRig pose={pose} poseKey={poseKey} limits={limits} reducedMotion={reducedMotion} />
          <FrameBridge listener={frameListener} />
        </Canvas>
        <Overlay labels={labels} register={overlayListener} />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-start justify-between gap-x-6 gap-y-2 px-4 pt-4 sm:px-8">
        <nav aria-label="Levels" className="pointer-events-auto flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
          {levels.map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={l === level}
              onClick={() => goToLevel(l)}
              className={l === level ? "text-fg" : "text-muted hover:text-fg"}
            >
              {LEVELS[l].name} <span className={l === level ? "text-muted" : "text-faint"}>{countOf(l)}</span>
            </button>
          ))}
        </nav>
        <div className="pointer-events-auto ml-auto flex flex-col items-end gap-1 text-[12px]">
          {search ? (
            <p className="flex flex-wrap items-center justify-end gap-x-2">
              <span className="text-fg">{search.query}:</span>
              <span className="inline-block h-[6px] w-[6px]" style={{ background: cssColor("accent") }} />
              <span className="text-muted">{strongCount} strong,</span>
              <span className="inline-block h-[6px] w-[6px]" style={{ background: cssColor("fg") }} />
              <span className="text-muted">{results.length - strongCount} faint</span>
              <button type="button" onClick={onClearSearch} className="ml-2 text-faint hover:text-fg">
                Clear
              </button>
            </p>
          ) : null}
          <p className="hidden text-faint sm:block">Not to scale. Drag to turn, scroll to zoom.</p>
        </div>
      </div>

      <YearRail
        rows={rows}
        bounds={bounds}
        range={range}
        onChange={setRange}
        tierOf={(row) => tierOf(row.source_id, confidences)}
        selectedId={focusId}
      />

      {card}
    </>
  );
}
