// Every image has a hand-written short title (backend/data/titles.json), and
// displayTitle() shows it. The derivation below is the fallback for a record
// without one: about a third of the NASA records use a raw ID as their title
// ("iss071e608493", "KSC-98pc637", "2010-4372"), which tells a visitor
// nothing, so for those we build a short title from the caption instead.
// The real nasa_id stays visible in the image details.
import type { Source } from "../api/types";

/** About one line in a caption chip or the rail. */
export const MAX_TITLE_LENGTH = 60;

// Captions that are the whole record end up as the title too. Past this
// length we shorten them the same way.
const LONG_TITLE = 90;

/**
 * True for a single token with 5+ digits: "iss071e608493", "KSC-98pc637",
 * "ARC-2011-ACD11-0035-024", "1100173". A real name like "STS-135", a year
 * like "2014", or "Gale Crater" (a space) is not ID-like.
 */
export function isIdLike(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed === "" || /\s/.test(trimmed)) return false;
  return (trimmed.match(/\d/g) ?? []).length >= 5;
}

// Prefixes NASA puts before the actual sentence, removed one at a time.
const PREFIXES: RegExp[] = [
  // "(Sept. 4, 2024)" or "(1967)": the date the photo was taken.
  /^\([^)]*\d{4}\)\s*/,
  // "---", "--", "-", "–" separators after an ID or a date.
  /^[-–—]+\s*/,
  // Datelines: "CAPE CANAVERAL, Fla. –", "KENNEDY SPACE CENTER, FLA. --".
  /^[A-Z][A-Z .'’]+,\s*[A-Za-z]+\.?\s*[-–—]+\s*/,
];

/**
 * "ISS034-E-010621 (31 Dec. 2012) --- Canadian…" -> "Canadian…": only the ID,
 * its date and the dashes. The NASA ID and the date are shown as metadata
 * already, so the A3 description starts at the first real word.
 */
export function stripIdPrefix(caption: string): string {
  const text = caption.trim();
  const firstToken = text.split(/\s/, 1)[0] ?? "";
  if (!isIdLike(firstToken)) return text;
  return text
    .slice(firstToken.length)
    .trimStart()
    .replace(PREFIXES[0]!, "")
    .replace(PREFIXES[1]!, "");
}

/** Removes a leading ID, date, dateline or "---" from a caption, repeatedly. */
function stripCaptionPrefix(caption: string): string {
  let text = caption.trim();
  // "PHOTO DATE: … SUBJECT: Expedition 40/41 crew … PHOTOGRAPHER: …": keep the subject.
  const subject = /SUBJECT:\s*(.+?)(?:\s+PHOTOGRAPHER:|$)/s.exec(text);
  if (subject?.[1]) text = subject[1].trim();

  for (;;) {
    const before = text;
    const firstToken = text.split(/\s/, 1)[0] ?? "";
    if (isIdLike(firstToken)) text = text.slice(firstToken.length).trimStart();
    for (const prefix of PREFIXES) text = text.replace(prefix, "");
    if (text === before) return text;
  }
}

// Short words that are not acronyms, so "PAVILION AT SCIQUEST" becomes "pavilion at sciquest".
const SMALL_WORDS = new Set(["A", "AN", "AND", "AT", "BY", "FOR", "IN", "OF", "ON", "OR", "THE", "TO", "WITH"]);

/**
 * "STS-134 LEFT FORWARD CENTER (LFC) SRB STACKING" -> "STS-134 left forward center (LFC) SRB stacking".
 * Shouting captions read badly as titles. Words with digits and short
 * acronyms (3 letters or less) keep their capitals.
 */
function sentenceCaseIfShouting(text: string): string {
  const letters = text.replace(/[^A-Za-z]/g, "");
  if (letters.length < 8 || letters !== letters.toUpperCase()) return text;
  const words = text.split(/(\s+)/).map((word) => {
    const bare = word.replace(/[^A-Za-z]/g, "");
    const keep = /\d/.test(word) || (bare.length <= 3 && !SMALL_WORDS.has(bare));
    return keep ? word : word.toLowerCase();
  });
  // Capital first letter, unless the text starts with a kept word ("STS-134 left…").
  return words.join("").replace(/^[^A-Za-z0-9]*[a-z]/, (start) => start.toUpperCase());
}

