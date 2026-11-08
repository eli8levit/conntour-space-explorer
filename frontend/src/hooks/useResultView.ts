import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { SearchHit } from "../api/types";
import { yearOf } from "../lib/format";
import { isStrong } from "../lib/match";
import { inRange, isFullRange, parseYearRange, yearExtent, type YearRange } from "../lib/timeline";
import { useSearch } from "./searches";
import { useArchive } from "./sources";

/**
 * One search as the user currently sees it: its results narrowed to the
 * year range in the URL (?from=&to=), plus the counts the header and rail
 * show. The header, the results page and the image modal all call this, so
 * they always agree (React Query dedupes the requests).
 */
export function useResultView(searchId: number | null) {
  const search = useSearch(searchId);
  const archive = useArchive();
  const [params, setParams] = useSearchParams();

  const extent = useMemo(() => yearExtent(archive.data?.items ?? []), [archive.data]);
  const range = parseYearRange(params, extent);

  // Rank order. The backend already sends it; sorting again means we never depend on that.
  const results = useMemo(
    () => [...(search.data?.results ?? [])].sort((a, b) => a.rank - b.rank),
    [search.data],
  );
  // The range narrows the results only. Ranks keep their numbers, so "04" stays "04".
  const visible: SearchHit[] = results.filter((hit) => inRange(yearOf(hit.source.date_created), range));
  const strongCount = visible.filter((hit) => isStrong(hit.confidence)).length;
  const archiveTotal = archive.data?.total ?? archive.data?.items.length ?? 0;

  /** Changing years replaces the URL entry: dragging a handle must not fill the Back button. */
  const setRange = useCallback(
    (next: YearRange) => {
      setParams(
        (current) => {
          if (isFullRange(next, extent)) {
            current.delete("from");
            current.delete("to");
          } else {
            current.set("from", String(next.from));
            current.set("to", String(next.to));
          }
          return current;
        },
        { replace: true },
      );
    },
    [extent, setParams],
  );

  return {
    search,
    archive,
    extent,
    range,
    setRange,
    results,
    visible,
    strongCount,
    faintCount: visible.length - strongCount,
    setAsideCount: Math.max(0, archiveTotal - visible.length),
    archiveTotal,
  };
}
