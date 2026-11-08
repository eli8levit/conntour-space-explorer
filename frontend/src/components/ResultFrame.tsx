import { Link } from "react-router-dom";
import type { SearchHit, Source } from "../api/types";
import { OPENED_IN_APP } from "../hooks/useImageParam";
import { displayTitle } from "../lib/displayTitle";
import { formatPercent, scoreBreakdown, yearOf } from "../lib/format";
import { formatRank, isStrong, rankSpan, rankTier, type FrameTier } from "../lib/match";
import { frameTransitionName } from "../lib/viewTransition";
import { FadeImage } from "./FadeImage";
import { HotMarks } from "./HotMarks";
import { ConfidenceBar, RankBadge } from "./MatchMarks";

// Caption sizes per frame tier (A2·3–5): hero 19/26, large 14/18, the rest 12/12.
const CAPTION: Record<FrameTier, { row: string; title: string; pct: string }> = {
  hero: { row: "px-3.5 pb-[9px] pt-2.5", title: "text-[19px]", pct: "text-[26px] leading-none" },
  large: { row: "px-2.5 pb-1.5 pt-[7px]", title: "text-sm", pct: "text-lg leading-none" },
  wide: { row: "px-2.5 pb-1.5 pt-[7px]", title: "text-xs", pct: "text-xs" },
  small: { row: "px-[7px] py-1", title: "text-xs", pct: "text-xs" },
};

export interface HotProps {
  hot: boolean;
  /** Called with the image id when the frame becomes hot, and with null when it cools. */
  onHot: (id: number | null) => void;
}

interface ResultFrameProps extends HotProps {
  hit: SearchHit;
  to: string;
  semanticOn: boolean;
}

/**
 * One result on A2. Its size says its rank (bigger = more confident); the
 * badge, the % and the bar say the same in text, so nothing relies on color.
 */
export function ResultFrame({ hit, to, semanticOn, hot, onHot }: ResultFrameProps) {
  const { source, rank, confidence } = hit;
  const [cols, rows] = rankSpan(rank);
  const tier = rankTier(rank);
  const strong = isStrong(confidence);
  const title = displayTitle(source);
  const caption = CAPTION[tier];

  return (
    <li
      className={`relative ${hot ? "z-10" : ""}`}
      style={{ gridColumn: `span ${cols}`, gridRow: `span ${rows}`, viewTransitionName: frameTransitionName(source.id) }}
      onPointerEnter={() => onHot(source.id)}
      onPointerLeave={() => onHot(null)}
    >
      <Link
        to={to}
        state={OPENED_IN_APP}
        data-result-id={source.id}
        aria-label={`${title}, ${yearOf(source.date_created)}, rank ${rank}, ${formatPercent(confidence)} match`}
        onFocus={() => onHot(source.id)}
        onBlur={() => onHot(null)}
        className="block h-full w-full overflow-hidden bg-raised focus-visible:outline-none"
      >
        {/* Faint matches sit a little back, even in full color. */}
        <span className={`block h-full w-full ${strong ? "" : "opacity-[0.82]"}`}>
          <FadeImage
            src={source.thumb_url}
            loading={rank <= 10 ? "eager" : "lazy"}
            decoding="async"
            className="h-full w-full object-cover"
          />
        </span>
      </Link>

      <RankBadge
        rank={formatRank(rank)}
        strong={strong}
        size={tier === "hero" ? "hero" : tier === "large" ? "large" : "small"}
        className="pointer-events-none absolute left-0 top-0"
      />

      <span className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col bg-[var(--caption-bg)]">
        <span className={`flex items-baseline justify-between gap-2.5 ${caption.row}`}>
          {/* 1×1 frames are too small for a title: only the % (A2·5). */}
          {tier !== "small" && <span className={`min-w-0 truncate ${caption.title}`}>{title}</span>}
          <span className={`shrink-0 ${caption.pct} ${strong ? "text-accent-text" : "text-fg"}`}>
            {formatPercent(confidence)}
          </span>
        </span>
        <ConfidenceBar confidence={confidence} variant="frame" />
      </span>

      {hot && (
        <>
          <HotMarks />
          <Breakdown text={scoreBreakdown(hit, semanticOn)} />
        </>
      )}
    </li>
  );
}

/** The "Meaning 82% · Words 40%" tooltip on a hot frame (A2·10). */
function Breakdown({ text }: { text: string }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute right-0 top-0 z-20 whitespace-nowrap bg-bg/90 px-2 py-1 text-[11px] text-muted"
    >
      {text}
    </span>
  );
}

/**
 * A2·6: an image that did not match. Grey and 16% opacity: still there,
 * just set aside. Clickable (opens details without a match block) but not
 * in the tab order, so keyboard users move through the results only.
 */
export function SetAsideFrame({ source, to }: { source: Source; to: string }) {
  return (
    <li
      className="opacity-[0.16] grayscale transition-opacity hover:opacity-40"
      style={{ viewTransitionName: frameTransitionName(source.id) }}
    >
      <Link
        to={to}
        state={OPENED_IN_APP}
        tabIndex={-1}
        aria-label={`${displayTitle(source)}, ${yearOf(source.date_created)}, not a match`}
        className="block h-full w-full overflow-hidden bg-raised"
      >
        <FadeImage src={source.thumb_url} loading="lazy" decoding="async" className="h-full w-full object-cover" />
      </Link>
    </li>
  );
}
