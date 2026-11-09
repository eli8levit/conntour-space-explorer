import { useIsMutating } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, describeError } from "../api/client";
import type { SearchEngine } from "../api/types";
import { RUN_SEARCH_KEY, useRunSearch } from "../hooks/searches";
import { SearchIcon } from "./Icons";

// Same limit as the backend (it returns 422 above it).
const MAX_QUERY_LENGTH = 200;

interface SearchDockProps {
  /** "browse" (A1): a Search button and the hint row. "results" (A2): the query, an orange border and "Clear ×". */
  variant: "browse" | "results";
  /** The query on screen (A2), so a search opened from history shows what was asked. */
  query?: string;
  /** How the search on screen was scored (A2): the toggle starts there. */
  engine?: SearchEngine;
  /** Rendered above the box inside the dock (the A2 year timeline). */
  children?: ReactNode;
}

const NARROW = "(max-width: 639px)";

/** True below Tailwind's `sm`, kept in step with the window. */
function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW).matches);
  useEffect(() => {
    const media = window.matchMedia(NARROW);
    const onChange = () => setNarrow(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return narrow;
}

// The viewer's last toggle choice, so A1 starts with it. Per-viewer convenience only:
// storage can be off (private window), so every access is guarded.
const MODE_KEY = "retrieval-mode";
function savedMode(): SearchEngine {
  try {
    return localStorage.getItem(MODE_KEY) === "keyword" ? "keyword" : "hybrid";
  } catch {
    return "hybrid";
  }
}
function saveMode(mode: SearchEngine) {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // Not saved: the toggle still works for this page.
  }
}

/**
 * The bottom-anchored search box (A1·8–10, A2·11–15). It searches on submit,
 * not on each keystroke: every run is saved as a history entry, so typing
 * "m", "ma", "mar" must not create three of them.
 */
export function SearchDock({ variant, query = "", engine, children }: SearchDockProps) {
  const [text, setText] = useState(query);
  const [mode, setMode] = useState<SearchEngine>(() => engine ?? savedMode());
  const narrow = useNarrow();
  const runSearch = useRunSearch();
  const navigate = useNavigate();
  // True while any search runs, also one started elsewhere (e.g. "Search again" in history).
  const running = useIsMutating({ mutationKey: RUN_SEARCH_KEY }) > 0;
  // `running` only changes on the next render, so three fast Enter presses all saw false
  // and saved three history rows. A ref changes at once: set on submit, cleared when the
  // request settles (success or error).
  const inFlight = useRef(false);

  const trimmed = text.trim();
  // An empty query is a 422 from the backend, so the button stays off; on A2, Enter on the same query does nothing.
  const canSubmit = trimmed !== "" && !running && !(variant === "results" && trimmed === query && mode === engine);

  function submit(withMode: SearchEngine = mode) {
    if (inFlight.current) return;
    inFlight.current = true;
    runSearch.mutate({ query: trimmed, mode: withMode }, {
      onSettled: () => {
        inFlight.current = false;
      },
    });
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (canSubmit) submit();
  }

  /**
   * On A2 a new mode runs the same words again at once, so the two rankings can be
   * compared side by side in history. On A1 it only sets how the next search runs.
   */
  function chooseMode(next: SearchEngine) {
    if (next === mode) return;
    setMode(next);
    saveMode(next);
    if (variant === "results" && trimmed !== "" && !running) submit(next);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // A held Enter repeats the key; only the first press may submit.
    if (event.key === "Enter" && event.repeat) {
      event.preventDefault();
      return;
    }
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
      {runSearch.isError && <SearchError error={runSearch.error} onRetry={() => submit()} />}
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
        className={`flex items-center gap-2.5 border bg-[#0B0B0C] pl-4 pr-3 shadow-dock sm:gap-3.5 sm:pl-5 ${border} ${
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
          // The mode toggle shares the row, so a phone gets the short version (it would be cut off).
          placeholder={narrow ? "Search photos" : "Describe what you’re looking for"}
          autoComplete="off"
          enterKeyHint="search"
          // The box shows focus with its orange border, so the input needs no outline of its own.
          // Placeholder #7D7B76 is from the A1 reference: a step dimmer than `faint`.
          className={`min-w-0 flex-1 bg-transparent p-0 text-fg placeholder:text-[#7D7B76] focus-visible:outline-none ${
            variant === "browse" ? "text-[15px] sm:text-[22px]" : "text-xl sm:text-2xl"
          }`}
        />
        <ModeToggle mode={mode} disabled={running} onChange={chooseMode} />
        {variant === "browse" ? (
          <button
            type="submit"
            disabled={!canSubmit}
            // Disabled while empty (the backend would answer 422), but it keeps its look: the design shows it lit.
            aria-label="Search"
            className="h-10 shrink-0 bg-accent px-3.5 text-xs font-medium text-bg disabled:cursor-default sm:px-4"
          >
            {/* On a phone the row also holds the toggle, so the button keeps only the ⏎. */}
            <span aria-hidden="true" className="sm:hidden">{running ? "…" : "⏎"}</span>
            <span aria-hidden="true" className="hidden sm:inline">{running ? "Searching…" : "Search ⏎"}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => navigate("/")}
            // Orange so it is easy to find; the same 40px height as the toggle and the Search button.
            className="h-10 shrink-0 border border-accent px-3.5 text-[13px] text-accent-text transition-colors hover:bg-accent hover:text-bg"
          >
            Clear ×
          </button>
        )}
      </form>
    </div>
  );
}

const MODES: { value: SearchEngine; label: string; short: string; hint: string }[] = [
  { value: "hybrid", label: "Combined", short: "All", hint: "Meaning and matching words" },
  { value: "keyword", label: "Keywords", short: "Words", hint: "Matching words only" },
];

/**
 * How the next search is scored. A debugging aid: run the same words both ways
 * to see what the meaning half adds. Neutral colours: orange stays for matches.
 */
function ModeToggle({ mode, disabled, onChange }: { mode: SearchEngine; disabled: boolean; onChange: (mode: SearchEngine) => void }) {
  return (
    <div role="radiogroup" aria-label="How to search" className="flex h-10 shrink-0 border border-[#2E2E33] p-0.5">
      {MODES.map((option) => {
        const active = option.value === mode;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={option.hint}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`px-2 text-[11px] leading-none transition-colors sm:px-3 sm:text-[13px] ${
              active ? "bg-fg/[0.14] text-fg" : "text-faint hover:text-fg"
            }`}
          >
            <span className="sm:hidden">{option.short}</span>
            <span className="hidden sm:inline">{option.label}</span>
          </button>
        );
      })}
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
