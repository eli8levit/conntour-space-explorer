import type { Place } from "../api/types";

// A3·12: where the image was taken, drawn in the same line-art style as the
// Space view (thin outlines, faint graticule, one orange pin ring), so the
// modal previews the scene honestly. A static SVG: no 3D library here.

const W = 220;
const H = 150;
const CX = W / 2;
const CY = H / 2;
const R = 56;
const LINE = "#3A3A40"; // the planet outline: line-strong, one step up so it reads on #050506
const GRID = "#1F1F23"; // graticule: `line`
const PIN = "#FF5A1F"; // accent: the one active thing

const toRad = (degrees: number) => (degrees * Math.PI) / 180;

/**
 * Orthographic projection centred on the pin's longitude, seen from the
 * equator: x = cx + r·cos(lat)·sin(lon − lon0), y = cy − r·sin(lat).
 * With lon0 = the pin's longitude, the pin always sits on the centre line.
 */
function project(lat: number, lon: number, lon0: number) {
  return {
    x: CX + R * Math.cos(toRad(lat)) * Math.sin(toRad(lon - lon0)),
    y: CY - R * Math.sin(toRad(lat)),
  };
}

export function LocatorMini({ place }: { place: Place }) {
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" className="block">
      {place.body === "orbit" ? (
        <Orbit />
      ) : place.body === "deep_space" ? (
        <DeepSpace label={place.label} />
      ) : (
        <Globe lat={place.lat} lon={place.lon} />
      )}
    </svg>
  );
}

function PinRing({ x, y }: { x: number; y: number }) {
  return <circle cx={x} cy={y} r={6} fill="none" stroke={PIN} strokeWidth={1.5} />;
}

/** A body (Earth, Moon, Mars) with a graticule every 30° and the pin. */
function Globe({ lat, lon }: { lat: number | null; lon: number | null }) {
  const lon0 = lon ?? 0;
  // Meridians every 30° around the centre line: ellipses whose width is r·|sin(Δlon)|.
  const meridians = [-60, -30, 0, 30, 60].map((offset) => Math.abs(R * Math.sin(toRad(offset))));
  // Parallels: seen from the equator they are straight lines.
  const parallels = [-60, -30, 0, 30, 60].map((latitude) => ({
    y: CY - R * Math.sin(toRad(latitude)),
    half: R * Math.cos(toRad(latitude)),
  }));
  const pin = lat !== null && lon !== null ? project(lat, lon, lon0) : null;

  return (
    <g fill="none" strokeWidth={1}>
      {meridians.map((rx, index) => (
        <ellipse key={index} cx={CX} cy={CY} rx={rx} ry={R} stroke={GRID} />
      ))}
      {parallels.map(({ y, half }) => (
        <line key={y} x1={CX - half} x2={CX + half} y1={y} y2={y} stroke={GRID} />
      ))}
      <circle cx={CX} cy={CY} r={R} stroke={LINE} />
      {pin && <PinRing x={pin.x} y={pin.y} />}
    </g>
  );
}

/** Earth orbit: a smaller Earth, one thin tilted orbit, the pin on the orbit. */
function Orbit() {
  const r = 36;
  const rx = 88;
  const ry = 22;
  const tilt = -14;
  const angle = toRad(-35); // where on the ellipse the pin sits (front, upper right)
  const px = rx * Math.cos(angle);
  const py = ry * Math.sin(angle);
  const t = toRad(tilt);
  const pin = { x: CX + px * Math.cos(t) - py * Math.sin(t), y: CY + px * Math.sin(t) + py * Math.cos(t) };
  return (
    <g fill="none" strokeWidth={1}>
      <line x1={CX - r} x2={CX + r} y1={CY} y2={CY} stroke={GRID} />
      <ellipse cx={CX} cy={CY} rx={r * 0.5} ry={r} stroke={GRID} />
      <circle cx={CX} cy={CY} r={r} stroke={LINE} />
      <ellipse cx={CX} cy={CY} rx={rx} ry={ry} stroke={LINE} transform={`rotate(${tilt} ${CX} ${CY})`} />
      <PinRing x={pin.x} y={pin.y} />
    </g>
  );
}

/** Deep space: a small circle with the place name; no coordinates to show. */
function DeepSpace({ label }: { label: string }) {
  return (
    <g>
      {/* A few faint points so the empty box reads as space, not as "missing". */}
      {[
        [34, 30],
        [182, 24],
        [58, 118],
        [190, 112],
        [150, 52],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={0.9} fill={LINE} />
      ))}
      <circle cx={CX} cy={CY - 8} r={16} fill="none" stroke={LINE} />
      <PinRing x={CX} y={CY - 8} />
      <text x={CX} y={CY + 30} textAnchor="middle" fill="#8E8C86" fontSize={11} fontFamily="inherit">
        {label}
      </text>
    </g>
  );
}
