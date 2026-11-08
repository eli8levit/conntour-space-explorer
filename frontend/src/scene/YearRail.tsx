// The year rail on the left: the same square-per-image idea and colors as the
// YearTimeline on the search page (HANDOFF §6.4), turned on its side like the
// reference image (newest at the top). Click a year, or drag across years, to
// show only those pins. Arrow keys move the range; Esc clears it.
import { type KeyboardEvent, type PointerEvent, useRef, useState } from "react";
import type { PlaceRow } from "../api/types";
import type { Tier } from "./markers";
import { cssColor } from "./tokens";
import { groupByYear, rangeBetween, type YearRange } from "./years";

/** One row per year: 5px squares on a 7px step, as in the timeline. */
const STEP = 7;
const TIER_ORDER: Record<Tier, number> = { strong: 0, faint: 1, normal: 2, dim: 3 };

interface YearRailProps {
  /** On a phone the card is a bottom sheet over the rail: hide the rail then. */
  hiddenOnPhone: boolean;
  rows: PlaceRow[];
  bounds: YearRange;
  range: YearRange | null;
  onChange: (range: YearRange | null) => void;
  tierOf: (row: PlaceRow) => Tier;
  selectedId: number | null;
}

function squareColor(tier: Tier, selected: boolean): string {
  if (selected) return cssColor("fg");
  if (tier === "strong") return cssColor("accent");
  if (tier === "faint") return cssColor("fg", 0.75);
  if (tier === "dim") return cssColor("line-strong");
  return cssColor("faint", 0.8);
}

export function YearRail({ hiddenOnPhone, rows, bounds, range, onChange, tierOf, selectedId }: YearRailProps) {
  const byYear = groupByYear(rows);
  const years = Array.from({ length: bounds.to - bounds.from + 1 }, (_, i) => bounds.to - i);
  const [drag, setDrag] = useState<{ start: number; end: number } | null>(null);
  const [hoverYear, setHoverYear] = useState<number | null>(null);
  const list = useRef<HTMLDivElement>(null);

  // While dragging, show the range being drawn; otherwise the applied one.
  const shown = drag ? rangeBetween(drag.start, drag.end) : range;
  const inRange = (year: number) => !shown || (year >= shown.from && year <= shown.to);

  const yearAt = (clientY: number) => {
    const top = list.current?.getBoundingClientRect().top ?? 0;
    const index = Math.min(years.length - 1, Math.max(0, Math.floor((clientY - top) / STEP)));
    return years[index] as number;
  };

  const onPointerDown = (e: PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const year = yearAt(e.clientY);
    setDrag({ start: year, end: year });
  };
  const onPointerMove = (e: PointerEvent) => {
    const year = yearAt(e.clientY);
    setHoverYear(year);
    if (drag) setDrag({ ...drag, end: year });
  };
  const onPointerUp = () => {
    if (!drag) return;
    const next = rangeBetween(drag.start, drag.end);
    // Clicking the one year that is already selected clears the filter.
    const same = range && range.from === next.from && range.to === next.to;
    onChange(same ? null : next);
    setDrag(null);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const step = e.key === "ArrowUp" ? 1 : e.key === "ArrowDown" ? -1 : 0;
    if (e.key === "Escape" && range) {
      onChange(null);
      e.stopPropagation();
    }
    if (!step) return;
    e.preventDefault();
    const current = range ?? { from: bounds.to + (step > 0 ? -1 : 1), to: bounds.to + (step > 0 ? -1 : 1) };
    const width = current.to - current.from;
    const from = Math.min(bounds.to - width, Math.max(bounds.from, current.from + step));
    onChange({ from, to: from + width });
  };

  const label = range ? `${range.from} to ${range.to}` : `${bounds.from} to ${bounds.to}`;

  return (
    <div
      className={`absolute bottom-6 left-4 top-14 z-10 select-none flex-col sm:left-8 sm:top-16 sm:flex ${hiddenOnPhone ? "hidden" : "flex"}`}
    >
      <div className="mb-3 flex h-5 items-baseline gap-3 text-[12px]">
        <span className="text-fg">{shown ? `${shown.from} to ${shown.to}` : "All years"}</span>
        {range && (
          <button type="button" onClick={() => onChange(null)} className="text-muted hover:text-fg">
            Reset
          </button>
        )}
      </div>
      <div
        ref={list}
        role="slider"
        tabIndex={0}
        aria-label="Years shown. Click or drag to pick years; arrow keys move them; Escape shows all."
        aria-valuemin={bounds.from}
        aria-valuemax={bounds.to}
        aria-valuenow={range?.to ?? bounds.to}
        aria-valuetext={label}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setHoverYear(null)}
        onKeyDown={onKeyDown}
        className="cursor-pointer touch-none outline-offset-4"
      >
        {years.map((year) => {
          const items = [...(byYear.get(year) ?? [])].sort((a, b) => TIER_ORDER[tierOf(a)] - TIER_ORDER[tierOf(b)]);
          const edge = shown && (year === shown.from || year === shown.to);
          const nearEdge = shown && Math.min(Math.abs(year - shown.from), Math.abs(year - shown.to)) <= 2;
          const showLabel = edge || year === hoverYear || (year % 10 === 0 && !nearEdge);
          return (
            <div key={year} className="flex items-center" style={{ height: STEP, opacity: inRange(year) ? 1 : 0.3 }}>
              <span
                className={`w-9 shrink-0 text-[11px] leading-none ${edge || year === hoverYear ? "text-fg" : "text-faint"}`}
                style={{ visibility: showLabel ? "visible" : "hidden" }}
              >
                {year}
              </span>
              <span className="flex gap-[2px]">
                {items.map((row) => (
                  <span
                    key={row.source_id}
                    className="h-[5px] w-[5px]"
                    style={{ background: squareColor(tierOf(row), row.source_id === selectedId) }}
                  />
                ))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
