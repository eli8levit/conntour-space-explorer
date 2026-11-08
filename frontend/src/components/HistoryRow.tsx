import { Link } from "react-router-dom";
import type { SearchSummary } from "../api/types";
import { formatTime } from "../lib/format";
import { historyMeta } from "../lib/history";
import { isStrong } from "../lib/match";

interface HistoryRowProps {
  search: SearchSummary;
  /** This search is the one open behind the drawer. */
  current: boolean;
  archiveSize: number;
  onDelete: (search: SearchSummary) => void;
  onSearchAgain: (query: string) => void;
}

/**
 * A4·4–10: one past search. The query, a one-line summary, the top three
 * thumbnails with their confidence bars, and two actions. The link and the
 * delete button are siblings, not nested: a button inside a link is invalid
 * HTML and confuses screen readers.
 */
export function HistoryRow({ search, current, archiveSize, onDelete, onSearchAgain }: HistoryRowProps) {
  const empty = search.result_count === 0;
  const extra = search.result_count - search.previews.length;

  return (
    <article
      aria-current={current ? "true" : undefined}
      className={`flex items-center gap-4 border-t border-line pb-3.5 pt-[13px] ${
        current ? "-mx-6 bg-[#111113] px-6 shadow-[inset_3px_0_0_rgb(var(--color-accent))] sm:-mx-10 sm:px-10" : ""
      }`}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <h3 className="truncate text-[22px] leading-[1.1] tracking-[-0.02em] sm:text-[27px]">{search.query}</h3>
        <p className="text-[13px] text-muted sm:truncate">
          <time dateTime={search.created_at} title={new Date(search.created_at).toLocaleString()}>
            {formatTime(search.created_at)}
          </time>{" "}
          · <span className={empty ? "text-muted" : "text-soft"}>{historyMeta(search, archiveSize)}</span>
        </p>
      </div>

      {!empty && (
        <div className="hidden shrink-0 items-center gap-1 sm:flex">
          {search.previews.map((preview) => (
            <span key={preview.thumb_url} className="relative block h-8 w-[46px] bg-raised">
              {/* Faint matches read dimmer: opacity follows confidence, never below 0.4. */}
              <img
                src={preview.thumb_url}
                alt=""
                loading="lazy"
                className="block h-8 w-[46px] object-cover"
                style={{ opacity: Math.max(0.4, preview.confidence) }}
              />
              <span
                className={`absolute bottom-0 left-0 h-0.5 ${isStrong(preview.confidence) ? "bg-accent" : "bg-fg"}`}
                style={{ width: `${Math.round(preview.confidence * 100)}%` }}
              />
            </span>
          ))}
          {/* Fixed width keeps the actions aligned whether or not there is a "+n". */}
          <span className="w-[30px] pl-1 text-[13px] text-faint">{extra > 0 ? `+${extra}` : ""}</span>
        </div>
      )}

      <div className="flex shrink-0 items-center gap-5 pl-2">
        {empty ? (
          <button
            type="button"
            onClick={() => onSearchAgain(search.query)}
            className="text-sm font-medium underline underline-offset-[3px] hover:text-accent-text"
          >
            Search again
          </button>
        ) : (
          <Link to={`/search/${search.id}`} className="text-sm font-medium underline underline-offset-[3px] hover:text-accent-text">
            Open results
          </Link>
        )}
        <button
          type="button"
          onClick={() => onDelete(search)}
          aria-label={`Delete search “${search.query}”`}
          className="text-sm text-faint transition-colors hover:text-fg"
        >
          Delete
        </button>
      </div>
    </article>
  );
}
