import { useSearchParams } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { Filters } from "../components/Filters";
import { ImageCard } from "../components/ImageCard";
import { ImageGrid } from "../components/ImageGrid";
import { LoadMore } from "../components/LoadMore";
import { GridSkeleton } from "../components/Skeleton";
import { useFacets, useSources } from "../hooks/sources";
import { useImageParam } from "../hooks/useImageParam";
import { isBody } from "../lib/format";

/** "/": every image, 24 at a time as you scroll, filterable by center and body. */
export function BrowsePage() {
  // Filters live in the URL (?center=JPL&body=mars), so a filtered view can be shared and survives reload.
  const [params, setParams] = useSearchParams();
  const center = params.get("center") ?? "";
  const rawBody = params.get("body") ?? "";
  const body = isBody(rawBody) ? rawBody : undefined;

  const facets = useFacets();
  const sources = useSources({ center: center || undefined, body });
  const { imageLink } = useImageParam();

  function changeFilters(next: { center: string; body: string }) {
    setParams(
      (current) => {
        for (const [key, value] of Object.entries(next)) {
          if (value) current.set(key, value);
          else current.delete(key);
        }
        return current;
      },
      // A filter change is not a page change: do not fill Back with every tweak.
      { replace: true },
    );
  }

  const items = sources.data?.pages.flatMap((page) => page.items) ?? [];
  const total = sources.data?.pages[0]?.total;

  return (
    <section aria-labelledby="browse-title">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 id="browse-title" className="text-lg font-medium">
            Browse
          </h1>
          <p className="mt-1 font-mono text-xs text-muted">
            {total === undefined ? " " : `${total} ${total === 1 ? "image" : "images"}`}
          </p>
        </div>
        <Filters facets={facets.data} center={center} body={body ?? ""} onChange={changeFilters} />
      </div>

      {sources.isPending && <GridSkeleton count={10} />}
      {sources.isError && items.length === 0 && (
        <ErrorState title="Could not load images" error={sources.error} onRetry={() => void sources.refetch()} />
      )}
      {sources.isSuccess && items.length === 0 && (
        <EmptyState title="No images match these filters">Try another center, or clear the filters.</EmptyState>
      )}
      {items.length > 0 && (
        <>
          <ImageGrid>
            {items.map((source) => (
              <li key={source.id}>
                <ImageCard source={source} to={imageLink(source.id)} />
              </li>
            ))}
          </ImageGrid>
          <LoadMore
            hasNextPage={sources.hasNextPage}
            isFetchingNextPage={sources.isFetchingNextPage}
            failed={sources.isFetchNextPageError}
            onLoadMore={sources.fetchNextPage}
          />
        </>
      )}
    </section>
  );
}
