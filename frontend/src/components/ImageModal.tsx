import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useLocation, useMatch, useNavigate } from "react-router-dom";
import type { SearchHit, Source } from "../api/types";
import { useSource } from "../hooks/sources";
import { useImageParam } from "../hooks/useImageParam";
import { useResultView } from "../hooks/useResultView";
import { displayTitle } from "../lib/displayTitle";
import { sizeLabel } from "../lib/details";
import { formatPercent } from "../lib/format";
import { parseId } from "../lib/ids";
import { formatRank, isStrong } from "../lib/match";
import { ErrorState } from "./ErrorState";
import { FadeImage } from "./FadeImage";
import { ChevronIcon } from "./Icons";
import { ImageDetails } from "./ImageDetails";
import { RankBadge } from "./MatchMarks";

/**
 * A3, image details, opened by ?image=<id> on any page. Mounted once in the
 * Layout, so the archive (A1) and the results (A2) share it.
 */
export function ImageModal() {
  const { imageId, closeImage } = useImageParam();
  if (imageId === null) return null;
  return <ImageDialog id={imageId} onClose={closeImage} />;
}

/** Where this image sits in what the user is browsing: the result list on A2, date order on A1. */
function useBrowseContext(id: number) {
  const searchId = parseId(useMatch("/search/:id")?.params.id);
  const view = useResultView(searchId);
  const hit: SearchHit | null = view.results.find((result) => result.source.id === id) ?? null;
  const inResults = view.visible.some((result) => result.source.id === id);
  // Prev/next walk the current results in rank order; a set-aside image walks the archive by date.
  const order = inResults
    ? view.visible.map((result) => result.source.id)
    : (view.archive.data?.items ?? []).map((source) => source.id);
  const index = order.indexOf(id);
  return {
    hit,
    query: view.search.data?.query ?? null,
    semanticOn: view.search.data?.engine !== "keyword",
    position: inResults ? { index: index + 1, of: order.length } : null,
    prevId: index > 0 ? order[index - 1]! : null,
    nextId: index >= 0 && index < order.length - 1 ? order[index + 1]! : null,
    archive: view.archive.data?.items ?? [],
    extent: view.extent,
  };
}

