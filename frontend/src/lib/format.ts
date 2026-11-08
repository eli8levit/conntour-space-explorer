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

export type ConfidenceLevel = "high" | "medium" | "low";

// The backend already drops weak results below its threshold, so these
// levels only change how strong the badge looks among the shown results.
export function confidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= 0.7) return "high";
  if (confidence >= 0.4) return "medium";
  return "low";
}

/**
 * "2018-06-25T00:00:00Z" -> "Jun 25, 2018".
 * NASA dates are midnight UTC. Formatting in local time would show the
 * previous day for anyone west of Greenwich, so we format in UTC.
 */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
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

/** "-5.20°, 138.13°", or null when the place has no coordinates (e.g. deep space). */
export function formatCoordinates(place: Pick<Place, "lat" | "lon">): string | null {
  if (place.lat === null || place.lon === null) return null;
  return `${place.lat.toFixed(2)}°, ${place.lon.toFixed(2)}°`;
}
