import { useEffect, useRef, useState } from "react";
import { useMatch } from "react-router-dom";
import { useHistory, useRunSearch } from "../hooks/searches";
import { useArchive } from "../hooks/sources";
import { useHistoryDrawer } from "../hooks/useHistoryDrawer";
import { groupByDay, olderLabel } from "../lib/history";
import { HISTORY_PAGE_SIZE } from "../hooks/searches";
import { parseId } from "../lib/ids";
import { ErrorState } from "./ErrorState";
import { HistoryRow } from "./HistoryRow";
import { CloseIcon } from "./Icons";
import { UndoToast, useUndoDelete } from "./UndoDelete";

/**
 * A4: search history as a drawer from the left, over whatever page is open.
 * A native <dialog> (showModal) gives the focus trap, Esc and an inert page
 * behind; ::backdrop is the scrim.
 */
export function HistoryDrawer() {
  const dialog = useRef<HTMLDialogElement>(null);
  const { close } = useHistoryDrawer();
  const [find, setFind] = useState("");
  // The server filters the whole history; wait for a pause in typing before asking it.
  const needle = useDebounced(find.trim(), 250);
  const history = useHistory(needle);
  // The unfiltered list (also what the History tab shows): its total heads the drawer.
  const all = useHistory();
  const archive = useArchive();
  const runSearch = useRunSearch();
  const { pending, requestDelete } = useUndoDelete();
  const openSearchId = parseId(useMatch("/search/:id")?.params.id);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const opener = document.activeElement as HTMLElement | null;
    element.showModal();
    // showModal() would focus the first button (×). Start on the title instead.
    element.querySelector<HTMLElement>("[data-initial-focus]")?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = "";
      opener?.focus();
    };
  }, []);

  // A row waiting for its undo is hidden, and not counted.
  const loaded = (history.data?.pages.flatMap((page) => page.items) ?? []).filter((item) => item.id !== pending?.search.id);
  const minus = (count: number | undefined, hidden: boolean) => (count === undefined ? undefined : count - (hidden ? 1 : 0));
  const total = minus(all.data?.pages[0]?.total, Boolean(pending));
  const pendingMatches = Boolean(pending?.search.query.toLowerCase().includes(needle.toLowerCase()));
  const filteredTotal = minus(history.data?.pages[0]?.total, pendingMatches);
  // The server filtered by `needle`; the same filter on the client narrows the list at once,
  // while the server answer for what was just typed is still on its way.
  const typed = find.trim().toLowerCase();
  const shown = typed ? loaded.filter((item) => item.query.toLowerCase().includes(typed)) : loaded;
  const filtering = typed !== "";
  const settled = !history.isPlaceholderData && needle.toLowerCase() === typed;
  const archiveSize = archive.data?.total ?? 100;

  return (
    <dialog
      ref={dialog}
      aria-labelledby="history-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close(); // a click on the scrim
      }}
      className="animate-drawer-in fixed inset-y-0 left-0 m-0 h-dvh open:flex max-h-none w-full max-w-full flex-col border-0 border-r border-line-strong bg-[#0B0B0C] p-0 text-fg shadow-drawer backdrop:bg-[var(--scrim)] sm:w-[720px]"
    >
      <div className="flex items-start justify-between px-6 pt-7 sm:px-10">
        <div className="flex flex-col gap-1.5">
          {/* Focus starts on the title (not the × button), so screen readers announce where they are. */}
          <h2
            id="history-title"
            tabIndex={-1}
            data-initial-focus
            className="text-[44px] leading-none tracking-[-0.03em] focus-visible:outline-none sm:text-[56px]"
          >
            History
          </h2>
          <p className="text-sm text-muted">
            {total === undefined ? "Newest first." : `${total} ${total === 1 ? "search" : "searches"}, newest first.`}
          </p>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Close history"
          className="flex h-10 w-10 items-center justify-center border border-line-strong transition-colors hover:border-faint"
        >
          <CloseIcon />
        </button>
      </div>

      <div className="px-6 pt-[22px] sm:px-10">
        <label htmlFor="history-find" className="sr-only">
          Find a past search
        </label>
        <input
          id="history-find"
          type="search"
          value={find}
          onChange={(event) => setFind(event.target.value)}
          placeholder="Find a past search"
          autoComplete="off"
          className="block h-11 w-full border-0 border-b border-line-strong bg-transparent p-0 text-base text-fg placeholder:text-faint focus:border-fg focus-visible:outline-none"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-1 sm:px-10">
        {history.isPending && <RowsSkeleton />}
        {history.isError && loaded.length === 0 && (
          <ErrorState title="Could not load your history." error={history.error} onRetry={() => void history.refetch()} className="mt-6" />
        )}
        {all.isSuccess && total === 0 && (
          <p className="pt-6 text-[15px] text-muted">No searches yet. Each search you run is saved here with its results.</p>
        )}
        {filtering && settled && total !== 0 && shown.length === 0 && (
          <p className="pt-6 text-[15px] text-muted">
            No past search contains “{find.trim()}”.{" "}
            <button type="button" onClick={() => setFind("")} className="text-fg underline underline-offset-2">
              Clear the filter
            </button>
          </p>
        )}

        {groupByDay(shown).map((group) => (
          <section key={group.label} aria-label={group.label}>
            <h3 className="pb-2 pt-[18px] text-[13px] font-medium text-muted">{group.label}</h3>
            {group.items.map((search) => (
              <HistoryRow
                key={search.id}
                search={search}
                current={search.id === openSearchId}
                archiveSize={archiveSize}
                onDelete={requestDelete}
                onSearchAgain={(query, mode) => runSearch.mutate({ query, mode })}
              />
            ))}
          </section>
        ))}
      </div>

      {history.isSuccess && shown.length > 0 && (
        <div className="flex items-center gap-6 border-t border-line px-6 pb-[18px] pt-4 sm:px-10">
          {history.hasNextPage ? (
            <>
              <button
                type="button"
                onClick={() => void history.fetchNextPage()}
                disabled={history.isFetchingNextPage}
                className="text-[15px] font-medium underline underline-offset-[3px] hover:text-accent-text disabled:opacity-50"
              >
                {history.isFetchingNextPage ? "Loading…" : olderLabel(loaded.length, filteredTotal, HISTORY_PAGE_SIZE)}
              </button>
              {filteredTotal !== undefined && (
                <span className="text-sm text-muted">
                  Showing {loaded.length} of {filteredTotal}
                </span>
              )}
            </>
          ) : (
            <span className="text-sm text-muted">
              {filtering ? findSummary(filteredTotal ?? shown.length, find.trim()) : "That’s every search you’ve made."}
            </span>
          )}
          {history.isFetchNextPageError && <span className="text-sm text-danger">Could not load more.</span>}
        </div>
      )}

      {/* Inside the dialog, so it stays clickable while the page behind is inert. */}
      <UndoToast drawerOpen />
    </dialog>
  );
}

/** The footer while filtering: "2 searches contain “mars”." */
function findSummary(count: number, text: string): string {
  return `${count} ${count === 1 ? "search contains" : "searches contain"} “${text}”.`;
}

/** `value`, once it has stopped changing for `delay` ms. */
function useDebounced<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

function RowsSkeleton() {
  return (
    <div aria-hidden="true" className="pt-[18px]">
      <div className="mb-3 h-3 w-16 bg-raised" />
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="flex items-center gap-4 border-t border-line py-4">
          <div className="flex-1">
            <div className="h-6 w-2/5 bg-raised" />
            <div className="mt-2 h-3 w-3/5 bg-raised" />
          </div>
          <div className="h-8 w-[146px] bg-raised" />
        </div>
      ))}
    </div>
  );
}