/**
 * The first sentence: up to ". ", ";" or "!"/"?". A period after a short word
 * ("Fla.", "Nov.", "Dr.") is an abbreviation, not the end of a sentence.
 */
function firstSentence(text: string): string {
  const end = /(\S+)([.;!?])(\s|$)/g;
  for (const found of text.matchAll(end)) {
    const word = found[1]!.replace(/[^A-Za-z]/g, "");
    if (found[2] === "." && word.length <= 3) continue;
    return text.slice(0, found.index + found[1]!.length);
  }
  return text;
}

/** Cuts at a word boundary before `max` and adds "…". Trailing commas and dashes go. */
export function capAtWord(text: string, max = MAX_TITLE_LENGTH): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut;
  return `${base.replace(/[\s,;:–—-]+$/, "")}…`;
}

// A first clause shorter than this is too vague to stand alone ("From left to right").
const MIN_CLAUSE = 30;

/**
 * A short title from a caption, or "" if the caption has nothing usable.
 * The first sentence if it fits; else its first clause (up to a comma) if
 * that says enough; else the sentence cut at a word boundary with "…".
 */
export function titleFromCaption(caption: string): string {
  const body = stripCaptionPrefix(caption);
  const sentence = firstSentence(sentenceCaseIfShouting(body)).replace(/\s+/g, " ").trim();
  if (sentence.length <= MAX_TITLE_LENGTH) return sentence;

  // A clause that only says where ("At Kennedy Space Center in Florida") is not a title.
  const clause = sentence.split(",", 1)[0]!.trim();
  const onlyPlace = /^(At|In|On|Near|From)\b/.test(clause);
  if (!onlyPlace && clause.length >= MIN_CLAUSE && clause.length <= MAX_TITLE_LENGTH) return clause;
  return capAtWord(sentence);
}

type TitleFields = Pick<Source, "title" | "nasa_id" | "description"> & { short_title?: string | null };

/**
 * The title to show for an image: the hand-written short title when there is
 * one. Otherwise keeps the NASA title when it is a real title, and derives
 * one from the caption when the title is an ID (or the whole caption pasted
 * in as a title).
 */
export function displayTitle(source: TitleFields): string {
  const short = source.short_title?.trim();
  if (short) return short;
  return derivedTitle(source);
}

/** The NASA title when it is a real one, else a title built from the caption. */
export function derivedTitle(source: Pick<Source, "title" | "nasa_id" | "description">): string {
  const title = source.title.trim();
  const idLike = title === source.nasa_id || isIdLike(title);
  if (!idLike && title.length <= LONG_TITLE) return title;

  const derived = titleFromCaption(source.description) || titleFromCaption(title);
  // Nothing better in the caption (it is an ID too, or empty): the ID is all we have.
  return derived && !isIdLike(derived) ? derived : title;
}

const normalize = (text: string) => text.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();

/**
 * The NASA title for the A3 "NASA title" row, or null when it adds nothing:
 * it reads the same as the title on screen (case aside), or it is only the
 * ID, which the NASA ID row already shows.
 */
export function nasaTitleIfDifferent(source: TitleFields): string | null {
  const title = source.title.replace(/\s+/g, " ").trim();
  if (!title || title === source.nasa_id || isIdLike(title)) return null;
  return normalize(title) === normalize(displayTitle(source)) ? null : title;
}

/**
 * The text the "why it matched" line treats as the title: the title on screen
 * plus the NASA title (or its caption-derived stand-in), since the search
 * scored the NASA title. "Matched mars in the title" then holds for
 * "Perseverance marble countdown", whose NASA title has "Mars" in it.
 */
export function titleForMatching(source: TitleFields): string {
  const shown = displayTitle(source);
  const nasa = derivedTitle(source);
  return shown === nasa ? shown : `${shown} ${nasa}`;
}
