import { useIsMutating } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../api/client";
import type { Source } from "../api/types";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { ChevronIcon } from "../components/Icons";
import { RankRail } from "../components/RankRail";
import { ResultFrame, SetAsideFrame } from "../components/ResultFrame";
import { SearchDock } from "../components/SearchDock";
import { YearTimeline } from "../components/YearTimeline";
import { RUN_SEARCH_KEY } from "../hooks/searches";
import { OPENED_IN_APP, useImageParam } from "../hooks/useImageParam";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useResultView } from "../hooks/useResultView";
import { parseId } from "../lib/ids";

/**
 * "/search/:id" (A2): the archive reflowed by rank. Rank 1 is the biggest
 * frame, frames shrink as confidence drops, and everything that did not
 * match is set aside in grey. The same page serves a search that just ran
 * (already in the cache) and one reopened from history (the stored snapshot).
 */
export function SearchResultsPage() {
  const id = parseId(useParams().id);
  const view = useResultView(id);
  const { search } = view;

  if (id === null || (search.error instanceof ApiError && search.error.status === 404)) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <EmptyState title="This search does not exist.">
          It may have been deleted.{" "}
          <Link to="/" className="text-fg underline underline-offset-2">
            Back to the archive
          </Link>
        </EmptyState>
      </main>
    );
  }
  if (search.isError) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <ErrorState title="Could not load this search." error={search.error} onRetry={() => void search.refetch()} />
      </main>
    );
  }
  return <SearchResults view={view} />;
}

function SearchResults({ view }: { view: ReturnType<typeof useResultView> }) {
  const { search, archive, visible, results, extent, range, setRange } = view;
  const navigate = useNavigate();
  const { imageLink } = useImageParam();
  const wide = useMediaQuery("(min-width: 1024px)");
  const [hotId, setHotId] = useState<number | null>(null);
  const [railOpen, setRailOpen] = useState(true);
  // A new search from this page is running: keep the old results, at half strength.
  const running = useIsMutating({ mutationKey: RUN_SEARCH_KEY }) > 0;
  useResultKeys(navigate);

  const data = search.data;
  const loading = !data;
  const semanticOn = data?.engine !== "keyword";
  const query = data?.query ?? "";

  // Every image not shown as a result stays on the page, set aside.
  const visibleIds = useMemo(() => new Set(visible.map((hit) => hit.source.id)), [visible]);
  const setAside: Source[] = (archive.data?.items ?? []).filter((source) => !visibleIds.has(source.id));
  const confidenceById = useMemo(
    () => new Map(results.map((hit) => [hit.source.id, hit.confidence] as const)),
    [results],
  );
  const openImage = (id: number) => navigate(imageLink(id), { state: OPENED_IN_APP });
  const showRail = railOpen || !wide;
  const dock = useRef<HTMLDivElement>(null);
  const dockHeight = useElementHeight(dock, wide);

  const timeline = archive.data && (
    <YearTimeline
      sources={archive.data.items}
      confidenceById={confidenceById}
      extent={extent}
      range={range}
      onRangeChange={setRange}
      hotId={hotId}
      onOpen={openImage}
    />
  );

  return (
    <main className={wide ? "" : "min-h-screen pb-28 pt-[88px]"}>
      <h1 className="sr-only">Results for “{query}”</h1>

      {/* On wide screens the results scroll in their own area, which ends above the pinned
          timeline and search box: no result can hide under them, and the set-aside frames
          continue below the results. The bottom edge fades, so frames pass under it softly. */}
      <div
        data-results-scroll={wide ? "" : undefined}
        className={
          wide
            ? `results-scroll fixed left-0 top-16 overflow-y-auto overscroll-contain pb-10 pt-6 ${showRail ? "right-[344px]" : "right-0"}`
            : ""
        }
        style={wide ? { bottom: dockHeight + 24 + 10 } : undefined}
      >
      <ul
        aria-label="Results, largest first"
        className={`mx-4 grid max-w-[1016px] grid-flow-row-dense auto-rows-[84px] grid-cols-4 gap-2 transition-opacity duration-300 sm:ml-12 sm:mr-8 sm:auto-rows-[100px] sm:grid-cols-[repeat(auto-fill,minmax(112px,1fr))] ${
          running || loading ? "opacity-50" : ""
        } ${wide && !showRail ? "sm:max-w-none" : ""}`}
      >
        {visible.map((hit) => (
          <ResultFrame
            key={hit.source.id}
            hit={hit}
            to={imageLink(hit.source.id)}
            semanticOn={semanticOn}
            hot={hotId === hit.source.id}
            onHot={setHotId}
          />
        ))}
        {setAside.map((source) => (
          <SetAsideFrame key={source.id} source={source} to={imageLink(source.id)} />
        ))}
      </ul>
      </div>

      {!wide && <div className="mx-4 mt-8">{timeline}</div>}

      {showRail && (
        <RankRail
          hits={visible}
          query={query}
          semanticOn={semanticOn}
          hotId={hotId}
          onHot={setHotId}
          linkFor={imageLink}
          onCollapse={wide ? () => setRailOpen(false) : undefined}
          empty={
            <RailEmpty
              loading={loading}
              query={query}
              archiveTotal={view.archiveTotal}
              hidden={results.length}
              onReset={() => setRange(extent)}
            />
          }
          className={
            wide ? "vt-rail fixed bottom-0 right-0 top-16 z-20 w-[344px] border-l border-line" : "mx-4 mt-8 border-t border-line !px-0"
          }
        />
      )}
      {wide && !showRail && (
        <button
          type="button"
          onClick={() => setRailOpen(true)}
          aria-label="Show the results list"
          className="fixed right-6 top-[84px] z-20 flex h-7 w-7 items-center justify-center border border-line-strong bg-surface text-muted hover:text-fg"
        >
          <ChevronIcon direction="left" />
        </button>
      )}

      {/* Narrow screens scroll the whole page under the dock: a scrim, so the box reads over the photos. */}
      {!wide && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-x-0 bottom-0 z-10 h-28 bg-[linear-gradient(to_bottom,rgba(9,9,10,0),rgba(9,9,10,0.97)_42%)]"
        />
      )}

      <div
        ref={dock}
        className={`vt-dock fixed z-20 ${
          wide ? `bottom-6 left-12 ${showRail ? "w-[min(1016px,calc(100vw-424px))]" : "right-12"}` : "inset-x-4 bottom-4"
        }`}
      >
        {/* Keyed by search: a new search starts with its own query in the box. */}
        <SearchDock key={data?.id ?? "loading"} variant="results" query={query}>
          {wide && <div className="mb-3.5">{timeline}</div>}
        </SearchDock>
      </div>
    </main>
  );
}

