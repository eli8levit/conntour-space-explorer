import { Link } from "react-router-dom";
import { useHistory } from "../hooks/searches";
import { useHistoryDrawer } from "../hooks/useHistoryDrawer";
import { OPENED_IN_APP } from "../hooks/useImageParam";
import { ChevronIcon, HistoryIcon } from "./Icons";
import { useUndoDelete } from "./UndoDelete";

/**
 * A1·7: the vertical tab on the left edge that opens the history drawer.
 * The count is the API's total (minus a delete still waiting for its undo),
 * shown once the first history page has loaded.
 */
export function HistoryTab() {
  const { isOpen, openLink } = useHistoryDrawer();
  const count = useHistoryCount();
  if (isOpen) return null;

  return (
    <Link
      to={openLink}
      state={OPENED_IN_APP}
      aria-label={count === null ? "Open search history" : `Open search history, ${count} searches`}
      // Phones have no spare left edge (the grid starts at 16px): they get HistoryButton in the header.
      className="vt-tab fixed left-0 top-[38vh] z-20 hidden flex-col items-center gap-2.5 border border-l-0 border-line-strong bg-bg/90 px-2.5 py-4 text-fg backdrop-blur-md transition-colors hover:border-faint sm:flex"
    >
      <HistoryIcon />
      <span className="writing-vertical text-[13px]">History{count === null ? "" : ` · ${count}`}</span>
      <ChevronIcon className="text-faint" />
    </Link>
  );
}

/** The number of saved searches, once known: the API's total minus a delete still waiting for its undo. */
function useHistoryCount(): number | null {
  const history = useHistory();
  const { pending } = useUndoDelete();
  const total = history.data?.pages[0]?.total;
  return total === undefined ? null : total - (pending ? 1 : 0);
}

/** The same door into history on phones: a small icon button in the header. */
export function HistoryButton() {
  const { openLink } = useHistoryDrawer();
  const count = useHistoryCount();
  return (
    <Link
      to={openLink}
      state={OPENED_IN_APP}
      aria-label={count === null ? "Open search history" : `Open search history, ${count} searches`}
      className="flex h-9 items-center gap-1.5 border border-line-strong px-2.5 text-[13px] text-fg sm:hidden"
    >
      <HistoryIcon size={14} />
      {count !== null && <span>{count}</span>}
    </Link>
  );
}
