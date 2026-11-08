// Data hooks for images ("sources"). Components never call the API directly:
// they use these hooks, and React Query handles caching, loading and errors.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Source, SourcePage } from "../api/types";
import { api } from "../api/client";
import { byDate } from "../lib/canvas";

/** The archive is small (100 images) and the API allows 100 per page, so one request loads it all. */
export const ARCHIVE_LIMIT = 100;

// Module-level, so React Query sees the same function each render and only
// re-sorts when the data changes (an inline arrow would re-run every time).
const selectArchive = (page: SourcePage) => ({ items: byDate(page.items), total: page.total });

/**
 * Every image, oldest first. The canvas (A1), the set-aside frames (A2), the
 * timelines and the A3 prev/next all read this one cached list.
 */
export function useArchive() {
  return useQuery({
    queryKey: ["sources", "all"],
    queryFn: () => api.listSources({}, ARCHIVE_LIMIT, 0),
    select: selectArchive,
    staleTime: Infinity, // the images only change when the database is reseeded
  });
}

/** One image with full metadata, for the detail modal. `null` id = nothing to load. */
export function useSource(id: number | null) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ["source", id],
    queryFn: () => api.getSource(id as number),
    enabled: id !== null,
    // The archive list already holds the same record, so the modal opens with no wait.
    initialData: (): Source | undefined =>
      queryClient.getQueryData<SourcePage>(["sources", "all"])?.items.find((source) => source.id === id),
  });
}
