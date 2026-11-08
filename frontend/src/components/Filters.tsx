import type { Facets } from "../api/types";
import { bodyLabel } from "../lib/format";

interface FiltersProps {
  facets: Facets | undefined;
  center: string; // "" = all
  body: string; // "" = all
  onChange: (next: { center: string; body: string }) => void;
}

const SELECT_CLASSES =
  "rounded-sm border border-line-strong bg-surface px-2 py-1.5 text-sm text-fg hover:border-fg";

/**
 * Center and body filters. Native <select>s: accessible and mobile-friendly
 * out of the box. Options come from the facets endpoint, with counts.
 */
export function Filters({ facets, center, body, onChange }: FiltersProps) {
  const active = center !== "" || body !== "";
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-xs text-muted">
        Center
        <select
          className={SELECT_CLASSES}
          value={center}
          onChange={(event) => onChange({ center: event.target.value, body })}
        >
          <option value="">All centers</option>
          {facets?.centers.map((facet) => (
            <option key={facet.value} value={facet.value}>
              {facet.value} ({facet.count})
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs text-muted">
        Where
        <select
          className={SELECT_CLASSES}
          value={body}
          onChange={(event) => onChange({ center, body: event.target.value })}
        >
          <option value="">Anywhere</option>
          {facets?.bodies.map((facet) => (
            <option key={facet.value} value={facet.value}>
              {bodyLabel(facet.value)} ({facet.count})
            </option>
          ))}
        </select>
      </label>

      {active && (
        <button
          type="button"
          className="py-1.5 text-sm text-muted underline-offset-4 hover:text-fg hover:underline"
          onClick={() => onChange({ center: "", body: "" })}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
