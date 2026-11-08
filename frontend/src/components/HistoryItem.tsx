import { Link } from "react-router-dom";
import type { SearchSummary } from "../api/types";
import { formatRelativeTime } from "../lib/format";

interface HistoryItemProps {
  search: SearchSummary;
  onDelete: (id: number) => void;
}

/**
 * One past search. The link and the delete button are siblings, not nested:
 * a button inside a link is invalid HTML and confuses screen readers.
 */
export function HistoryItem({ search, onDelete }: HistoryItemProps) {
  const results = search.result_count === 1 ? "1 result" : `${search.result_count} results`;
  return (
    <li className="flex items-center gap-3 py-3">
      <Link
        to={`/search/${search.id}`}
        className="group flex min-w-0 flex-1 items-center gap-4 rounded-sm"
      >
        <span className="flex w-[7.5rem] shrink-0 gap-1">
          {search.preview_thumbs.slice(0, 3).map((thumb) => (
            <img
              key={thumb}
              src={thumb}
              alt=""
              loading="lazy"
              width={40}
              height={30}
              className="h-[30px] w-10 rounded-sm border border-line bg-raised object-cover"
            />
          ))}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm group-hover:underline group-hover:underline-offset-4">
            {search.query}
          </span>
          <span className="mt-0.5 block font-mono text-xs text-muted">
            <time dateTime={search.created_at} title={new Date(search.created_at).toLocaleString()}>
              {formatRelativeTime(search.created_at)}
            </time>
            {" · "}
            {results}
          </span>
        </span>
      </Link>
      <button
        type="button"
        onClick={() => onDelete(search.id)}
        aria-label={`Delete search "${search.query}"`}
        className="shrink-0 rounded-sm px-2 py-1 text-xs text-faint hover:text-fg"
      >
        Delete
      </button>
    </li>
  );
}
