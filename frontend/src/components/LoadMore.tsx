import { useEffect, useRef } from "react";
import { Button } from "./Button";

interface LoadMoreProps {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  /** The last page request failed: stop auto-loading and let the user retry. */
  failed: boolean;
  onLoadMore: () => unknown;
}

/**
 * Infinite scroll: an invisible line under the list loads the next page when
 * it comes near the viewport. The button is the fallback (keyboard users,
 * browsers without IntersectionObserver, or after an error).
 */
export function LoadMore({ hasNextPage, isFetchingNextPage, failed, onLoadMore }: LoadMoreProps) {
  const sentinel = useRef<HTMLDivElement>(null);
  const autoLoad = hasNextPage && !isFetchingNextPage && !failed;

  useEffect(() => {
    const element = sentinel.current;
    if (!element || !autoLoad || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore();
      },
      // Start 600px before the end, so the next page is usually there before the user is.
      { rootMargin: "600px 0px" },
    );
    observer.observe(element);
    // Re-created after each page: if the line is still in view, it loads one more page.
    return () => observer.disconnect();
  }, [autoLoad, onLoadMore]);

  return (
    <div ref={sentinel} className="mt-8 flex flex-col items-center gap-2">
      {failed && (
        <p role="alert" className="text-xs text-danger">
          Could not load more.
        </p>
      )}
      {hasNextPage ? (
        <Button onClick={() => onLoadMore()} disabled={isFetchingNextPage}>
          {isFetchingNextPage ? "Loading…" : failed ? "Try again" : "Load more"}
        </Button>
      ) : (
        <p className="text-xs text-faint">End of the list</p>
      )}
    </div>
  );
}
