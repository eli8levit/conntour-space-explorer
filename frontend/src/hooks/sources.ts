// Data hooks for images ("sources"). Components never call the API directly:
// they use these hooks, and React Query handles caching, loading and errors.
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api, type SourceFilters } from "../api/client";

export const PAGE_SIZE = 24;

/** Browse grid: pages of 24, offset-based (the image set is small and does not change). */
export function useSources(filters: SourceFilters) {
  return useInfiniteQuery({
    // Filters are part of the key, so each filter combination has its own cache.
    queryKey: ["sources", filters],
    queryFn: ({ pageParam }) => api.listSources(filters, PAGE_SIZE, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((count, page) => count + page.items.length, 0);
      return loaded < lastPage.total ? loaded : undefined;
    },
  });
}

/** One image with full metadata, for the detail modal. `null` id = nothing to load. */
export function useSource(id: number | null) {
  return useQuery({
    queryKey: ["source", id],
    queryFn: () => api.getSource(id as number),
    enabled: id !== null,
  });
}

/** Filter options with counts (centers and bodies). */
export function useFacets() {
  return useQuery({
    queryKey: ["facets"],
    queryFn: api.getFacets,
    staleTime: Infinity, // facets only change when the database is reseeded
  });
}

/** "More like this": nearest images by embedding. */
export function useSimilar(id: number | null) {
  return useQuery({
    queryKey: ["similar", id],
    queryFn: () => api.getSimilar(id as number),
    enabled: id !== null,
  });
}
