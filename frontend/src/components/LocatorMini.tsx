import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { Place, PlaceRow } from "../api/types";
import { usePlaces } from "../hooks/places";
import { bodyLabel } from "../lib/format";
import { loadLandLines } from "../lib/landLines";
import { dotsPath, graticule, hemisphere, linesPath, project, smallCircle, type LonLat, type View } from "../lib/orthographic";

// A3·12: where the image was taken, drawn in the Space view's line art (thin
// outlines, a faint graticule, one orange pin) and dressed as an instrument
// readout: a dot grid, corner brackets, a crosshair on the pin, coordinates.
//
// Motion: the body zooms in while it turns the place to face you (1.1 s),
// then sways a few degrees (Earth orbit: the planet keeps turning). Every
// frame re-projects the lines into one path string per layer and writes it
// straight to the DOM: no React render per frame. Reduced motion: final pose.

const C = {
  bg: "#050506",
  dots: "#1A1A1E",
  grid: "#1F1F23", // graticule: `line`
  rule: "#2A2A2E", // crosshair, brackets: `line-strong`
  outline: "#3A3A40", // the limb, one step up so it reads on #050506
  coast: "#55555C", // coastlines sit between the grid and the text
  landmark: "#38383E", // Mars landmarks: between the grid and the outline
  other: "#6A6A72", // other photographed places
  text: "#A6A49E", // muted
  value: "#D6D4CE", // soft
  pin: "#FF5A1F", // accent: the one active thing
};

// Mars has no coastline data, so it gets its landmarks as faint outlines: the big basins, the
// volcanoes, Valles Marineris and the polar caps (approximate, for orientation only).
const MARS_LANDMARKS: LonLat[][] = [
  smallCircle([70.5, -42.4], 12), // Hellas Planitia
  smallCircle([-43.4, -49.7], 8), // Argyre Planitia
  smallCircle([87.0, 12.9], 7), // Isidis Planitia
  smallCircle([-133.8, 18.7], 4), // Olympus Mons
  smallCircle([-133.8, 18.7], 1.5),
  smallCircle([-120.1, -8.3], 2.5), // Arsia, Pavonis and Ascraeus Mons
  smallCircle([-112.9, 1.5], 2.5),
  smallCircle([-104.5, 11.9], 2.5),
  smallCircle([147.2, 25.0], 3), // Elysium Mons
  smallCircle([0, 90], 8), // the polar caps
  smallCircle([0, -90], 6),
  // Valles Marineris: two walls, about 3° apart, from Noctis Labyrinthus to Eos Chasma.
  [[-100, -5], [-90, -6], [-75, -8], [-60, -10], [-45, -12]],
  [[-100, -8], [-90, -9], [-75, -11], [-60, -13], [-45, -15]],
];

const INTRO = 1.1; // seconds
const SWAY = { degrees: 5, period: 12 };
const GRATICULE = graticule(30);
const easeOut = (t: number) => 1 - (1 - t) ** 3;

type Mode = "surface" | "orbit" | "deep";

/** The pose at `t` seconds: how far the body is still turned away, and its zoom. */
function pose(t: number) {
  const e = easeOut(Math.min(1, t / INTRO));
  const sway = t > INTRO ? SWAY.degrees * Math.sin((2 * Math.PI * (t - INTRO)) / SWAY.period) : 0;
  return { turn: 110 * (1 - e) + sway, scale: 0.6 + 0.4 * e, fade: e, settle: Math.min(1, Math.max(0, (t - 0.6) / 0.5)) };
}

export function LocatorMini({ place, sourceId }: { place: Place; sourceId: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const places = usePlaces().data;

  // The SVG is drawn at its real pixel size (not scaled from a viewBox), so the 10px readouts stay 10px.
  useLayoutEffect(() => {
    const element = box.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry!.contentRect.width)));
    observer.observe(element);
    setWidth(Math.round(element.getBoundingClientRect().width));
    return () => observer.disconnect();
  }, []);

  const height = Math.round(Math.min(248, Math.max(184, width * 0.46)));
  const mode: Mode = place.body === "orbit" ? "orbit" : place.body === "deep_space" ? "deep" : "surface";

  return (
    <div ref={box} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <Figure
          // A new image starts the intro again (the details column is keyed by image too).
          key={sourceId}
          place={place}
          sourceId={sourceId}
          mode={mode}
          width={width}
          height={height}
          others={places ?? []}
        />
      )}
    </div>
  );
}

interface FigureProps {
  place: Place;
  sourceId: number;
  mode: Mode;
  width: number;
  height: number;
  others: PlaceRow[];
}

