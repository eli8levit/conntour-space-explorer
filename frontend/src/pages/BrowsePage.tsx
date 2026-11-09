import { useSearchParams } from "react-router-dom";
import { BrowseCanvas } from "../components/BrowseCanvas";
import { ErrorState } from "../components/ErrorState";
import { SearchDock } from "../components/SearchDock";
import { useArchive } from "../hooks/sources";
import { useImageParam } from "../hooks/useImageParam";

const NO_SOURCES: never[] = [];

/** "/" (A1): the whole archive as one endless canvas, with the search dock at the bottom. */
export function BrowsePage() {
  const archive = useArchive();
  const { imageId, imageLink } = useImageParam();
  const [searchParams] = useSearchParams();
  // The canvas stops while the image dialog or the history drawer covers it.
  const covered = imageId !== null || searchParams.get("history") === "1";

  return (
    <main>
      <h1 className="sr-only">The archive: every image</h1>
      <BrowseCanvas sources={archive.data?.items ?? NO_SOURCES} imageLink={imageLink} paused={covered} />

      <div className="vt-dock fixed bottom-4 left-1/2 z-20 w-[min(680px,calc(100vw-32px))] -translate-x-1/2 sm:bottom-9">
        {archive.isError && (
          <ErrorState
            className="mb-6"
            title="Can't reach the archive."
            message="Check that the backend is running, then reload."
            onRetry={() => void archive.refetch()}
          />
        )}
        <SearchDock variant="browse" />
      </div>
    </main>
  );
}
