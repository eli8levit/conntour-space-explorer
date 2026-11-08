// Data hooks for searches and search history.
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { withViewTransition } from "../lib/viewTransition";
import type { CursorPage, SearchSummary } from "../api/types";

const historyKey = ["history"] as const;

/** Lets other components (the results grid, the dock) see that a search is running. */
export const RUN_SEARCH_KEY = ["runSearch"] as const;

/** History rows per page: the drawer shows "Show 10 older searches". */
export const HISTORY_PAGE_SIZE = 10;
const searchKey = (id: number) => ["search", id] as const;

type HistoryData = InfiniteData<CursorPage<SearchSummary>, string | null>;

/**
 * Runs a new search and opens its results page. Each run is saved by the
 * backend as a history entry. The response already holds the full results,
 * so we put it in the cache: /search/:id then renders at once, with no
 * second request.
 */
export function useRunSearch() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationKey: RUN_SEARCH_KEY,
    mutationFn: (query: string) => api.runSearch(query),
    onSuccess: (search) => {
      queryClient.setQueryData(searchKey(search.id), search);
      // A new entry exists, so the cached history list is out of date.
      void queryClient.invalidateQueries({ queryKey: historyKey });
      // A new search starts with the full year range: no ?from=&to= carried over.
      // The frames glide from the archive layout into the ranked one (where the browser supports it).
      withViewTransition(() => navigate(`/search/${search.id}`));
    },
  });
}

/**
 * A stored search, fresh or from history. Same request either way: it is a
 * snapshot of what the user saw, so it never goes stale. `null` = no search.
 */
export function useSearch(id: number | null) {
  return useQuery({
    queryKey: searchKey(id ?? -1),
    queryFn: () => api.getSearch(id as number),
    enabled: id !== null,
    staleTime: Infinity,
  });
}

/** History list, newest first. Keyset pages: each page returns the cursor for the next one. */
export function useHistory() {
  return useInfiniteQuery({
    queryKey: historyKey,
    queryFn: ({ pageParam }) => api.listSearches(pageParam, HISTORY_PAGE_SIZE),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor,
  });
}

/**
 * Deletes a history entry optimistically: the row disappears at once, and
 * comes back if the server returns an error.
 */
export function useDeleteSearch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteSearch(id),

    onMutate: async (id) => {
      // Stop any history fetch in flight, so it cannot overwrite our optimistic change.
      await queryClient.cancelQueries({ queryKey: historyKey });
      const previous = queryClient.getQueryData<HistoryData>(historyKey);
      queryClient.setQueryData<HistoryData>(historyKey, (data) =>
        data
          ? {
              ...data,
              pages: data.pages.map((page) => ({
                ...page,
                items: page.items.filter((item) => item.id !== id),
              })),
            }
          : data,
      );
      return { previous }; // passed to onError as `context`
    },

    onError: (_error, _id, context) => {
      if (context?.previous) queryClient.setQueryData(historyKey, context.previous);
    },

    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: searchKey(id) });
    },

    // Success or not, sync with the server (cursors may have moved).
    onSettled: () => queryClient.invalidateQueries({ queryKey: historyKey }),
  });
}
