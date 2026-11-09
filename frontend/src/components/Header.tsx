import { Link, useMatch } from "react-router-dom";
import { HistoryButton } from "./HistoryTab";
import { InfoIcon } from "./Icons";
import { Mark } from "./Mark";
import { useArchive } from "../hooks/sources";
import { useResultView } from "../hooks/useResultView";
import { parseId } from "../lib/ids";
import { resultSummary } from "../lib/match";
import { yearExtent } from "../lib/timeline";

/**
 * The fixed 64px bar over every page. Three slots: wordmark on the left, a
 * status line in the middle (what you are looking at), and one quiet link on
 * the right. No nav links: History is the left edge tab, Space view is
 * reached from the image details and from here.
 */
export function Header() {
  const searchMatch = useMatch("/search/:id");
  const onScene = useMatch("/scene") !== null;
  const searchId = parseId(searchMatch?.params.id);
  const archive = useArchive();
  const total = archive.data?.total;
  // Over the moving canvas the bar is a little more see-through (A1 82%, elsewhere 90%).
  const onCanvas = useMatch("/") !== null;

  return (
    <header
      className={`vt-header fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-[#1C1C1F] px-4 ${
        onCanvas ? "bg-bg/[0.82]" : "bg-bg/90"
      } backdrop-blur-[14px] sm:px-8`}
    >
      {/* §14: the mark 12px left of the wordmark, which stays live text. */}
      <Link to="/" className="flex min-w-0 shrink-0 items-center gap-3">
        <Mark size={20} className="shrink-0" />
        <span className="flex min-w-0 items-baseline gap-3.5">
          <span className="whitespace-nowrap text-[17px] font-semibold tracking-[-0.01em]">Space Explorer</span>
          <span className="hidden truncate text-[13px] text-faint md:inline">
            {total === undefined ? "NASA Image Library" : `${total} images from the NASA Image Library`}
          </span>
        </span>
      </Link>

      {/* Spaced like the design: three groups, equal gaps between them (not a strict centre). */}
      <div className="min-w-0">
        {searchId !== null ? <SearchStatus id={searchId} /> : onScene ? null : <ArchiveStatus />}
      </div>

      {!onScene && <HistoryButton />}

      <div className="flex shrink-0 items-center gap-6 text-[13px]">
        {/* A static page outside the SPA (public/architecture.html), so a plain link, not a router Link.
            Below lg the header has no room for the words: a small icon button, like History's. */}
        <a
          href="/architecture.html"
          aria-label="How it works"
          className="flex h-9 items-center border border-line-strong px-2.5 text-fg lg:h-auto lg:border-0 lg:px-0 lg:text-muted lg:hover:text-fg"
        >
          <InfoIcon size={15} className="lg:hidden" />
          <span className="hidden lg:inline">How it works</span>
        </a>
        <span className="hidden lg:contents">
          {searchId !== null ? (
            <Link to={`/scene?search=${searchId}`} className="text-muted hover:text-fg">
              See these in space →
            </Link>
          ) : onScene ? (
            <Link to="/" className="text-muted hover:text-fg">
              ← Back to the archive
            </Link>
          ) : (
            <Link to="/scene" className="text-muted hover:text-fg">
              Space view →
            </Link>
          )}
        </span>
      </div>
    </header>
  );
}

/** The orange dot: the one "live" mark in the header. */
function Dot({ size }: { size: number }) {
  return (
    <span aria-hidden="true" className="inline-block shrink-0 rounded-full bg-accent" style={{ width: size, height: size }} />
  );
}

/** A1·2: "100 images · 10 NASA centers · 1950–2024", all counted from the loaded archive. */
function ArchiveStatus() {
  const archive = useArchive();
  if (!archive.data) return null;
  const items = archive.data.items;
  const centers = new Set(items.map((source) => source.center)).size;
  const { from, to } = yearExtent(items);
  return (
    // Below sm the header also holds the History and How-it-works buttons: no room for the count.
    <p className="hidden items-center gap-2.5 whitespace-nowrap text-xs text-faint sm:flex">
      <Dot size={6} />
      <span className="text-fg">{archive.data.total} images</span>
      <span className="hidden sm:inline">·</span>
      <span className="hidden sm:inline">{centers} NASA centers</span>
      <span className="hidden sm:inline">·</span>
      <span className="hidden sm:inline">
        {from}–{to}
      </span>
    </p>
  );
}

/** A2·1: "5 strong matches, 8 faint · 87 images set aside", for the years currently shown. */
function SearchStatus({ id }: { id: number }) {
  const view = useResultView(id);
  if (!view.search.data || !view.archive.data) return null;
  return (
    // Below sm there is no room next to the buttons; the ranked list says the same thing.
    <p className="hidden min-w-0 items-center gap-2.5 text-sm text-muted sm:flex">
      <Dot size={7} />
      <span className="truncate">
        <span className="text-fg">{resultSummary(view.strongCount, view.faintCount)}</span>
        <span className="hidden sm:inline">
          {" "}
          · {view.setAsideCount} images set aside
          {view.search.data.engine === "keyword" && <span className="text-faint"> · keyword search only</span>}
        </span>
      </span>
    </p>
  );
}
