import { Link } from "react-router-dom";
import type { SearchHit, Source } from "../api/types";
import { OPENED_IN_APP } from "../hooks/useImageParam";
import { formatDate, scoreBreakdown } from "../lib/format";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { HighlightedText } from "./HighlightedText";

interface ImageCardProps {
  source: Source;
  /** Where the card links to: the current page with ?image=<id>. */
  to: string;
  /** Present on search results: adds the confidence badge. */
  hit?: SearchHit;
  semanticOn?: boolean;
  /** Query words to highlight in the title. */
  terms?: string[];
}

export function ImageCard({ source, to, hit, semanticOn = true, terms = [] }: ImageCardProps) {
  return (
    // A real link (not a button): it changes the URL, and middle-click opens a new tab.
    <Link to={to} state={OPENED_IN_APP} className="group block rounded-sm">
      <img
        src={source.thumb_url}
        // Empty alt: the title below already names the image, so a screen reader would hear it twice.
        alt=""
        loading="lazy"
        decoding="async"
        width={400}
        height={300}
        className="aspect-[4/3] w-full rounded-sm border border-line bg-raised object-cover transition-opacity group-hover:opacity-90"
      />
      <span className="mt-2 flex items-start justify-between gap-2">
        <span className="line-clamp-2 text-sm font-medium leading-snug">
          <HighlightedText text={source.title} terms={terms} />
        </span>
        {hit && <ConfidenceBadge hit={hit} semanticOn={semanticOn} />}
      </span>
      <span className="mt-1 block truncate font-mono text-xs text-muted">
        {formatDate(source.date_created)} · {source.center}
      </span>
      {source.place && <span className="block truncate text-xs text-faint">{source.place.label}</span>}
      {hit && (
        // Touch screens have no hover, so they get the breakdown as a plain line.
        <span className="hidden font-mono text-[11px] text-faint [@media(hover:none)]:block">
          {scoreBreakdown(hit, semanticOn)}
        </span>
      )}
    </Link>
  );
}
