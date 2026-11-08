import type { Body, Place, Provenance } from "../api/types";

/** 0.823 -> "82%". Scores arrive as 0–1 from the backend. */
export function formatPercent(score: number): string {
  const clamped = Math.min(1, Math.max(0, score));
  return `${Math.round(clamped * 100)}%`;
}

/**
 * "Meaning 82% · Words 40%": the two signals behind one confidence score.
 * When semantic search is off, only the word score exists, so we leave meaning out.
 */
export function scoreBreakdown(
  hit: { semantic_score: number; keyword_score: number },
  semanticOn: boolean,
): string {
  const words = `Words ${formatPercent(hit.keyword_score)}`;
  return semanticOn ? `Meaning ${formatPercent(hit.semantic_score)} · ${words}` : words;
}

/**
 * "2018-06-25T00:00:00Z" -> "25 Jun 2018".
 * NASA dates are midnight UTC. Formatting in local time would show the
 * previous day for anyone west of Greenwich, so we format in UTC.
 */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

/** The UTC year of an ISO date (same reason as formatDate: NASA dates are UTC). */
export function yearOf(iso: string): number {
  return new Date(iso).getUTCFullYear();
}

/** "23:31": 24-hour local time, for when the user ran a search (their clock, not UTC). */
export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(
    new Date(iso),
  );
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

/** "5 minutes ago", "yesterday", "just now". `now` is a parameter so tests are deterministic. */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const seconds = (new Date(iso).getTime() - now.getTime()) / 1000;
  if (Math.abs(seconds) < 45) return "just now";

  const format = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  }
  return format.format(Math.round(seconds / 60), "minute");
}

const BODY_LABELS: Record<Body, string> = {
  earth: "Earth",
  orbit: "Earth orbit",
  moon: "Moon",
  mars: "Mars",
  deep_space: "Deep space",
};

export function bodyLabel(body: Body): string {
  return BODY_LABELS[body];
}

/** Checks a URL value before we send it to the API as a body filter. */
export function isBody(value: string): value is Body {
  return Object.hasOwn(BODY_LABELS, value);
}

// Says plainly how we know the place, so an approximate pin is never shown as exact.
const PROVENANCE_LABELS: Record<Provenance, string> = {
  caption: "from the caption",
  "location field": "from the location field",
  "NASA center (approx.)": "approx.: NASA center",
  manual: "set by hand",
};

export function provenanceLabel(provenance: Provenance): string {
  return PROVENANCE_LABELS[provenance];
}

// A true minus sign (U+2212), not a hyphen: it has the width of a digit, so columns line up.
const MINUS = "\u2212";

function formatDegrees(value: number): string {
  const text = `${Math.abs(value).toFixed(2)}°`;
  // -0.001 rounds to "0.00": no minus sign on a zero.
  return value < 0 && text !== "0.00°" ? `${MINUS}${text}` : text;
}

/** "−5.20°, 138.13°", or null when the place has no coordinates (e.g. deep space). */
export function formatCoordinates(place: Pick<Place, "lat" | "lon">): string | null {
  if (place.lat === null || place.lon === null) return null;
  return `${formatDegrees(place.lat)}, ${formatDegrees(place.lon)}`;
}
