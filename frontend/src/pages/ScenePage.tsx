// "/scene": the "Where in space" 3D view (the special feature).
// App.tsx loads this page with React.lazy, so three.js lands in its own chunk
// and never slows down Browse, Search or History.
//
// URL hooks (HANDOFF §9):
//   ?focus=<source_id>   fly to that pin and open its card (the A3 "Fly there" link)
//   ?search=<search_id>  light the results of a stored search (strong orange, faint white), dim the rest
import { Component, type ReactNode, useCallback, useLayoutEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { describeError } from "../api/client";
import { usePlaces } from "../hooks/places";
import { useSearch } from "../hooks/searches";
import { useArchive } from "../hooks/sources";
import { displayTitle } from "../lib/displayTitle";
import { parseId } from "../lib/ids";
import { type SceneSearch, SpaceScene } from "../scene/SpaceScene";

/** The scene page fills the viewport under the app header, over a fine dot grid (the reference's texture). */
const FRAME_STYLE = {
  backgroundColor: "rgb(var(--color-bg, 9 9 10))",
  backgroundImage: "radial-gradient(rgb(var(--color-line-strong, 42 42 46)) 0.8px, transparent 1.2px)",
  backgroundSize: "6px 6px",
};

/**
 * Where the app header ends. The design says 64px, but the header can wrap on a
 * phone, so we measure it (and follow its resizes) instead of hardcoding it.
 */
function useHeaderBottom(): number {
  const [bottom, setBottom] = useState(64);
  useLayoutEffect(() => {
    const header = document.querySelector("header");
    if (!header) return;
    const measure = () => setBottom(header.getBoundingClientRect().bottom);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);
  return bottom;
}

function Message({ children }: { children: ReactNode }) {
  return <div className="absolute inset-0 flex items-center justify-center p-8 text-center text-[13px] text-muted">{children}</div>;
}

/** WebGL can be switched off or missing. Then say so instead of showing a blank page. */
class WebGLBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return <Message>This browser can't draw the 3D view (WebGL is off or not supported). Browse and search still work.</Message>;
    return this.props.children;
  }
}

export default function ScenePage() {
  const [params, setParams] = useSearchParams();
  const focusId = parseId(params.get("focus"));
  const searchId = parseId(params.get("search"));

  const headerBottom = useHeaderBottom();
  const places = usePlaces();
  const search = useSearch(searchId);
  const archive = useArchive();

  // Each pin shows the hand-written short title. For a pin without one, the places list has no
  // caption to derive a title from, so we take it from the archive (already cached by the other
  // pages) and keep the NASA title until it loads.
  const rows = useMemo(() => {
    if (!places.data) return places.data;
    const titles = new Map(archive.data?.items.map((source) => [source.id, displayTitle(source)]));
    return places.data.map((row) => ({ ...row, title: row.short_title || titles.get(row.source_id) || row.title }));
  }, [places.data, archive.data]);

  const sceneSearch = useMemo<SceneSearch | null>(() => {
    if (!search.data) return null;
    const confidences = new Map(search.data.results.map((hit) => [hit.source.id, hit.confidence]));
    return { query: search.data.query, confidences };
  }, [search.data]);

  // Changing the active pin replaces the URL entry: Back leaves the scene, it does not replay clicks.
  const setParam = useCallback(
    (name: string, value: number | null) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value === null) next.delete(name);
          else next.set(name, String(value));
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );
  const onFocus = useCallback((id: number | null) => setParam("focus", id), [setParam]);
  const onClearSearch = useCallback(() => setParam("search", null), [setParam]);

  return (
    <section aria-label="Where in space" className="fixed inset-x-0 bottom-0 overflow-hidden" style={{ ...FRAME_STYLE, top: headerBottom }}>
      {/* Wait for the archive too (usually cached), so pins never flash raw IDs as titles. */}
      {places.isPending || archive.isPending ? (
        <Message>Loading the map of places…</Message>
      ) : places.isError ? (
        <Message>
          <span>
            Can't reach the archive. {describeError(places.error)}{" "}
            <button type="button" onClick={() => void places.refetch()} className="text-fg underline underline-offset-4">
              Try again
            </button>
          </span>
        </Message>
      ) : (
        <WebGLBoundary>
          <SpaceScene
            rows={rows ?? places.data}
            search={sceneSearch}
            onClearSearch={onClearSearch}
            focusId={focusId}
            onFocus={onFocus}
          />
          {searchId !== null && search.isError && (
            <p className="absolute right-4 top-10 z-10 text-[12px] text-faint sm:right-8">That search is not in the history any more.</p>
          )}
        </WebGLBoundary>
      )}
    </section>
  );
}