function Figure({ place, sourceId, mode, width: W, height: H, others }: FigureProps) {
  const patternId = useId();
  const refs = useRef<Record<string, SVGElement | null>>({});
  const ref = (name: string) => (element: SVGElement | null) => {
    refs.current[name] = element;
  };
  const land = useRef<LonLat[][]>([]);
  const start = useRef(performance.now());

  const pin: LonLat | null = place.lat !== null && place.lon !== null ? [place.lon, place.lat] : null;
  const onEarth = place.body === "earth" || mode === "orbit";
  // Other photographed places on the same body: Earth sites as dots, Mars features as small rings.
  const sameBody = others.filter((row) => row.body === place.body && row.source_id !== sourceId && row.lat !== null && row.lon !== null);
  const otherDots: LonLat[] = place.body === "earth" ? sameBody.map((row) => [row.lon!, row.lat!]) : [];
  const otherRings: LonLat[][] = place.body !== "earth" ? sameBody.map((row) => smallCircle([row.lon!, row.lat!], 3)) : [];
  const pinLabel = shortLabel(place.label);
  const pinRing: LonLat[][] = pin && place.body !== "earth" ? [smallCircle(pin, 3)] : [];

  useEffect(() => {
    if (!onEarth) return;
    let live = true;
    void loadLandLines().then((lines) => {
      if (live) land.current = lines;
    });
    return () => {
      live = false;
    };
  }, [onEarth]);

  useEffect(() => {
    const el = refs.current;
    const set = (name: string, attrs: Record<string, string | number>) => {
      const node = el[name];
      if (node) for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    };

    const cx = W / 2;
    const cy = mode === "orbit" ? H / 2 : H / 2 + 4;
    const radius = mode === "orbit" ? H * 0.25 : H * 0.4;
    // Seen a little from the equator side: the pin sits above the centre, with more of the globe below it.
    const lat0 = pin ? pin[1] * 0.55 : 20;
    const lon0 = pin ? pin[0] : -75; // Earth orbit: start over the Americas, where most of these crews flew from

    function crosshair(x: number, y: number, gap: number) {
      return `M0 ${y}H${x - gap}M${x + gap} ${y}H${W}M${x} 0V${y - gap}M${x} ${y + gap}V${H}`;
    }

    function draw(t: number) {
      const p = pose(t);
      set("chrome", { opacity: p.fade });
      if (mode === "deep") {
        set("deep", { transform: `translate(${cx} ${cy - 6}) scale(${p.scale})` });
        set("sweep", { transform: `rotate(${(t * 6) % 360})` });
        set("cross", { opacity: p.settle });
        return;
      }
      // Earth orbit: the planet keeps turning under the station, about 4° a second.
      const spin = mode === "orbit" ? -t * 4 + 110 * (1 - easeOut(Math.min(1, t / INTRO))) : p.turn;
      const view: View = { lon0: lon0 + spin, lat0: mode === "orbit" ? 22 : lat0, cx, cy, r: radius * p.scale };
      set("limb", { r: view.r });
      set("disc", { r: view.r });
      set("grat", { d: linesPath(view, GRATICULE) });
      set("coast", { d: onEarth ? linesPath(view, land.current) : "" });
      set("others", { d: dotsPath(view, otherDots, 1.4) });
      set("rings", { d: linesPath(view, otherRings) });
      set("landmarks", { d: place.body === "mars" ? linesPath(view, MARS_LANDMARKS) : "" });

      let target: { x: number; y: number; visible: boolean } | null = null;
      if (mode === "orbit") {
        const rx = Math.min(W * 0.4, view.r * 3);
        const ry = rx * 0.2;
        const tilt = (-10 * Math.PI) / 180;
        const at = (a: number) => ({
          x: cx + rx * Math.cos(a) * Math.cos(tilt) - ry * Math.sin(a) * Math.sin(tilt),
          y: cy + rx * Math.cos(a) * Math.sin(tilt) + ry * Math.sin(a) * Math.cos(tilt),
        });
        // Two halves: the far one is drawn before the planet (which hides it), the near one after.
        const arc = (from: number, to: number) =>
          Array.from({ length: 49 }, (_, i) => at(from + ((to - from) * i) / 48))
            .map((q, i) => `${i ? "L" : "M"}${q.x.toFixed(1)} ${q.y.toFixed(1)}`)
            .join("");
        set("orbitBack", { d: arc(Math.PI, 2 * Math.PI) });
        set("orbitFront", { d: arc(0, Math.PI) });
        target = { ...at(0.16 * Math.PI), visible: true };
      } else if (pin) {
        target = project(view, pin);
        set("pinRing", { d: linesPath(view, pinRing) });
      }

      if (!target || !target.visible) {
        set("pin", { opacity: 0 });
        set("cross", { opacity: 0 });
        set("arc", { opacity: 0 });
        return;
      }
      set("pin", { opacity: 1, transform: `translate(${target.x.toFixed(1)} ${target.y.toFixed(1)})` });
      // The label goes on the side of the pin with more room, shortened to fit it (about 6 px per character).
      const rightRoom = W - target.x - 26;
      const leftRoom = target.x - 26;
      const flip = pinLabel.length * 6 > rightRoom && leftRoom > rightRoom;
      set("pinText", { x: flip ? -12 : 12, "text-anchor": flip ? "end" : "start" });
      const text = fitLabel(pinLabel, Math.floor((flip ? leftRoom : rightRoom) / 6));
      const node = el.pinText;
      if (node && node.textContent !== text) node.textContent = text;
      set("cross", { opacity: p.settle, d: crosshair(target.x, target.y, 11) });
      // Mars (or the Moon): the route home, a dashed arc from a small Earth in the corner to the pin.
      if (place.body !== "earth" && mode === "surface") {
        const ex = 34;
        const ey = H - 34;
        set("arc", { opacity: p.settle * 0.8, d: `M${ex + 8} ${ey - 6}Q${(ex + target.x) / 2} ${Math.min(ey, target.y) - 30} ${target.x - 8} ${target.y + 4}` });
      }
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      draw(INTRO);
      // Coastlines arrive after the first paint; draw once more when they do.
      const timer = window.setTimeout(() => draw(INTRO), 400);
      return () => window.clearTimeout(timer);
    }
    let frame = requestAnimationFrame(function tick(now) {
      draw((now - start.current) / 1000);
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
    // The geometry inputs are fixed for one image; a resize redraws at the new size and keeps the clock.
  }, [W, H, mode, others.length]);

  const bodyName = mode === "orbit" ? "EARTH ORBIT" : mode === "deep" ? "DEEP SPACE" : bodyLabel(place.body).toUpperCase();

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" className="block" style={{ fontVariantNumeric: "tabular-nums" }}>
      <defs>
        <pattern id={patternId} width={12} height={12} patternUnits="userSpaceOnUse">
          <circle cx={6} cy={6} r={0.7} fill={C.dots} />
        </pattern>
      </defs>
      <rect width={W} height={H} fill={C.bg} />
      <rect width={W} height={H} fill={`url(#${patternId})`} />

      <path ref={ref("cross")} fill="none" stroke={C.rule} strokeDasharray="2 3" opacity={0} />

      {mode === "deep" ? (
        <DeepSpace label={place.label} refFor={ref} />
      ) : (
        <g fill="none" strokeWidth={1}>
          {mode === "orbit" && <path ref={ref("orbitBack")} stroke={C.outline} />}
          {/* The disc is filled, so the far half of the orbit disappears behind the planet. */}
          <circle ref={ref("disc")} cx={W / 2} cy={mode === "orbit" ? H / 2 : H / 2 + 4} r={0} fill={C.bg} />
          <path ref={ref("grat")} stroke={C.grid} />
          <path ref={ref("coast")} stroke={C.coast} strokeLinejoin="round" />
          <path ref={ref("landmarks")} stroke={C.landmark} strokeLinejoin="round" />
          <path ref={ref("rings")} stroke={C.other} />
          <path ref={ref("others")} fill={C.other} stroke="none" />
          <circle ref={ref("limb")} cx={W / 2} cy={mode === "orbit" ? H / 2 : H / 2 + 4} r={0} stroke={C.outline} />
          <path ref={ref("pinRing")} stroke={C.pin} strokeOpacity={0.5} />
          {mode === "orbit" && <path ref={ref("orbitFront")} stroke={C.outline} />}
          {place.body !== "earth" && mode === "surface" && (
            <>
              <path ref={ref("arc")} stroke={C.pin} strokeDasharray="2 4" opacity={0} />
              <g transform={`translate(34 ${H - 34})`}>
                <circle r={7} stroke={C.outline} />
                <ellipse rx={3.5} ry={7} stroke={C.grid} />
                <line x1={-7} x2={7} stroke={C.grid} />
                <text y={21} textAnchor="middle" fill={C.text} fontSize={10} letterSpacing="0.08em" stroke="none">
                  EARTH
                </text>
              </g>
            </>
          )}
        </g>
      )}

      {mode !== "deep" && (
        <g ref={ref("pin")} opacity={0}>
          <circle r={6} fill="none" stroke={C.pin} strokeWidth={1.5} />
          <circle r={1.5} fill={C.pin} />
          <text
            ref={ref("pinText")}
            x={12}
            y={-9}
            fill={C.value}
            fontSize={11}
            stroke={C.bg}
            strokeWidth={3}
            paintOrder="stroke"
          >
            {pinLabel}
          </text>
        </g>
      )}

      <g ref={ref("chrome")} opacity={0} fontSize={10} letterSpacing="0.08em">
        <Brackets W={W} H={H} />
        <text x={14} y={22} fill={C.value}>
          {bodyName}
        </text>
        {pin && mode === "surface" ? (
          <>
            <text x={W - 14} y={22} textAnchor="end" fill={C.value}>
              {hemisphere(pin[1], "lat")}
            </text>
            <text x={W - 14} y={36} textAnchor="end" fill={C.value}>
              {hemisphere(pin[0], "lon")}
            </text>
          </>
        ) : (
          <text x={W - 14} y={22} textAnchor="end" fill={C.text}>
            {mode === "surface" ? "NO COORDINATES" : mode === "orbit" ? "NO GROUND POSITION" : "NO SURFACE"}
          </text>
        )}
        {/* On a phone-width box the two bottom readouts would touch; the grid note is the one to drop. */}
        {(place.body === "earth" || mode === "orbit") && W >= 420 && (
          <text x={14} y={H - 14} fill={C.text}>
            ORTHOGRAPHIC · 30° GRID
          </text>
        )}
        {mode === "surface" && sameBody.length > 0 && (
          <text x={W - 14} y={H - 14} textAnchor="end" fill={C.text}>
            {place.body === "earth" ? "•" : "○"} {sameBody.length} OTHER {sameBody.length === 1 ? "PHOTO" : "PHOTOS"}
          </text>
        )}
      </g>
    </svg>
  );
}

/** Instrument corners: four small L marks just inside the frame. */
function Brackets({ W, H }: { W: number; H: number }) {
  const s = 8;
  const i = 6;
  const d = `M${i} ${i + s}V${i}H${i + s}M${W - i - s} ${i}H${W - i}V${i + s}M${W - i} ${H - i - s}V${H - i}H${W - i - s}M${i + s} ${H - i}H${i}V${H - i - s}`;
  return <path d={d} fill="none" stroke={C.outline} />;
}

/** Deep space has no surface: a star field, range rings that slowly turn, and the target in the middle. */
function DeepSpace({ label, refFor }: { label: string; refFor: (name: string) => (element: SVGElement | null) => void }) {
  const saturn = /saturn/i.test(label);
  return (
    <>
      <Stars />
      <g ref={refFor("deep")} fill="none" strokeWidth={1}>
        <g ref={refFor("sweep")}>
          <circle r={46} stroke={C.grid} strokeDasharray="3 5" />
          <circle r={82} stroke={C.grid} strokeDasharray="1 7" />
        </g>
        <circle r={16} stroke={C.outline} />
        {saturn && <ellipse rx={30} ry={7} stroke={C.outline} transform="rotate(-18)" />}
        <circle r={6} stroke={C.pin} strokeWidth={1.5} />
        <circle r={1.5} fill={C.pin} stroke="none" />
        <text y={36} textAnchor="middle" fill={C.value} fontSize={11} stroke="none">
          {label}
        </text>
      </g>
    </>
  );
}

/** A fixed star field from a small hash, so it is the same on every open. */
function Stars() {
  const stars = Array.from({ length: 70 }, (_, i) => {
    const h = (n: number) => (((i + 1) * n * 2654435761) >>> 0) / 4294967296;
    return { x: h(7) * 100, y: h(13) * 100, r: 0.4 + h(29) * 0.8, bright: h(41) > 0.85 };
  });
  return (
    <g>
      {stars.map((star, index) => (
        <circle key={index} cx={`${star.x}%`} cy={`${star.y}%`} r={star.r} fill={star.bright ? C.other : C.outline} />
      ))}
    </g>
  );
}

/** "Orbiter Processing Facility, Kennedy Space Center" -> "Orbiter Processing Facility": the pin label stays short. */
function shortLabel(label: string): string {
  return fitLabel(label.split(",")[0]!.trim(), 30);
}

/** Cuts a label to `max` characters with an ellipsis. */
function fitLabel(label: string, max: number): string {
  if (label.length <= max) return label;
  return max < 4 ? "" : `${label.slice(0, max - 1).trimEnd()}…`;
}
