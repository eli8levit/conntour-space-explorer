import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { HistoryItem } from "../components/HistoryItem";
import { LoadMore } from "../components/LoadMore";
import { ListSkeleton } from "../components/Skeleton";
import { useDeleteSearch, useHistory } from "../hooks/searches";

/** "/history": every past search, newest first, 20 at a time (keyset pages). */
export function HistoryPage() {
  const history = useHistory();
  const deleteSearch = useDeleteSearch();
  const items = history.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <section aria-labelledby="history-title">
      <div className="mb-6">
        <h1 id="history-title" className="text-lg font-medium">
          History
        </h1>
        <p className="mt-1 text-xs text-muted">Every search is saved with the results it returned.</p>
      </div>

      {deleteSearch.isError && (
        <p role="alert" className="mb-4 text-sm text-danger">
          Could not delete that search, so it is back in the list.
        </p>
      )}

      {history.isPending && <ListSkeleton />}
      {history.isError && items.length === 0 && (
        <ErrorState title="Could not load history" error={history.error} onRetry={() => void history.refetch()} />
      )}
      {history.isSuccess && items.length === 0 && (
        <EmptyState title="No searches yet">Use the search box above. Each search you run shows up here.</EmptyState>
      )}
      {items.length > 0 && (
        <>
          <ul className="divide-y divide-line border-y border-line">
            {items.map((search) => (
              <HistoryItem key={search.id} search={search} onDelete={deleteSearch.mutate} />
            ))}
          </ul>
          <LoadMore
            hasNextPage={history.hasNextPage}
            isFetchingNextPage={history.isFetchingNextPage}
            failed={history.isFetchNextPageError}
            onLoadMore={history.fetchNextPage}
          />
        </>
      )}
    </section>
  );
}
