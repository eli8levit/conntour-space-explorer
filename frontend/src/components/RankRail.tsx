import { Fragment, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { SearchHit } from "../api/types";
import { OPENED_IN_APP } from "../hooks/useImageParam";
import { displayTitle, titleForMatching } from "../lib/displayTitle";
import { idRuleNote, scoreBreakdown } from "../lib/format";
import { formatRank, isStrong, matchedTerms, SCORING_NOTE, whyLine } from "../lib/match";
import { FILL_AFTER_MS, RISE_MS, enterStyle, rankDelay } from "../lib/motion";
import { CountUp } from "./CountUp";
import { ChevronIcon } from "./Icons";
import { ConfidenceBar } from "./MatchMarks";
import type { HotProps } from "./ResultFrame";

interface RankRailProps {
  hits: SearchHit[];
  query: string;
  semanticOn: boolean;
  hotId: number | null;
  onHot: HotProps["onHot"];
  linkFor: (id: number) => string;
  /** Shown instead of the list when nothing matched (§6.2). */
  empty?: ReactNode;
  onCollapse?: () => void;
  className?: string;
  /** True while the page enters: rows rise one by one in rank order. */
  entering?: boolean;
  /** True while the search loads: the title must not say "No results" yet. */
  loading?: boolean;
}

/**
 * A2·8–10: the results as a ranked list. Every row explains why it matched;
 * faint rows sit under a divider. It is an <ol>, so a screen reader hears the
 * ranking as a ranking.
 */
export function RankRail({ hits, query, semanticOn, hotId, onHot, linkFor, empty, onCollapse, className = "", entering = false, loading = false }: RankRailProps) {
  const firstFaint = hits.findIndex((hit) => !isStrong(hit.confidence));
  const [scrolled, setScrolled] = useState(false);

  return (
    <aside aria-labelledby="rail-title" className={`flex flex-col gap-1.5 bg-surface px-6 pb-[18px] pt-5 ${className}`}>
      <div className="flex items-center justify-between pb-1.5">
        <h2 id="rail-title" className="text-[15px] font-medium">
          {loading
            ? "Results"
            : hits.length === 0
            ? "No results"
            : hits.length === 1
              ? "1 result, ranked by match"
              : `${hits.length} results, ranked by match`}
        </h2>
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            aria-label="Collapse the results list"
            className="flex h-7 w-7 items-center justify-center border border-line-strong text-muted hover:text-fg"
          >
            <ChevronIcon />
          </button>
        )}
      </div>

      {hits.length === 0 ? (
        empty
      ) : (
        <ol
          onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 4)}
          data-scrolled={scrolled ? "" : undefined}
          className="rail-scroll -mr-3 min-h-0 flex-1 overflow-y-auto pb-9 pr-3"
        >
          {hits.map((hit, index) => (
            <Fragment key={hit.source.id}>
              {index === firstFaint && (
                // With only faint results there is nothing above to divide from: it becomes the rail's first line.
                <li
                  aria-hidden="true"
                  className={`pb-1.5 text-xs text-muted ${index === 0 ? "pt-0.5" : "pt-3"} ${entering ? "enter-rise" : ""}`}
                  style={entering ? enterStyle(rankDelay(index), RISE_MS) : undefined}
                >
                  Faint matches, under 50%.
                </li>
              )}
              <RailRow
                hit={hit}
                query={query}
                semanticOn={semanticOn}
                hot={hotId === hit.source.id}
                onHot={onHot}
                to={linkFor(hit.source.id)}
                enterDelay={entering ? rankDelay(index) : undefined}
              />
            </Fragment>
          ))}
        </ol>
      )}

      <p className="mt-auto border-t border-line pt-3 text-xs leading-normal text-muted">{SCORING_NOTE}</p>
    </aside>
  );
}

interface RailRowProps extends HotProps {
  hit: SearchHit;
  query: string;
  semanticOn: boolean;
  to: string;
  /** Set while the page enters: the row rises after this many ms. */
  enterDelay?: number;
}

function RailRow({ hit, query, semanticOn, hot, onHot, to, enterDelay }: RailRowProps) {
  const { source, rank, confidence } = hit;
  const strong = isStrong(confidence);
  const title = displayTitle(source);
  // Every row, faint ones too: "red planet" has only faint results, and "Similar in
  // meaning" is the line that shows why they are there at all.
  const why = whyLine(
    matchedTerms(query, { ...source, title: titleForMatching(source) }),
    hit.semantic_score,
    idRuleNote(hit.id_rule, query),
  );
  // Where the breakdown tooltip goes: measured when the row becomes hot.
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  const measure = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    setAnchor({ top: rect.top + rect.height / 2, left: rect.left - 34 });
  };

  const entering = enterDelay !== undefined;
  const fillDelay = entering ? enterDelay + FILL_AFTER_MS : undefined;
  return (
    <li
      className={`relative ${entering ? "enter-rise" : ""}`}
      style={entering ? enterStyle(enterDelay, RISE_MS) : undefined}
    >
      <Link
        to={to}
        state={OPENED_IN_APP}
        onPointerEnter={(event) => {
          measure(event.currentTarget);
          onHot(source.id);
        }}
        onPointerLeave={() => onHot(null)}
        onFocus={(event) => {
          measure(event.currentTarget);
          onHot(source.id);
        }}
        onBlur={() => onHot(null)}
        className={`-mx-2 grid grid-cols-[26px_minmax(0,1fr)] items-start gap-2.5 border-b border-[#1A1A1D] px-2 pb-2 pt-[7px] transition-colors focus-visible:outline-offset-0 ${
          hot ? "bg-raised" : ""
        }`}
      >
        <span className={`pt-px text-xs font-semibold ${strong ? "text-accent-text" : "text-faint"}`}>
          {formatRank(rank)}
        </span>
        <span className="flex min-w-0 flex-col gap-1">
          <span className="flex items-baseline justify-between gap-2.5">
            <span className="truncate text-[13px]">{title}</span>
            <span className={`shrink-0 text-[13px] ${strong ? "text-accent-text" : "text-fg"}`}>
              <CountUp value={confidence} delay={fillDelay} />
            </span>
          </span>
          <ConfidenceBar confidence={confidence} variant="rail" enterDelay={fillDelay} />
          <span className="text-[11px] text-faint">{why}</span>
          <span className="sr-only">{scoreBreakdown(hit, semanticOn, query)}</span>
        </span>
      </Link>
      {hot && anchor && (
        // Fixed, just left of the rail: the list scrolls, so a tooltip inside it would be clipped.
        <span
          aria-hidden="true"
          className="pointer-events-none fixed z-40 -translate-x-full -translate-y-1/2 whitespace-nowrap border border-line-strong bg-bg px-2 py-1 text-[11px] text-muted"
          style={{ top: anchor.top, left: anchor.left }}
        >
          {scoreBreakdown(hit, semanticOn, query)}
        </span>
      )}
    </li>
  );
}
