import { useState } from "react";
import { Link } from "react-router-dom";
import type { Source } from "../api/types";
import { OPENED_IN_APP } from "../hooks/useImageParam";
import { isBigFrame } from "../lib/canvas";
import { displayTitle } from "../lib/displayTitle";
import { bodyLabel, formatCoordinates, formatDate, yearOf } from "../lib/format";
import type { Span } from "../lib/match";
import { FadeImage } from "./FadeImage";
import { HotMarks } from "./HotMarks";

interface CanvasFrameProps {
  source: Source;
  span: Span;
  /** "013": the position in date order. */
  plate: string;
  to: string;
}

// A frame this close to the right edge shows its annotation on the left instead.
const ANNOTATION_ROOM = 300;

/**
 * One photo on the A1 canvas. Big frames (4+ cells) carry a title caption,
 * small ones only the plate number. Hover or keyboard focus makes the frame
 * "hot": orange brackets, crosshair and an annotation beside it.
 */
export function CanvasFrame({ source, span, plate, to }: CanvasFrameProps) {
  const [flip, setFlip] = useState(false);
  const title = displayTitle(source);
  const year = yearOf(source.date_created);

  // Measured when the frame becomes hot, so the annotation never runs off screen.
  function placeAnnotation(element: HTMLElement) {
    setFlip(element.getBoundingClientRect().right + ANNOTATION_ROOM > window.innerWidth);
  }

  return (
    <li
      className="group relative hover:z-10 has-[:focus-visible]:z-10"
      style={{ gridColumn: `span ${span[0]}`, gridRow: `span ${span[1]}` }}
    >
      <Link
        to={to}
        state={OPENED_IN_APP}
        draggable={false}
        aria-label={`${title}, ${year}`}
        onPointerEnter={(event) => placeAnnotation(event.currentTarget)}
        onFocus={(event) => placeAnnotation(event.currentTarget)}
        // The hot treatment replaces the default focus ring here.
        className="block h-full w-full overflow-hidden bg-raised focus-visible:outline-none"
      >
        <FadeImage src={source.thumb_url} loading="lazy" decoding="async" className="h-full w-full object-cover" />
      </Link>

      {isBigFrame(span) ? (
        <>
          <span className="pointer-events-none absolute bottom-2 left-2 flex max-w-[calc(100%-16px)] flex-col items-start gap-0.5">
            <span className="max-w-full truncate bg-[var(--chip-bg)] px-[7px] py-[3px] text-xs">{title}</span>
            <span className="max-w-full truncate bg-[var(--chip-bg)] px-1.5 py-0.5 text-[10px] text-muted">
              {source.nasa_id} · {source.center} · {year}
            </span>
          </span>
          <span className="pointer-events-none absolute right-2 top-2 bg-[var(--chip-bg)] px-[5px] py-0.5 text-[10px]">
            {plate}
          </span>
        </>
      ) : (
        <span className="pointer-events-none absolute bottom-1.5 left-1.5 bg-bg/70 px-1 py-px text-[9px]">{plate}</span>
      )}

      <span className="hidden group-hover:block group-has-[:focus-visible]:block">
        <HotMarks />
        <Annotation source={source} title={title} flip={flip} />
      </span>
    </li>
  );
}

/** A1·6: three chips beside the hot frame: what it is, when and where, and coordinates if known. */
function Annotation({ source, title, flip }: { source: Source; title: string; flip: boolean }) {
  const coordinates = source.place ? formatCoordinates(source.place) : null;
  const where = source.place ? ` · ${bodyLabel(source.place.body)}` : "";
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute top-2.5 z-30 flex flex-col gap-0.5 whitespace-nowrap text-[11px] ${
        flip ? "right-[calc(100%+14px)] items-end" : "left-[calc(100%+14px)] items-start"
      }`}
    >
      <span className="bg-accent px-[7px] py-[3px] font-medium text-bg">
        {title} · {source.nasa_id}
      </span>
      <span className="bg-bg px-[7px] py-[3px] text-accent-text">
        {source.center} · {formatDate(source.date_created)}
        {where}
      </span>
      {coordinates && <span className="bg-bg px-[7px] py-[3px] text-muted">{coordinates}</span>}
    </span>
  );
}
