import { BrowseCanvas } from "../components/BrowseCanvas";
import { CanvasFrame } from "../components/CanvasFrame";
import { ErrorState } from "../components/ErrorState";
import { SearchDock } from "../components/SearchDock";
import { useArchive } from "../hooks/sources";
import { useImageParam } from "../hooks/useImageParam";
import { formatPlate, spanFor } from "../lib/canvas";

// While loading: the same canvas, as grey blocks at their final sizes (no spinners).
const PLACEHOLDER_IDS = Array.from({ length: 100 }, (_, index) => index + 1);

/** "/" (A1): the whole archive as one drifting canvas, with the search dock at the bottom. */
export function BrowsePage() {
  const archive = useArchive();
  const { imageLink } = useImageParam();

  return (
    <main>
      <h1 className="sr-only">The archive: every image, oldest first</h1>
      <BrowseCanvas>
        {archive.data
          ? archive.data.items.map((source, index) => (
              <CanvasFrame
                key={source.id}
                source={source}
                span={spanFor(source.id)}
                plate={formatPlate(index + 1)}
                to={imageLink(source.id)}
              />
            ))
          : PLACEHOLDER_IDS.map((id) => {
              const [cols, rows] = spanFor(id);
              return (
                <li key={id} aria-hidden="true" className="bg-raised" style={{ gridColumn: `span ${cols}`, gridRow: `span ${rows}` }} />
              );
            })}
      </BrowseCanvas>

      <div className="fixed bottom-4 left-1/2 z-20 w-[min(680px,calc(100vw-32px))] -translate-x-1/2 sm:bottom-9">
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
