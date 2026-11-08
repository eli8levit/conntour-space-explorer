import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../api/client";
import type { SearchDetail } from "../api/types";
import { Button } from "../components/Button";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { ImageCard } from "../components/ImageCard";
import { ImageGrid } from "../components/ImageGrid";
import { GridSkeleton } from "../components/Skeleton";
import { useDeleteSearch, useRunSearch, useSearch } from "../hooks/searches";
import { useImageParam } from "../hooks/useImageParam";
import { formatRelativeTime } from "../lib/format";
import { queryTerms } from "../lib/highlight";
import { parseId } from "../lib/ids";

// Offered when a search finds nothing: queries we know this collection answers.
const SUGGESTIONS = ["Mars rover", "Space Shuttle launch", "astronaut spacewalk", "Saturn rings"];

/**
 * "/search/:id": one search's results. The same page serves a search that
 * just ran (already in the cache, no request) and one opened from history
 * (loads the stored snapshot).
 */
export function SearchResultsPage() {
  const id = parseId(useParams().id);
  const search = useSearch(id);

  if (id === null || (search.error instanceof ApiError && search.error.status === 404)) {
    return (
      <EmptyState title="This search does not exist">
        It may have been deleted.{" "}
        <Link to="/history" className="underline underline-offset-4 hover:text-fg">
          Back to history
        </Link>
      </EmptyState>
    );
  }
  if (search.isPending) return <GridSkeleton />;
  if (search.isError) {
    return <ErrorState title="Could not load this search" error={search.error} onRetry={() => void search.refetch()} />;
  }
  return <SearchResults search={search.data} />;
}

function SearchResults({ search }: { search: SearchDetail }) {
  const navigate = useNavigate();
  const deleteSearch = useDeleteSearch();
  const { imageLink } = useImageParam();

  // The backend returns rank order already; we sort again so the page never depends on that.
  const results = [...search.results].sort((a, b) => b.confidence - a.confidence);
  const terms = queryTerms(search.query);
  const semanticOn = search.engine === "hybrid";

  function handleDelete() {
    // Optimistic: the history list drops the row at once, so we can leave right away.
    deleteSearch.mutate(search.id);
    navigate("/history");
  }

  return (
    <section aria-labelledby="results-title">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 id="results-title" className="break-words text-lg font-medium">
            “{search.query}”
          </h1>
          <p className="mt-1 font-mono text-xs text-muted">
            {results.length === 1 ? "1 result" : `${results.length} results`} ·{" "}
            <time dateTime={search.created_at}>{formatRelativeTime(search.created_at)}</time>
          </p>
        </div>
        <Button onClick={handleDelete}>Delete from history</Button>
      </div>

      {!semanticOn && (
        <p className="mb-6 rounded-sm border border-line px-3 py-2 text-xs text-muted">
          Semantic search is off (the language model did not load). Results match exact words only.
        </p>
      )}

      {results.length === 0 ? (
        <NoMatches query={search.query} />
      ) : (
        <ImageGrid>
          {results.map((hit) => (
            <li key={hit.source.id}>
              <ImageCard source={hit.source} to={imageLink(hit.source.id)} hit={hit} semanticOn={semanticOn} terms={terms} />
            </li>
          ))}
        </ImageGrid>
      )}
    </section>
  );
}

function NoMatches({ query }: { query: string }) {
  const runSearch = useRunSearch();
  return (
    <EmptyState title={`No strong matches for “${query}”`}>
      <p>Nothing in this collection scored above the confidence threshold. Try fewer or broader words, or one of these:</p>
      <ul className="mt-4 flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((suggestion) => (
          <li key={suggestion}>
            <Button disabled={runSearch.isPending} onClick={() => runSearch.mutate(suggestion)}>
              {suggestion}
            </Button>
          </li>
        ))}
      </ul>
    </EmptyState>
  );
}
