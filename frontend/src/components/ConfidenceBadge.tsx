import type { SearchHit } from "../api/types";
import { confidenceLevel, formatPercent, scoreBreakdown, type ConfidenceLevel } from "../lib/format";

// Stronger matches look "brighter": solid white, then outlined, then grey.
const LEVEL_STYLES: Record<ConfidenceLevel, string> = {
  high: "bg-fg text-bg border-fg",
  medium: "text-fg border-fg",
  low: "text-muted border-line-strong",
};

interface ConfidenceBadgeProps {
  hit: SearchHit;
  /** False when the backend ran keyword-only search (no meaning score). */
  semanticOn: boolean;
}

/**
 * The confidence percentage. The breakdown ("Meaning 82% · Words 40%")
 * appears when the surrounding card (a `group`) is hovered or focused.
 */
export function ConfidenceBadge({ hit, semanticOn }: ConfidenceBadgeProps) {
  const breakdown = scoreBreakdown(hit, semanticOn);
  return (
    <span className="relative inline-flex shrink-0">
      <span
        className={`rounded-sm border px-1.5 py-0.5 font-mono text-xs leading-none ${LEVEL_STYLES[confidenceLevel(hit.confidence)]}`}
      >
        {formatPercent(hit.confidence)}
        <span className="sr-only"> confidence ({breakdown})</span>
      </span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-full right-0 mb-2 whitespace-nowrap rounded-sm border border-line bg-surface px-2 py-1 font-mono text-[11px] text-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        {breakdown}
      </span>
    </span>
  );
}
