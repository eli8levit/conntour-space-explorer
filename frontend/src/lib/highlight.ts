// Highlights the query's words inside a result title.
// This is display only: the backend does the real matching with Postgres
// full-text search (with a proper English stemmer). Here we use a cheap
// approximation, so "rovers" in the query also marks "Rover" in a title.

// Words that carry no meaning in a query like "images of Mars rovers".
const STOP_WORDS = new Set([
  "a", "an", "and", "at", "by", "for", "from", "in", "into", "is", "it", "of",
  "on", "or", "the", "to", "with", "image", "images", "photo", "photos", "picture", "pictures",
]);

// Letters, digits and dashes, so a mission ID like "STS-135" stays one word.
const WORD = /[\p{L}\p{N}-]+/gu;

/** Crude plural stem: "rovers" -> "rover", "Mars" -> "mar". Applied to both sides, so they compare equal. */
function stem(word: string): string {
  const lower = word.toLowerCase();
  return lower.length > 3 && lower.endsWith("s") && !lower.endsWith("ss") ? lower.slice(0, -1) : lower;
}

/** The stemmed query words worth highlighting. */
export function queryTerms(query: string): string[] {
  const words = query.toLowerCase().match(WORD) ?? [];
  const terms = words.filter((word) => word.length >= 2 && !STOP_WORDS.has(word)).map(stem);
  return [...new Set(terms)];
}

export interface TextPart {
  text: string;
  match: boolean;
}

/**
 * Cuts `text` into parts and marks each whole word whose stem is a query term.
 * Joining all parts gives back the original text.
 */
export function splitHighlights(text: string, terms: string[]): TextPart[] {
  if (terms.length === 0) return [{ text, match: false }];
  const wanted = new Set(terms);

  const parts: TextPart[] = [];
  let last = 0;
  for (const found of text.matchAll(WORD)) {
    if (!wanted.has(stem(found[0]))) continue;
    if (found.index > last) parts.push({ text: text.slice(last, found.index), match: false });
    parts.push({ text: found[0], match: true });
    last = found.index + found[0].length;
  }
  if (last < text.length || parts.length === 0) parts.push({ text: text.slice(last), match: false });
  return parts;
}
