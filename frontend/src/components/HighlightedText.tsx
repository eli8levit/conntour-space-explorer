import { splitHighlights } from "../lib/highlight";

interface HighlightedTextProps {
  text: string;
  /** Stemmed query words from `queryTerms()`. Empty = plain text. */
  terms: string[];
}

/** Renders text with each query word wrapped in <mark>. */
export function HighlightedText({ text, terms }: HighlightedTextProps) {
  return (
    <>
      {splitHighlights(text, terms).map((part, index) =>
        part.match ? <mark key={index}>{part.text}</mark> : part.text,
      )}
    </>
  );
}
