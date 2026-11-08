// Data hooks for searches and search history.
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { api } from "../api/client";
import type { CursorPage, SearchSummary } from "../api/types";

const historyKey = ["history"] as const;
const searchKey = (id: number) => ["search", id] as const;

type HistoryData = InfiniteData<CursorPage<SearchSummary>, string | null>;

/**
 * Runs a new search. Each run is saved by the backend as a history entry.
 * The response already holds the full results, so we put it in the cache:
 * the results page then renders at once, with no second request.
 */
export function useRunSearch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (query: string) => api.runSearch(query),
    onSuccess: (search) => {
      queryClient.setQueryData(searchKey(search.id), search);
      // A new entry exists, so the cached history list is out of date.
      void queryClient.invalidateQueries({ queryKey: historyKey });
    },
  });
}

/** A stored search (fresh or from history). It is a snapshot, so it never goes stale. */
export function useSearch(id: number) {
  return useQuery({
    queryKey: searchKey(id),
    queryFn: () => api.getSearch(id),
    staleTime: Infinity,
  });
}

/** History list, newest first. Keyset pages: each page returns the cursor for the next one. */
export function useHistory() {
  return useInfiniteQuery({
    queryKey: historyKey,
    queryFn: ({ pageParam }) => api.listSearches(pageParam),
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
