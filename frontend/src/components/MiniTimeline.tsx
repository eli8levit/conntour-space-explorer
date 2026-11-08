import { useMemo } from "react";
import type { Source } from "../api/types";
import { yearOf } from "../lib/format";
import { layoutSquares, type YearRange } from "../lib/timeline";

interface MiniTimelineProps {
  sources: Source[];
  extent: YearRange;
  current: Source;
}

/**
 * A3·11: "Its place in time". The same square-per-image strip as the A2
 * timeline, small and grey, with only this image lit and a marker at its year.
 */
export function MiniTimeline({ sources, extent, current }: MiniTimelineProps) {
  const span = extent.to - extent.from + 1;
  const year = yearOf(current.date_created);
  // The current image counts as the "best match", so it sits on the baseline of its column.
  const squares = useMemo(() => layoutSquares(sources, new Map([[current.id, 1]])), [sources, current.id]);
  const left = (y: number) => `${((y - extent.from) / span) * 100}%`;
  const marker = `calc(${left(year)} + ${50 / span}%)`;
  // The year label is centred on the marker, except at the ends where it would stick out of the strip.
  const fraction = (year - extent.from + 0.5) / span;
  const labelShift = fraction > 0.93 ? "-translate-x-full" : fraction < 0.07 ? "" : "-translate-x-1/2";
  const ticks = [extent.from, 1980, 2000, extent.to].filter((tick) => tick >= extent.from && tick <= extent.to);

  return (
    <div>
      <div
        role="img"
        aria-label={`Archive timeline ${extent.from} to ${extent.to} with this ${year} image lit`}
        className="relative mt-2.5 h-[52px] border-b border-line-strong"
      >
        {squares.map((square) => (
          <span
            key={square.sourceId}
            className={`absolute h-[3px] ${square.sourceId === current.id ? "bg-accent" : "bg-line-strong"}`}
            style={{
              left: left(square.year),
              width: `max(1px, calc(${100 / span}% - 1px))`,
              bottom: square.stack * 4 + 1,
            }}
          />
        ))}
        <span className="absolute bottom-0 h-10 w-px bg-accent" style={{ left: marker }} />
        <span
          className={`absolute -top-1.5 ${labelShift} bg-[#0D0D0F] px-[3px] text-[11px] leading-none text-accent-text`}
          style={{ left: marker }}
        >
          {year}
        </span>
      </div>
      <div className="relative mt-1.5 h-3.5 text-[11px] text-faint" aria-hidden="true">
        {ticks.map((tick, index) => (
          <span
            key={tick}
            className={`absolute top-0 ${index === 0 ? "" : index === ticks.length - 1 ? "-translate-x-full" : "-translate-x-1/2"}`}
            style={{ left: index === ticks.length - 1 ? "100%" : left(tick) }}
          >
            {tick}
          </span>
        ))}
      </div>
    </div>
  );
}
