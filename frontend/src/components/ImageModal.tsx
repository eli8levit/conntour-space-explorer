import { useEffect, useRef, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import type { Source } from "../api/types";
import { useSimilar, useSource } from "../hooks/sources";
import { useImageParam } from "../hooks/useImageParam";
import { bodyLabel, formatCoordinates, formatDate, formatPercent, provenanceLabel } from "../lib/format";
import { ErrorState } from "./ErrorState";

/**
 * Image detail, opened by ?image=<id> in the URL on any page. Mounted once
 * in the Layout, so Browse and Search results share it.
 */
export function ImageModal() {
  const { imageId, closeImage } = useImageParam();
  if (imageId === null) return null;
  return <ImageDialog id={imageId} onClose={closeImage} />;
}

function ImageDialog({ id, onClose }: { id: number; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const source = useSource(id);

  // The native <dialog> with showModal() gives us, for free: a focus trap,
  // an inert page behind it, and the Esc key (the "cancel" event below).
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    // Remember what had focus (the card link), so closing returns focus to it.
    const opener = document.activeElement as HTMLElement | null;
    element.showModal();
    document.body.style.overflow = "hidden"; // stop the page scrolling behind
    return () => {
      element.close();
      document.body.style.overflow = "";
      opener?.focus();
    };
  }, []);

  // "More like this" swaps the image inside the open dialog: go back to the
  // top and move focus to the new title (the clicked link may no longer exist).
  const firstId = useRef(id);
  useEffect(() => {
    if (id === firstId.current) return;
    dialog.current?.scrollTo({ top: 0 });
    heading.current?.focus();
  }, [id]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="image-dialog-title"
      onCancel={(event) => {
        // Esc: let the URL close the dialog (same path as Back), not the browser.
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // A click on the dialog element itself (not its content) is a click on the backdrop.
        if (event.target === event.currentTarget) onClose();
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-5xl overflow-y-auto rounded border border-line bg-surface text-fg backdrop:bg-black/75"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line bg-surface px-4 py-3">
        <h2
          id="image-dialog-title"
          ref={heading}
          tabIndex={-1}
          className="truncate text-sm font-medium focus-visible:outline-none"
        >
          {source.data?.title ?? "Loading…"}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-sm px-2 py-1 text-sm text-muted hover:text-fg"
        >
          Close<span className="sr-only"> image details</span>
        </button>
      </div>

      <div className="p-4">
        {source.isPending && <div className="aspect-[4/3] animate-pulse rounded-sm bg-raised" />}
        {source.isError && (
          <ErrorState title="Could not load this image" error={source.error} onRetry={() => void source.refetch()} />
        )}
        {source.data && <SourceDetails source={source.data} />}
        <MoreLikeThis id={id} />
      </div>
    </dialog>
  );
}

function SourceDetails({ source }: { source: Source }) {
  const place = source.place;
  const coordinates = place ? formatCoordinates(place) : null;
  return (
    <div className="grid gap-6 md:grid-cols-[3fr_2fr]">
      <a href={source.image_url} target="_blank" rel="noreferrer" className="block rounded-sm">
        <img
          src={source.image_url}
          alt={source.title}
          className="max-h-[70vh] w-full rounded-sm border border-line bg-bg object-contain"
        />
        <span className="sr-only">Open the full image in a new tab</span>
      </a>

      <div className="min-w-0 text-sm">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          <Field label="NASA ID">
            <span className="font-mono">{source.nasa_id}</span>
          </Field>
          <Field label="Date">
            <span className="font-mono">{formatDate(source.date_created)}</span>
          </Field>
          <Field label="Center">{source.center}</Field>
          {source.photographer && <Field label="Photographer">{source.photographer}</Field>}
          {source.location && <Field label="Location">{source.location}</Field>}
          {place && (
            <Field label="Place">
              {place.label}
              <span className="block text-xs text-muted">
                {bodyLabel(place.body)}
                {coordinates && <span className="font-mono"> · {coordinates}</span>}
                {" · "}
                {provenanceLabel(place.provenance)}
              </span>
            </Field>
          )}
        </dl>

        {source.keywords.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Keywords">
            {source.keywords.map((keyword) => (
              <li key={keyword} className="rounded-sm border border-line px-1.5 py-0.5 text-xs text-muted">
                {keyword}
              </li>
            ))}
          </ul>
        )}

        {/* NASA captions use line breaks as paragraphs, so we keep them. */}
        <p className="mt-4 whitespace-pre-line break-words leading-relaxed text-muted">{source.description}</p>

        <a
          href={`https://images.nasa.gov/details/${encodeURIComponent(source.nasa_id)}`}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-block rounded-sm text-sm underline underline-offset-4 hover:text-fg"
        >
          View the original on images.nasa.gov
        </a>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  );
}

function MoreLikeThis({ id }: { id: number }) {
  const similar = useSimilar(id);
  const { imageLink } = useImageParam();
  // Keep the router state (opened in app or not), so Close still behaves the same.
  const location = useLocation();

  if (similar.isPending) return null;
  if (similar.isError || similar.data.length === 0) {
    return <p className="mt-8 text-xs text-faint">No similar images available.</p>;
  }
  return (
    <section className="mt-8 border-t border-line pt-4" aria-labelledby="similar-title">
      <h3 id="similar-title" className="text-xs uppercase tracking-wider text-muted">
        More like this
      </h3>
      <ul className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-6">
        {similar.data.map((hit) => (
          <li key={hit.source.id}>
            {/* replace: swapping images should not add Back steps. */}
            <Link to={imageLink(hit.source.id)} replace state={location.state} className="group block rounded-sm">
              <img
                src={hit.source.thumb_url}
                alt=""
                loading="lazy"
                width={160}
                height={120}
                className="aspect-[4/3] w-full rounded-sm border border-line bg-raised object-cover group-hover:opacity-90"
              />
              <span className="mt-1 block truncate text-xs">{hit.source.title}</span>
              <span className="block font-mono text-[11px] text-faint">{formatPercent(hit.confidence)} similar</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
