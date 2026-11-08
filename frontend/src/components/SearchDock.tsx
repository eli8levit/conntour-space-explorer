import { useIsMutating } from "@tanstack/react-query";
import { useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, describeError } from "../api/client";
import { RUN_SEARCH_KEY, useRunSearch } from "../hooks/searches";
import { SearchIcon } from "./Icons";

// Same limit as the backend (it returns 422 above it).
const MAX_QUERY_LENGTH = 200;

interface SearchDockProps {
  /** "browse" (A1): a Search button and the hint row. "results" (A2): the query, an orange border and "Clear ×". */
  variant: "browse" | "results";
  /** The query on screen (A2), so a search opened from history shows what was asked. */
  query?: string;
  /** Rendered above the box inside the dock (the A2 year timeline). */
  children?: ReactNode;
}

/**
 * The bottom-anchored search box (A1·8–10, A2·11–15). It searches on submit,
 * not on each keystroke: every run is saved as a history entry, so typing
 * "m", "ma", "mar" must not create three of them.
 */
export function SearchDock({ variant, query = "", children }: SearchDockProps) {
  const [text, setText] = useState(query);
  const runSearch = useRunSearch();
  const navigate = useNavigate();
  // True while any search runs, also one started elsewhere (e.g. "Search again" in history).
  const running = useIsMutating({ mutationKey: RUN_SEARCH_KEY }) > 0;

  const trimmed = text.trim();
  // An empty query is a 422 from the backend, so the button stays off; on A2, Enter on the same query does nothing.
  const canSubmit = trimmed !== "" && !running && !(variant === "results" && trimmed === query);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (canSubmit) runSearch.mutate(trimmed);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Escape") return;
    // Esc clears: on A2 it leaves the results (back to the archive), on A1 it empties the box.
    if (variant === "results") navigate("/");
    else setText("");
    event.currentTarget.blur();
  }

  const border =
    running ? "border-accent animate-border-pulse" : variant === "results" ? "border-accent" : "border-[#3A3A40] focus-within:border-accent";

  return (
    <div className="flex flex-col">
      {runSearch.isError && <SearchError error={runSearch.error} onRetry={() => runSearch.mutate(trimmed)} />}
      {children}
      {variant === "browse" && (
        <div className="mb-2.5 hidden justify-between px-1 text-[11px] text-muted sm:flex">
          <span>Drag to explore · hover a frame for details</span>
          <span>Press / to search</span>
        </div>
      )}
      <form
        role="search"
        onSubmit={handleSubmit}
        className={`flex items-center gap-3.5 border bg-[#0B0B0C] pl-5 pr-3 shadow-dock ${border} ${
          variant === "browse" ? "h-16" : "h-[62px]"
        }`}
      >
        <SearchIcon className="shrink-0 text-accent" />
        <label htmlFor="search-input" className="sr-only">
          Search the archive
        </label>
        <input
          id="search-input"
          type="search"
          value={text}
          readOnly={running}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={MAX_QUERY_LENGTH}
          placeholder="Describe what you’re looking for"
          autoComplete="off"
          enterKeyHint="search"
          // The box shows focus with its orange border, so the input needs no outline of its own.
          className={`min-w-0 flex-1 bg-transparent p-0 text-fg focus-visible:outline-none ${
            variant === "browse" ? "text-[17px] sm:text-[22px]" : "text-xl sm:text-2xl"
          }`}
        />
        {variant === "browse" ? (
          <button
            type="submit"
            disabled={!canSubmit}
            // Disabled while empty (the backend would answer 422), but it keeps its look: the design shows it lit.
            className="shrink-0 bg-accent px-4 py-3 text-xs font-medium text-bg disabled:cursor-default"
          >
            {running ? "Searching…" : "Search ⏎"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => navigate("/")}
            className="shrink-0 border border-[#2E2E33] px-3.5 py-2.5 text-[13px] text-muted transition-colors hover:border-faint hover:text-fg"
          >
            Clear ×
          </button>
        )}
      </form>
    </div>
  );
}

/**
 * §6.2: a failed search was not saved, so say so and offer a retry. A 422
 * (bad input) is not a server failure: show the backend's own message.
 */
function SearchError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const invalid = error instanceof ApiError && error.status < 500;
  return (
    <div role="alert" className="mb-2.5 flex items-center justify-between gap-4 bg-[#0B0B0C] px-4 py-2.5 text-[13px]">
      <span className="text-fg">{invalid ? describeError(error) : "Search failed. Your query was not saved. Try again."}</span>
      {!invalid && (
        <button type="button" onClick={onRetry} className="shrink-0 text-muted underline underline-offset-2 hover:text-fg">
          Retry
        </button>
      )}
    </div>
  );
}
