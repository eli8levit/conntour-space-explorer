import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useMatch, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { SearchSummary } from "../api/types";
import { useDeleteSearch } from "../hooks/searches";
import { parseId } from "../lib/ids";

// Deleting a past search can be undone for 6 seconds (A4·12).
// A deleted search cannot be re-created (its snapshot is gone), so we wait:
// the row hides at once, and the DELETE request goes out only after 6 s.
// Undo just cancels the timer. Nothing to restore on the server.

export const UNDO_SECONDS = 6;

interface Pending {
  search: SearchSummary;
  /** When the DELETE goes out (ms since epoch), for the countdown. */
  deadline: number;
}

interface UndoDeleteValue {
  pending: Pending | null;
  requestDelete: (search: SearchSummary) => void;
  undo: () => void;
}

const UndoDeleteContext = createContext<UndoDeleteValue | null>(null);

export function useUndoDelete(): UndoDeleteValue {
  const value = useContext(UndoDeleteContext);
  if (!value) throw new Error("useUndoDelete must be used inside <UndoDeleteProvider>");
  return value;
}

export function UndoDeleteProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const deleteSearch = useDeleteSearch();
  const navigate = useNavigate();
  const openSearchId = parseId(useMatch("/search/:id")?.params.id);

  // Sends the DELETE now (the existing optimistic mutation, with rollback on error).
  const commit = useCallback(
    (id: number) => {
      window.clearTimeout(timer.current);
      setPending((current) => (current?.search.id === id ? null : current));
      deleteSearch.mutate(id);
    },
    [deleteSearch],
  );

  const requestDelete = useCallback(
    (search: SearchSummary) => {
      // One toast at a time: a new delete commits the previous one at once.
      if (pending) commit(pending.search.id);
      window.clearTimeout(timer.current);
      setPending({ search, deadline: Date.now() + UNDO_SECONDS * 1000 });
      timer.current = window.setTimeout(() => commit(search.id), UNDO_SECONDS * 1000);
      // The results behind the drawer are about to stop existing: show the archive instead.
      if (search.id === openSearchId) navigate("/?history=1", { replace: true });
    },
    [pending, commit, openSearchId, navigate],
  );

  const undo = useCallback(() => {
    window.clearTimeout(timer.current);
    setPending(null);
  }, []);

  // Closing the tab inside the 6 s still deletes: `keepalive` lets the request outlive the page.
  useEffect(() => {
    if (!pending) return;
    const flush = () => api.deleteSearchOnUnload(pending.search.id);
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [pending]);

  return (
    <UndoDeleteContext.Provider value={{ pending, requestDelete, undo }}>{children}</UndoDeleteContext.Provider>
  );
}

/**
 * The undo toast. It floats outside the drawer, at the bottom left of the
 * visible page. `role="status"` makes screen readers announce it.
 */
export function UndoToast({ drawerOpen }: { drawerOpen: boolean }) {
  const { pending, undo } = useUndoDelete();
  const secondsLeft = useCountdown(pending?.deadline ?? null);
  if (!pending) return null;

  return (
    <div
      role="status"
      className={`fixed bottom-7 left-4 right-4 z-50 flex items-center gap-5 bg-fg px-[18px] py-3.5 text-bg shadow-toast sm:right-auto sm:w-[480px] ${
        drawerOpen ? "sm:left-[760px]" : "sm:left-12"
      }`}
    >
      <span className="min-w-0 truncate text-[15px]">Deleted “{pending.search.query}” and its saved results.</span>
      <button type="button" onClick={undo} className="shrink-0 text-[15px] font-semibold underline underline-offset-2">
        Undo
      </button>
      <span className="ml-auto shrink-0 text-[13px] text-[#55534E]">Gone in {secondsLeft} s</span>
    </div>
  );
}

/** Whole seconds until `deadline`, updated a few times a second. */
function useCountdown(deadline: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (deadline === null) return;
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [deadline]);
  return deadline === null ? 0 : Math.max(0, Math.ceil((deadline - now) / 1000));
}
