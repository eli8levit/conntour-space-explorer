import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { Source } from "../api/types";
import { displayTitle } from "../lib/displayTitle";
import { formatPercent } from "../lib/format";
import { inRange, isFullRange, layoutSquares, type Square, type YearRange } from "../lib/timeline";

interface YearTimelineProps {
  /** Every image in the archive: one square each. */
  sources: Source[];
  /** Confidence of each result, by image id. Images not in here are non-matches. */
  confidenceById: ReadonlyMap<number, number>;
  extent: YearRange;
  range: YearRange;
  onRangeChange: (range: YearRange) => void;
  /** The frame or rail row under the pointer: its square gets an outline. */
  hotId: number | null;
  onOpen: (id: number) => void;
}

const SQUARE_HEIGHT = 5;
const SQUARE_STEP = 7;
const STRIP_HEIGHT = 72;

const SQUARE_COLOR = { strong: "bg-accent", faint: "bg-fg/75", none: "bg-line-strong" } as const;

/**
 * §6.4: "When these were taken". Each image is one small square in its year
 * column; matches are lit. Two handles narrow the results by year. The
 * squares are positioned in % of the width, so the strip needs no measuring
 * to lay out; only dragging reads the pixel width.
 */
export function YearTimeline({ sources, confidenceById, extent, range, onRangeChange, hotId, onOpen }: YearTimelineProps) {
  const strip = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<Square | null>(null);
  const span = extent.to - extent.from + 1; // columns, one per year
  const squares = useMemo(() => layoutSquares(sources, confidenceById), [sources, confidenceById]);
  const byId = useMemo(() => new Map(sources.map((source) => [source.id, source])), [sources]);
  const full = isFullRange(range, extent);

  const left = (year: number) => `${((year - extent.from) / span) * 100}%`;

  /** The year column under a pointer x position. */
  function yearAt(clientX: number): number {
    const rect = strip.current!.getBoundingClientRect();
    const column = Math.floor(((clientX - rect.left) / rect.width) * span);
    return extent.from + Math.min(span - 1, Math.max(0, column));
  }

  function setEdge(edge: "from" | "to", year: number) {
    // The two handles cannot cross: "from" stays at or before "to".
    const next = edge === "from" ? { from: Math.min(year, range.to), to: range.to } : { from: range.from, to: Math.max(year, range.from) };
    if (next.from !== range.from || next.to !== range.to) onRangeChange(next);
  }

  const lit = squares.filter((square) => square.kind !== "none");
  const strongYears = [...new Set(lit.filter((square) => square.kind === "strong").map((square) => square.year))].sort();
  const summary =
    `Archive timeline ${extent.from} to ${extent.to}. ${lit.length} matching images are lit` +
    (strongYears.length > 0 ? `: strong matches in ${strongYears.join(", ")}.` : ".");

  const hoverSource = hover ? byId.get(hover.sourceId) : undefined;

  return (
    <section aria-label="Filter results by year" className="flex flex-col gap-2 px-0.5">
      <div className="flex items-baseline justify-between gap-6">
        <p className="text-[13px] text-muted">
          <span className="text-fg">When these were taken.</span> Each square is one image. Drag the handles to narrow by
          year.
        </p>
        <p className="flex shrink-0 items-baseline gap-4 text-[13px]">
          <span>
            {range.from} to {range.to}
          </span>
          {!full && (
            <button type="button" onClick={() => onRangeChange(extent)} className="text-xs text-muted underline underline-offset-2 hover:text-fg">
              Reset years
            </button>
          )}
        </p>
      </div>

      <div ref={strip} className="relative border-b border-line-strong" style={{ height: STRIP_HEIGHT }}>
        <div role="img" aria-label={summary} className="absolute inset-0">
          {squares.map((square) => {
            const isLit = square.kind !== "none";
            return (
              <span
                key={square.sourceId}
                onPointerEnter={() => setHover(square)}
                onPointerLeave={() => setHover(null)}
                onClick={isLit ? () => onOpen(square.sourceId) : undefined}
                className={`absolute ${SQUARE_COLOR[square.kind]} ${isLit ? "cursor-pointer" : ""} ${
                  inRange(square.year, range) ? "" : "opacity-30"
                } ${hotId === square.sourceId ? "outline outline-1 outline-offset-1 outline-fg" : ""}`}
                style={{
                  left: `calc(${left(square.year)} + 1px)`,
                  width: `calc(${100 / span}% - 3px)`,
                  bottom: square.stack * SQUARE_STEP + 1,
                  height: SQUARE_HEIGHT,
                }}
              />
            );
          })}
        </div>

        <Handle edge="from" year={range.from} position={left(range.from)} extent={extent} onMove={setEdge} yearAt={yearAt} />
        <Handle edge="to" year={range.to} position={left(range.to + 1)} extent={extent} onMove={setEdge} yearAt={yearAt} />

        {hover && hoverSource && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap bg-bg px-2 py-1 text-[11px] text-fg shadow-toast"
            style={{ left: `calc(${left(hover.year)} + ${50 / span}%)`, bottom: hover.stack * SQUARE_STEP + 14 }}
          >
            {displayTitle(hoverSource)} · {hover.year}
            {hover.confidence !== null && ` · ${formatPercent(hover.confidence)}`}
          </span>
        )}
      </div>

      <div className="relative h-4" aria-hidden="true">
        {decadeTicks(extent).map((year) => (
          <span key={year} className="absolute top-0 text-xs text-faint" style={{ left: left(year) }}>
            {year}
          </span>
        ))}
      </div>
    </section>
  );
}

/** 1950, 1960 … 2020: decades inside the archive span. */
function decadeTicks(extent: YearRange): number[] {
  const ticks: number[] = [];
  for (let year = Math.ceil(extent.from / 10) * 10; year <= extent.to; year += 10) ticks.push(year);
  return ticks;
}

interface HandleProps {
  edge: "from" | "to";
  year: number;
  /** CSS left of the handle line. */
  position: string;
  extent: YearRange;
  onMove: (edge: "from" | "to", year: number) => void;
  yearAt: (clientX: number) => number;
}

/**
 * A range handle: a 2px line with a 12×22 grab knob. It is a real slider for
 * keyboards and screen readers (←/→ move one year); drag snaps to whole years.
 */
function Handle({ edge, year, position, extent, onMove, yearAt }: HandleProps) {
  const dragging = useRef(false);

  function onPointerDown(event: PointerEvent<HTMLSpanElement>) {
    dragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function onPointerMove(event: PointerEvent) {
    if (dragging.current) onMove(edge, yearAt(event.clientX));
  }
  function onKeyDown(event: KeyboardEvent) {
    const step = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[event.key];
    if (step === undefined) return;
    event.preventDefault(); // keep ↑/↓ from also stepping through the results
    event.stopPropagation();
    onMove(edge, Math.min(extent.to, Math.max(extent.from, year + step)));
  }

  return (
    <span
      role="slider"
      tabIndex={0}
      aria-label={edge === "from" ? "Earliest year" : "Latest year"}
      aria-valuemin={extent.from}
      aria-valuemax={extent.to}
      aria-valuenow={year}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => (dragging.current = false)}
      onKeyDown={onKeyDown}
      // A wide invisible hit area around the thin line, so it is easy to grab.
      className="absolute -bottom-1.5 z-10 h-[84px] w-4 -translate-x-1/2 cursor-ew-resize touch-none focus-visible:outline-offset-0"
      style={{ left: position }}
    >
      <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-fg" />
      <span className="absolute bottom-[30px] left-1/2 h-[22px] w-3 -translate-x-1/2 rounded-handle bg-fg" />
    </span>
  );
}
