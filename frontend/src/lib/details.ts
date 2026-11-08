// A3, image details: split the NASA caption into the readable text and the
// facts buried at its end, so the facts can go in the metadata grid.
import type { Source } from "../api/types";
import { bodyLabel } from "./format";

export interface CaptionParts {
  /** The caption without the trailing URL, key/value tail and photo credit. */
  text: string;
  instrument: string | null;
  orbit: string | null;
  captured: string | null;
  credit: string | null;
}

// Mars (JPL) captions end with "Orbit Number: 72297 Latitude: -5.2 Longitude: 138.1 Instrument: VIS Captured: 2018-04-02 02:54".
const MARS_TAIL = /\s*Orbit Number:.*$/s;
const field = (text: string, label: string) =>
  new RegExp(`${label}:\\s*(.+?)(?=\\s+[A-Z][a-z]+(?: [A-Z][a-z]+)?:|\\s*$)`).exec(text)?.[1]?.trim() ?? null;

/** Takes the caption apart. Every field is null when the caption does not have it. */
export function parseCaption(description: string): CaptionParts {
  let text = description.trim();

  // A bare link at the very end (the JPL photojournal page) adds nothing to read.
  text = text.replace(/\s*https?:\/\/\S+\s*$/, "");

  let instrument: string | null = null;
  let orbit: string | null = null;
  let captured: string | null = null;
  const tail = MARS_TAIL.exec(text);
  if (tail) {
    orbit = field(tail[0], "Orbit Number");
    instrument = field(tail[0], "Instrument");
    captured = field(tail[0], "Captured");
    text = text.slice(0, tail.index);
  }

  // Kennedy captions end with "Photo credit: NASA/Kim Shiflett": a real field, not prose.
  let credit: string | null = null;
  const creditMatch = /\s*Photo credit:\s*([^\n]+?)\s*$/i.exec(text);
  if (creditMatch) {
    credit = creditMatch[1]!.replace(/_/g, "/");
    text = text.slice(0, creditMatch.index);
  }

  return { text: text.trim(), instrument, orbit, captured, credit };
}

// Keywords that only repeat what the eyebrow or metadata already say.
const GENERIC_KEYWORDS = new Set(["nasa", "mars", "earth", "jpl", "ksc", "jsc", "iss"]);

/**
 * The small line above the A3 title: where it is, plus the first keyword that
 * adds something ("Mars · 2001 Mars Odyssey"). Falls back to the NASA center.
 */
export function eyebrow(source: Pick<Source, "place" | "keywords" | "center">): string {
  const where = source.place ? bodyLabel(source.place.body) : null;
  const keyword = source.keywords.find(
    (word) => !GENERIC_KEYWORDS.has(word.toLowerCase()) && word.toLowerCase() !== where?.toLowerCase(),
  );
  const parts = [where, keyword].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" · ") : source.center;
}

/** "660 × 1280 · medium", or null when the API has no dimensions for this image. */
export function sizeLabel(source: Pick<Source, "width" | "height">): string | null {
  if (!source.width || !source.height) return null;
  return `${source.width} × ${source.height} · medium`;
}
