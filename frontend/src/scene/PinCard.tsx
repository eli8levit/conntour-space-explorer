// The HTML card for the active pin, or the list for an open cluster.
// It is HTML (not 3D) so it is readable, accessible and selectable.
import { Link } from "react-router-dom";
import type { PlaceRow } from "../api/types";
import { bodyLabel, provenanceLabel } from "../lib/format";
import { tierColor } from "./MarkerLayer";
import { mainLabel, tierOf } from "./markers";
import { cssColor, type Palette } from "./tokens";

/** "25 Jun 2018", in UTC (NASA dates are midnight UTC). */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function formatDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "−5.20°, 138.13°" with a real minus sign (U+2212), as in the A3 modal. */
export function formatLatLon(lat: number, lon: number): string {
  const f = (v: number) => `${v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)}°`;
  return `${f(lat)}, ${f(lon)}`;
}

/** Honest copy for places that have no real coordinates. */
const PLACEMENT_NOTE: Partial<Record<PlaceRow["body"], string>> = {
  orbit: "Taken in orbit. There is no ground spot, so photos are spaced along the ring.",
  deep_space: "Placed by its target's name, not by coordinates.",
};

const shell =
  "absolute z-10 border-line-strong bg-surface/95 backdrop-blur-sm inset-x-0 bottom-0 max-h-[52%] overflow-y-auto border-t " +
  "sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[340px] sm:max-h-[calc(100%-48px)] sm:border";

function CloseButton({ onClose, label }: { onClose: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label={label}
      className="flex h-8 w-8 shrink-0 items-center justify-center border border-line-strong text-muted hover:text-fg"
    >
      ×
    </button>
  );
}

interface PinCardProps {
  row: PlaceRow;
  confidence: number | undefined;
  onClose: () => void;
  /** Present when the pin is part of an open cluster: go back to the list. */
  onBack?: () => void;
}

export function PinCard({ row, confidence, onClose, onBack }: PinCardProps) {
  const strong = confidence !== undefined && confidence >= 0.5;
  return (
    <section aria-label={`${row.title}, place`} className={shell}>
      <div className="relative h-36 w-full bg-raised sm:h-auto sm:aspect-[16/10]">
        <img src={row.thumb_url} alt="" className="h-full w-full object-cover" />
      </div>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[13px] text-muted">
            {row.label}, {bodyLabel(row.body)}
          </p>
          <CloseButton onClose={onClose} label="Close card" />
        </div>
        <h2 className="line-clamp-3 text-[17px] leading-snug text-fg">{row.title}</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[12px]">
          <dt className="text-muted">Taken</dt>
          <dd>{formatDay(row.date_created)}</dd>
          {row.lat !== null && row.lon !== null && (
            <>
              <dt className="text-muted">Where</dt>
              <dd>{formatLatLon(row.lat, row.lon)}</dd>
            </>
          )}
          <dt className="text-muted">How we know</dt>
          <dd className="text-faint">{provenanceLabel(row.provenance)}</dd>
          {confidence !== undefined && (
            <>
              <dt className="text-muted">Match</dt>
              <dd style={{ color: strong ? cssColor("accent-text") : undefined }}>{Math.round(confidence * 100)}%</dd>
            </>
          )}
        </dl>
        {PLACEMENT_NOTE[row.body] && <p className="text-[12px] text-faint">{PLACEMENT_NOTE[row.body]}</p>}
        <div className="flex items-center gap-3">
          <Link
            to={`/?image=${row.source_id}`}
            className="border border-line-strong px-3 py-2 text-[13px] text-fg hover:border-fg"
          >
            Open details →
          </Link>
          {onBack && (
            <button type="button" onClick={onBack} className="text-[13px] text-muted hover:text-fg">
              Back to the list
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

interface ClusterCardProps {
  rows: PlaceRow[];
  confidences: Map<number, number> | null;
  palette: Palette;
  onPick: (row: PlaceRow) => void;
  onClose: () => void;
}

export function ClusterCard({ rows, confidences, palette, onPick, onClose }: ClusterCardProps) {
  return (
    <section aria-label="Images at this spot" className={shell}>
      <div className="flex items-start justify-between gap-3 p-4 pb-2">
        <div>
          <h2 className="text-[15px] text-fg">
            {rows.length} images near {mainLabel(rows)}
          </h2>
          <p className="mt-1 text-[12px] text-faint">Spread out on the map. Pick one to see it.</p>
        </div>
        <CloseButton onClose={onClose} label="Close list" />
      </div>
      <ul className="pb-2">
        {rows.map((row) => (
          <li key={row.source_id}>
            <button
              type="button"
              onClick={() => onPick(row)}
              className="flex w-full items-center gap-3 px-4 py-1.5 text-left hover:bg-raised"
            >
              <img src={row.thumb_url} alt="" loading="lazy" className="h-9 w-9 shrink-0 bg-raised object-cover" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-fg">{row.title}</span>
                <span className="block truncate text-[12px] text-faint">
                  {new Date(row.date_created).getUTCFullYear()} · {row.label}
                </span>
              </span>
              {confidences && (
                <span
                  aria-hidden
                  className="h-[6px] w-[6px] shrink-0"
                  style={{ background: `#${tierColor(tierOf(row.source_id, confidences), palette).getHexString()}` }}
                />
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
