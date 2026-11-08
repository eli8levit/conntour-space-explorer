import { useEffect, useState, type FormEvent } from "react";
import { useMatch } from "react-router-dom";
import { describeError } from "../api/client";
import { useRunSearch, useSearch } from "../hooks/searches";
import { parseId } from "../lib/ids";

// Same limit as the backend (it returns 422 above it).
const MAX_QUERY_LENGTH = 200;

/**
 * Free-text search in the header. It runs on submit (Enter), not on each
 * keystroke: every run becomes a history entry, so typing "m", "ma", "mar"
 * must not create three of them.
 */
export function SearchBar({ className = "" }: { className?: string }) {
  const [text, setText] = useState("");
  const runSearch = useRunSearch();

  // On a results page, show that search's query in the box, also when the
  // page was opened from history (where the user did not type it).
  const match = useMatch("/search/:id");
  const openSearch = useSearch(parseId(match?.params.id)).data;
  useEffect(() => {
    if (openSearch) setText(openSearch.query);
  }, [openSearch]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const query = text.trim();
    if (query === "" || runSearch.isPending) return;
    runSearch.mutate(query);
  }

  return (
    <form role="search" onSubmit={handleSubmit} className={`relative ${className}`}>
      <label htmlFor="search-input" className="sr-only">
        Search images
      </label>
      <div className="flex rounded-sm border border-line-strong bg-surface focus-within:border-fg">
        <input
          id="search-input"
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={MAX_QUERY_LENGTH}
          placeholder='Try "red planet" or "STS-135"'
          autoComplete="off"
          // The wrapper shows focus with its border, so the input needs no outline of its own.
          className="min-w-0 flex-1 bg-transparent px-3 py-1.5 text-sm text-fg placeholder:text-faint focus-visible:outline-none"
        />
        <button
          type="submit"
          disabled={runSearch.isPending}
          className="border-l border-line-strong px-3 text-sm text-muted hover:text-fg disabled:opacity-50"
        >
          {runSearch.isPending ? "Searching…" : "Search"}
        </button>
      </div>
      {runSearch.isError && (
        <p role="alert" className="absolute left-0 top-full mt-1 text-xs text-danger">
          {describeError(runSearch.error)}
        </p>
      )}
    </form>
  );
}
