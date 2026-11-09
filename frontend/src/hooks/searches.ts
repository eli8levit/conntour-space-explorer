// Data hooks for searches and search history.
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { withViewTransition } from "../lib/viewTransition";
import type { CursorPage, SearchEngine, SearchSummary } from "../api/types";

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
    mutationFn: ({ query, mode }: { query: string; mode: SearchEngine }) => api.runSearch(query, mode),
    onSuccess: (search) => {
      queryClient.setQueryData(searchKey(search.id), search);
      // A new entry exists, so the cached history list is out of date.
      void queryClient.invalidateQueries({ queryKey: historyKey });
      // A new search starts with the full year range: no ?from=&to= carried over.
      // The frames glide from the archive layout into the ranked one (where the browser supports it).
      // The results grid marks itself with its search id once it has rendered the results.
      withViewTransition(
        () => navigate(`/search/${search.id}`),
        () => document.querySelector(`[data-search-id="${search.id}"]`) !== null,
      );
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

/**
 * History list, newest first. Keyset pages: each page returns the cursor for the next one.
 * `find` filters on the server (a substring of the query), so it searches the whole
 * history, not only the loaded pages. While a new filter loads, the previous list stays.
 */
export function useHistory(find = "") {
  return useInfiniteQuery({
    queryKey: [...historyKey, find],
    queryFn: ({ pageParam }) => api.listSearches(pageParam, HISTORY_PAGE_SIZE, find),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor,
    placeholderData: keepPreviousData,
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
      // Every cached list: the unfiltered one and any "find" filter.
      await queryClient.cancelQueries({ queryKey: historyKey });
      const previous = queryClient.getQueriesData<HistoryData>({ queryKey: historyKey });
      queryClient.setQueriesData<HistoryData>({ queryKey: historyKey }, (data) =>
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
      for (const [key, data] of context?.previous ?? []) queryClient.setQueryData(key, data);
    },

    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: searchKey(id) });
    },

    // Success or not, sync with the server (cursors may have moved).
    onSettled: () => queryClient.invalidateQueries({ queryKey: historyKey }),
  });
}
