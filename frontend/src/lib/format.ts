import type { Body, IdRule, Place, Provenance } from "../api/types";

/** 0.823 -> "82%". Scores arrive as 0–1 from the backend. */
export function formatPercent(score: number): string {
  const clamped = Math.min(1, Math.max(0, score));
  return `${Math.round(clamped * 100)}%`;
}

/**
 * The ID in a query, for display: "STS-135", "PIA22505", or "Expedition 61".
 * A word with letters and digits wins; otherwise a bare number takes the word before it.
 * The backend decides what counts as an ID (scoring.query_ids); this only names it, and
 * only when the backend says the ID rule changed a score.
 */
export function firstQueryId(query: string): string | null {
  const words = query.match(/[A-Za-z0-9]+(?:[-.][A-Za-z0-9]+)*/g) ?? [];
  const named = words.find((word) => /\d/.test(word) && /[A-Za-z]/.test(word));
  if (named) return named;
  const index = words.findIndex((word) => /^\d+$/.test(word));
  if (index < 0) return null;
  return index > 0 ? `${words[index - 1]} ${words[index]}` : words[index]!;
}

/**
 * Why a confidence is not the meaning/words blend: "halved: “STS-135” is not in this
 * image" or "raised: it has “STS-135”". null when the ID rule did not change the score.
 */
export function idRuleNote(idRule: IdRule | null, query: string): string | null {
  if (!idRule) return null;
  const id = firstQueryId(query);
  const quoted = id ? `“${id}”` : "the ID";
  return idRule === "halved" ? `halved: ${quoted} is not in this image` : `raised: it has ${quoted}`;
}

/**
 * "Meaning 82% · Words 40%": the two signals behind one confidence score.
 * When semantic search is off, only the word score exists, so we leave meaning out.
 * When the ID rule changed the score, its note goes last, so "Meaning 100% · Words 27%"
 * next to a 43% result still adds up.
 */
export function scoreBreakdown(
  hit: { semantic_score: number; keyword_score: number; id_rule: IdRule | null },
  semanticOn: boolean,
  query: string,
): string {
  const words = `Words ${formatPercent(hit.keyword_score)}`;
  const parts = semanticOn ? [`Meaning ${formatPercent(hit.semantic_score)}`, words] : [words];
  const note = idRuleNote(hit.id_rule, query);
  return [...parts, ...(note ? [note] : [])].join(" · ");
}

/**
 * "2018-06-25T00:00:00Z" -> "25 Jun 2018".
 * NASA dates are midnight UTC. Formatting in local time would show the
 * previous day for anyone west of Greenwich, so we format in UTC.
 */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  // A fixed month list: en-GB's Intl writes "Sept", and the design uses three letters everywhere.
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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
