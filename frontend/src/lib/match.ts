// Everything the UI derives from a confidence score: the two tiers, the
// frame size for a rank, and the "why it matched" line.
import type { Source } from "../api/types";
import { formatPercent } from "./format";
import { queryTerms, queryWords } from "./highlight";

/**
 * A result at or above this confidence is a "strong" match: orange badge,
 * orange bar. Below it is "faint": off-white. Mirrors `STRONG_MATCH` in
 * backend/config.py (the history counts use the same line). Keep them equal.
 */
export const STRONG_MATCH = 0.5;

export function isStrong(confidence: number): boolean {
  return confidence >= STRONG_MATCH;
}

/**
 * The weights of the confidence formula in backend/services/scoring.py
 * (confidence = 0.8 × meaning + 0.2 × words). Only used for the sentence
 * below; if the backend formula changes, edit these two numbers.
 */
const MEANING_WEIGHT = 80;
const WORDS_WEIGHT = 20;

/** The note under the ranking rail that explains the score (A2·10). */
export const SCORING_NOTE = `Confidence blends meaning (${MEANING_WEIGHT}%) and matching words (${WORDS_WEIGHT}%). Hover a result for the breakdown.`;

export type Span = readonly [cols: number, rows: number];

/**
 * A2: frame size by rank, so "bigger = more confident" reads at a glance.
 * Rank 1 is the hero, 2–4 are large, 5–10 are wide, the rest are single cells.
 */
export function rankSpan(rank: number): Span {
  if (rank === 1) return [4, 2];
  if (rank <= 4) return [2, 2];
  if (rank <= 10) return [2, 1];
  return [1, 1];
}

/** The caption style that goes with each size (badge, title and % sizes). */
export type FrameTier = "hero" | "large" | "wide" | "small";

export function rankTier(rank: number): FrameTier {
  if (rank === 1) return "hero";
  if (rank <= 4) return "large";
  if (rank <= 10) return "wide";
  return "small";
}

/**
 * The A2 header's first part (§6.2): "5 strong matches, 8 faint",
 * "No strong matches, 6 faint", "3 strong matches", or "No matches".
 */
export function resultSummary(strong: number, faint: number): string {
  if (strong === 0 && faint === 0) return "No matches";
  const strongPart =
    strong === 0 ? "No strong matches" : strong === 1 ? "1 strong match" : `${strong} strong matches`;
  return faint === 0 ? strongPart : `${strongPart}, ${faint} faint`;
}

/** "4" -> "04". Ranks are always shown with two digits so the rail lines up. */
export function formatRank(rank: number): string {
  return String(rank).padStart(2, "0");
}

export type MatchField = "title" | "keywords" | "description";

export interface MatchedTerm {
  term: string;
  field: MatchField;
}

/**
 * For each query word, the best field it appears in (title beats keywords
 * beats description). The API does not say which words matched, so we derive
 * it in the browser with the same stemming as the highlights.
 */
export function matchedTerms(
  query: string,
  source: Pick<Source, "keywords" | "description"> & { title: string },
): MatchedTerm[] {
  const fields: [MatchField, string][] = [
    ["title", source.title],
    ["keywords", source.keywords.join(" ")],
    ["description", source.description],
  ];
  // Stem each field once, not once per query word.
  const fieldTerms = fields.map(([field, text]) => [field, new Set(queryTerms(text))] as const);
  return queryWords(query).flatMap(({ word, term }) => {
    const hit = fieldTerms.find(([, terms]) => terms.has(term));
    // Report the word as the user typed it ("mars"), not its stem ("mar").
    return hit ? [{ term: word, field: hit[0] }] : [];
  });
}

const FIELD_PHRASE: Record<MatchField, string> = {
  title: "in the title",
  keywords: "in keywords",
  description: "in the description",
};

/**
 * The "why it matched" line (§6.3):
 *   - all words in one field: "Matched mars, rover in the title"
 *   - mixed fields:           "Matched mars in keywords, rover in the description"
 *   - no literal word:        "Similar in meaning · Meaning 82%"
 *   - the ID rule changed it: "… · halved: “STS-135” is not in this image"
 * The last case is a pure semantic hit ("red planet" -> Mars). It is the
 * moment that shows the hybrid search working, so it is never left empty.
 */
export function whyLine(matches: MatchedTerm[], semanticScore: number, idNote: string | null = null): string {
  const line = whyWords(matches, semanticScore);
  // The ID rule's note (format.ts idRuleNote) goes last: it explains the score, not the words.
  return idNote ? `${line} · ${idNote}` : line;
}

function whyWords(matches: MatchedTerm[], semanticScore: number): string {
  if (matches.length === 0) return `Similar in meaning · Meaning ${formatPercent(semanticScore)}`;

  const fields = [...new Set(matches.map((match) => match.field))];
  if (fields.length === 1) {
    return `Matched ${matches.map((match) => match.term).join(", ")} ${FIELD_PHRASE[fields[0]!]}`;
  }
  // Group the words by field, in title -> keywords -> description order.
  const groups = (["title", "keywords", "description"] as const)
    .map((field) => ({ field, terms: matches.filter((match) => match.field === field).map((m) => m.term) }))
    .filter((group) => group.terms.length > 0)
    .map((group) => `${group.terms.join(", ")} ${FIELD_PHRASE[group.field]}`);
  return `Matched ${groups.join(", ")}`;
}