function ImageDialog({ id, onClose: closeUrl }: { id: number; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  // Closing goes Back in history. It must run once: Esc pressed twice (or × clicked twice)
  // before the URL changed used to go back two entries and leave the results page.
  const closing = useRef(false);
  // On phones the whole dialog scrolls as one; prev/next must start at the top again.
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [id]);
  const onClose = () => {
    if (closing.current) return;
    closing.current = true;
    closeUrl();
  };
  const source = useSource(id);
  const context = useBrowseContext(id);
  const { imageLink } = useImageParam();
  const navigate = useNavigate();
  const location = useLocation();
  // If Back lands on another history entry that still has ?image=, the dialog stays mounted:
  // it must be closable again there.
  useEffect(() => {
    closing.current = false;
  }, [location.key]);

  // The native <dialog> with showModal() gives us, for free: a focus trap,
  // an inert page behind it, and the Esc key (the "cancel" event below).
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    // Remember what had focus (the frame link), so closing returns focus to it.
    const opener = document.activeElement as HTMLElement | null;
    element.showModal();
    // showModal() would focus the first button (×). Start on the title instead.
    element.querySelector<HTMLElement>("[data-initial-focus]")?.focus();
    document.body.style.overflow = "hidden"; // stop the page scrolling behind
    return () => {
      closing.current = true; // our own close() below must not count as a second request
      element.close();
      document.body.style.overflow = "";
      opener?.focus();
    };
  }, []);

  // Opened from a link, the image is not loaded yet when showModal() runs, so the dialog itself
  // holds focus. Once the title exists, move focus there, as when opened from a frame.
  const loaded = Boolean(source.data);
  useEffect(() => {
    const element = dialog.current;
    if (loaded && element && document.activeElement === element) {
      element.querySelector<HTMLElement>("[data-initial-focus]")?.focus();
    }
  }, [loaded]);

  /** Prev/next swap the image in place: `replace`, so stepping does not fill the Back button. */
  const go = (nextId: number | null) => {
    if (nextId !== null) navigate(imageLink(nextId), { replace: true, state: location.state });
  };

  function onKeyDown(event: KeyboardEvent) {
    if ((event.target as HTMLElement).closest("input, textarea")) return;
    if (event.key === "ArrowLeft") go(context.prevId);
    if (event.key === "ArrowRight") go(context.nextId);
  }

  const data = source.data;
  const title = data ? displayTitle(data) : "Image";

  return (
    <dialog
      ref={dialog}
      aria-label={`${title}, details`}
      onCancel={(event) => {
        // Esc: let the URL close the dialog (same path as Back), not the browser.
        event.preventDefault();
        onClose();
      }}
      // Chrome may close a dialog on Esc without a cancel event (when the page has had no user
      // activation since it opened). The URL must follow, or ?image= stays and the same image
      // cannot be opened again. A close event that lands while the dialog is open is stale: in dev,
      // StrictMode mounts twice, and the first mount's close() fires its event after the second
      // showModal(). Without this check, that event closed the image right after it opened.
      onClose={(event) => {
        if (!event.currentTarget.open) onClose();
      }}
      onClick={(event) => {
        // A click on the dialog element itself (not its content) is a click on the scrim.
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={onKeyDown}
      // Phones: full screen, one scroll for the image and the details (a framed box left the
      // details a sliver). From 900px: a framed dialog sized from the viewport: the margin grows
      // with the window (24–64px), the image pane takes what the details column leaves, and very
      // large screens stop at 1880×1240.
      className="m-0 h-dvh max-h-none w-screen max-w-none overflow-hidden bg-[#0D0D0F] p-0 text-fg backdrop:bg-[var(--scrim)] focus-visible:outline-none min-[900px]:m-auto min-[900px]:h-[min(1240px,calc(100dvh-2*clamp(24px,3vw,64px)))] min-[900px]:w-[min(1880px,calc(100vw-2*clamp(24px,3vw,64px)))] min-[900px]:border min-[900px]:border-line-strong min-[900px]:shadow-modal"
    >
      <div
        ref={scroller}
        className="h-full overflow-y-auto overscroll-contain min-[900px]:grid min-[900px]:grid-cols-[minmax(0,1fr)_clamp(460px,36vw,680px)] min-[900px]:grid-rows-1 min-[900px]:overflow-hidden"
      >
        <ImagePane
          source={data}
          hit={context.hit}
          position={context.position}
          onPrev={context.prevId !== null ? () => go(context.prevId) : undefined}
          onNext={context.nextId !== null ? () => go(context.nextId) : undefined}
        />
        {/* Keyed by image: prev/next start the column scrolled to the top, with "Show more" closed again. */}
        <div key={id} className="min-h-0 min-[900px]:overflow-y-auto">
          {source.isError && (
            <div className="p-8">
              <ErrorState title="Could not load this image." error={source.error} onRetry={() => void source.refetch()} />
            </div>
          )}
          {data && (
            <ImageDetails
              source={data}
              hit={context.hit}
              query={context.hit ? context.query : null}
              semanticOn={context.semanticOn}
              archive={context.archive}
              extent={context.extent}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </dialog>
  );
}

interface ImagePaneProps {
  source: Source | undefined;
  hit: SearchHit | null;
  position: { index: number; of: number } | null;
  onPrev?: () => void;
  onNext?: () => void;
}

/** The left half: the full image, never cropped, with the match chip and the prev/next buttons. */
function ImagePane({ source, hit, position, onPrev, onNext }: ImagePaneProps) {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const size = source ? sizeLabel(source) : null;
  const arrow =
    "absolute top-1/2 flex h-14 w-11 -translate-y-1/2 items-center justify-center border border-line-strong bg-bg/75 text-fg transition-colors hover:border-faint disabled:invisible";
  return (
    // Phones: a fixed share of the screen above the details; from 900px: the full height.
    <div className="relative flex h-[46dvh] min-h-0 items-center justify-center overflow-hidden bg-[#050506] min-[900px]:h-auto">
      {source && (
        <>
          {/* The small thumbnail, blurred, holds the space until the medium image has loaded. */}
          {loadedSrc !== source.image_url && (
            <img src={source.thumb_url} alt="" aria-hidden="true" className="absolute h-full w-full object-contain opacity-60 blur-md" />
          )}
          <FadeImage
            src={source.image_url}
            alt={displayTitle(source)}
            onLoad={() => setLoadedSrc(source.image_url)}
            className="relative h-full w-full object-contain"
          />
        </>
      )}

      {hit && (
        <div className="absolute left-5 top-[18px] flex items-center gap-2">
          <RankBadge rank={formatRank(hit.rank)} strong={isStrong(hit.confidence)} size="modal" />
          <span className="bg-bg/80 px-2.5 py-[5px] text-[13px] leading-none">
            {formatPercent(hit.confidence)} match{position && ` · ${position.index} of ${position.of}`}
          </span>
        </div>
      )}

      <button type="button" onClick={onPrev} disabled={!onPrev} aria-label="Previous image" className={`${arrow} left-4`}>
        <ChevronIcon direction="left" size={20} />
      </button>
      <button type="button" onClick={onNext} disabled={!onNext} aria-label="Next image" className={`${arrow} right-4`}>
        <ChevronIcon size={20} />
      </button>

      {source && (
        <div className="absolute inset-x-5 bottom-[18px] flex items-center justify-between gap-3">
          {size ? <span className="bg-bg/80 px-[9px] py-[5px] text-xs text-[#C9C7C1]">{size}</span> : <span />}
          {/* The API has only the medium rendition, so the link says what it opens. */}
          <a
            href={source.image_url}
            target="_blank"
            rel="noreferrer"
            className="border border-[#3A3A40] bg-bg/80 px-3 py-[7px] text-[13px] transition-colors hover:border-faint"
          >
            Open image ↗
          </a>
        </div>
      )}
    </div>
  );
}