/** The height of an element, kept up to date as it resizes (0 while `active` is false). */
function useElementHeight(ref: RefObject<HTMLElement | null>, active: boolean): number {
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!active || !element) return;
    setHeight(element.getBoundingClientRect().height);
    const observer = new ResizeObserver(() => setHeight(element.getBoundingClientRect().height));
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, active]);
  return height;
}

/** What the rail says when there is nothing to list (§6.2). */
interface RailEmptyProps {
  loading: boolean;
  query: string;
  archiveTotal: number;
  /** Results that exist but fall outside the year range. */
  hidden: number;
  onReset: () => void;
}

function RailEmpty({ loading, query, archiveTotal, hidden, onReset }: RailEmptyProps) {
  if (loading) {
    return (
      <div aria-hidden="true" className="flex flex-col gap-4 pt-2">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-9 bg-raised" />
        ))}
      </div>
    );
  }
  if (hidden > 0) {
    return (
      <EmptyState title="No results from these years." className="pt-2">
        {hidden === 1 ? "The one result was" : `All ${hidden} results were`} taken outside this range.{" "}
        <button type="button" onClick={onReset} className="text-fg underline underline-offset-2">
          Reset years
        </button>
      </EmptyState>
    );
  }
  return (
    <EmptyState title={`Nothing in the ${archiveTotal} images matches “${query}”.`} className="pt-2">
      Try a broader word, such as “telescope”, “Mars” or “launch”.
    </EmptyState>
  );
}

/**
 * A2 keyboard: ↑/↓ step through the results in rank order; Esc leaves the
 * results (only when no dialog is open: the modal and drawer handle Esc first).
 */
function useResultKeys(navigate: ReturnType<typeof useNavigate>) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || document.querySelector("dialog[open]")) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [role='slider']")) return;

      if (event.key === "Escape") {
        navigate("/");
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const links = [...document.querySelectorAll<HTMLElement>("[data-result-id]")];
      if (links.length === 0) return;
      event.preventDefault();
      const current = links.indexOf(document.activeElement as HTMLElement);
      const next =
        current === -1 ? 0 : Math.min(links.length - 1, Math.max(0, current + (event.key === "ArrowDown" ? 1 : -1)));
      links[next]!.focus();
      links[next]!.scrollIntoView({ block: "nearest" });
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate]);
}
