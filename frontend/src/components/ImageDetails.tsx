import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Link } from "react-router-dom";
import type { SearchHit, Source } from "../api/types";
import { displayTitle, nasaTitleIfDifferent } from "../lib/displayTitle";
import { eyebrow, parseCaption } from "../lib/details";
import { bodyLabel, formatDate, formatPercent, idRuleNote, provenanceLabel, scoreBreakdown, yearOf } from "../lib/format";
import { queryTerms } from "../lib/highlight";
import { isStrong, matchedTerms, whyLine } from "../lib/match";
import { yearSentence, type YearRange } from "../lib/timeline";
import { HighlightedText } from "./HighlightedText";
import { CloseIcon, PinIcon } from "./Icons";
import { LocatorMini } from "./LocatorMini";
import { ConfidenceBar } from "./MatchMarks";
import { MiniTimeline } from "./MiniTimeline";

interface ImageDetailsProps {
  source: Source;
  /** The search result for this image, when it was opened from A2 and matched. */
  hit: SearchHit | null;
  query: string | null;
  semanticOn: boolean;
  archive: Source[];
  extent: YearRange;
  onClose: () => void;
}

/** A3's right column: what the image is, the NASA record, why it matched, and where and when it was taken. */
export function ImageDetails({ source, hit, query, semanticOn, archive, extent, onClose }: ImageDetailsProps) {
  const title = displayTitle(source);
  const caption = parseCaption(source.description);
  const terms = query ? queryTerms(query) : [];

  const heading = useRef<HTMLHeadingElement>(null);
  const condensed = useScrolledPast(heading);

  return (
    <div className="flex min-h-full flex-col gap-5 px-5 pb-6 sm:px-[30px]">
      {/*
        The sticky bar. Zero height, so it never pushes the content: it only paints over it.
        Once the big title has scrolled under it, the bar gets a background and the title in
        small type; the × stays in reach the whole time.
      */}
      <div className="sticky top-0 z-20 -mx-5 h-0 sm:-mx-[30px]">
        <div
          className={`pointer-events-none absolute inset-x-0 top-0 flex h-16 items-start gap-4 border-b px-5 pt-3.5 transition-colors duration-200 sm:px-[30px] ${
            condensed ? "border-line bg-[#0D0D0F]/95 backdrop-blur-[10px]" : "border-transparent"
          }`}
        >
          <span
            aria-hidden="true"
            className={`mt-[7px] min-w-0 flex-1 truncate text-[17px] leading-tight transition-opacity duration-200 ${
              condensed ? "opacity-100" : "opacity-0"
            }`}
          >
            {title}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            // Lower while the big title shows (aligned with its eyebrow, as in the design), centred in the bar after.
            className={`pointer-events-auto ml-auto flex h-9 w-9 shrink-0 items-center justify-center border border-line-strong bg-[#0D0D0F] transition-[transform,border-color] duration-200 hover:border-faint ${
              condensed ? "" : "translate-y-3"
            }`}
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-1.5 pr-14 pt-1.5">
        <span className="text-[13px] text-muted">{eyebrow(source)}</span>
        {/* Focus starts on the title (not the × button), so screen readers announce where they are. */}
        <h2
          ref={heading}
          tabIndex={-1}
          data-initial-focus
          className="text-balance text-[32px] leading-none tracking-[-0.025em] focus-visible:outline-none sm:text-[44px]"
        >
          <HighlightedText text={title} terms={terms} />
        </h2>
      </div>

      {/* Where first: the place is the special feature, so it is on screen when the modal opens. */}
      {source.place && <WhereSeen source={source} />}

      <div className={`grid gap-7 ${hit && query ? "sm:grid-cols-2" : ""}`}>
        {hit && query && <MatchBlock hit={hit} query={query} semanticOn={semanticOn} />}
        {archive.length > 0 && <PlaceInTime source={source} archive={archive} extent={extent} />}
      </div>

      <Description text={caption.text} terms={terms} />
      <MetaGrid source={source} caption={caption} />
      <Keywords keywords={source.keywords} terms={terms} />
    </div>
  );
}

/** The sticky bar's height: the title counts as scrolled away once it is under the bar. */
const BAR_HEIGHT = 64;

/** True once `target` has scrolled up under the sticky bar of its scrolling column. */
function useScrolledPast(target: RefObject<HTMLElement>) {
  const [past, setPast] = useState(false);
  useEffect(() => {
    const element = target.current;
    if (!element) return;
    // The column that scrolls: the nearest ancestor with overflow-y auto (the modal's details column).
    let root: HTMLElement | null = element.parentElement;
    while (root && !/(auto|scroll)/.test(getComputedStyle(root).overflowY)) root = root.parentElement;
    const observer = new IntersectionObserver(
      ([entry]) => setPast(!entry!.isIntersecting && entry!.boundingClientRect.top < (entry!.rootBounds?.top ?? 0) + BAR_HEIGHT),
      { root, rootMargin: `-${BAR_HEIGHT}px 0px 0px 0px` },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [target]);
  return past;
}

// About 8 lines at 15px / 1.6.
const CLAMP_HEIGHT = 8 * 15 * 1.6;

/** A3·7: the full NASA caption, query words underlined; long captions fold after ~8 lines. */
function Description({ text, terms }: { text: string; terms: string[] }) {
  const paragraph = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  // Measured after layout: whether the text is longer than the fold depends on the column width.
  useLayoutEffect(() => {
    if (paragraph.current) setOverflows(paragraph.current.scrollHeight > CLAMP_HEIGHT + 2);
  }, [text]);

  if (!text) return <p className="text-[15px] text-muted">No description in the NASA record.</p>;
  return (
    <div>
      {/* NASA captions use line breaks as paragraphs, so we keep them. */}
      <p
        ref={paragraph}
        className="overflow-hidden whitespace-pre-line break-words text-[15px] leading-[1.6] text-soft"
        style={{ maxHeight: expanded ? undefined : CLAMP_HEIGHT }}
      >
        <HighlightedText text={text} terms={terms} />
      </p>
      {overflows && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-1.5 text-[13px] text-muted underline underline-offset-2 hover:text-fg"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

/** A3·8: three columns of label-over-value. Only fields the record has; nothing left blank. */
function MetaGrid({ source, caption }: { source: Source; caption: ReturnType<typeof parseCaption> }) {
  const instrument = [caption.instrument, caption.orbit && `orbit ${caption.orbit}`].filter(Boolean).join(" · ");
  const fields: [string, ReactNode][] = [
    ["Taken", formatDate(source.date_created)],
    ["Center", source.center],
    ["NASA ID", <span className="text-[13px]">{source.nasa_id}</span>],
  ];
  if (source.photographer) fields.push(["Photographer", source.photographer]);
  if (source.location) fields.push(["Location", source.location]);
  if (instrument) fields.push(["Instrument", instrument]);
  if (caption.captured) fields.push(["Captured", <span className="text-[13px]">{caption.captured}</span>]);
  // The record's credit (photographer, else secondary_creator), else the caption's "Photo credit:".
  // A credit that only repeats the Photographer cell is left out. Credit is the one group we say
  // is missing, so a reader does not wonder whether we lost it.
  const credit = [source.credit, caption.credit].find((value) => value && value !== source.photographer);
  if (credit) fields.push(["Credit", credit]);
  else if (!source.photographer) fields.push(["Credit", <span className="text-muted">Not in the NASA record</span>]);

  const nasaTitle = nasaTitleIfDifferent(source);
  // The last cell takes what is left of its row, so every row's rule runs the full width
  // (2 columns on a phone, 3 from sm). Static class names: Tailwind only sees literal strings.
  const n = fields.length;
  const lastSpan = `${n % 2 === 1 ? "col-span-2" : ""} ${["sm:col-span-1", "sm:col-span-3", "sm:col-span-2"][n % 3]}`;
  return (
    <dl className="grid grid-cols-2 border-t border-line sm:grid-cols-3">
      {fields.map(([label, value], index) => (
        // The last column needs no gutter: "NASA/JPL-Caltech/ASU" then fits on one line, as in the design.
        <div
          key={label}
          className={`flex min-w-0 flex-col gap-1 border-b border-line py-3 pr-3 sm:[&:nth-child(3n)]:pr-0 ${index === n - 1 ? lastSpan : ""}`}
        >
          <dt className="text-xs text-muted">{label}</dt>
          <dd className="break-words text-sm">{value}</dd>
        </div>
      ))}
      {/* The title above is ours; this is NASA's own, which can be a whole caption, so it folds to two lines. */}
      {nasaTitle && (
        <div className="col-span-full flex min-w-0 flex-col gap-1 border-b border-line py-3 pr-3">
          <dt className="text-xs text-muted">NASA title</dt>
          <dd className="line-clamp-2 break-words text-sm" title={nasaTitle.length > 120 ? nasaTitle : undefined}>
            {nasaTitle}
          </dd>
        </div>
      )}
    </dl>
  );
}

/** A3·9: keyword chips; the ones that matched the query are outlined in orange. */
function Keywords({ keywords, terms }: { keywords: string[]; terms: string[] }) {
  if (keywords.length === 0) return <p className="text-xs text-muted">No keywords in the NASA record.</p>;
  const wanted = new Set(terms);
  const matches = (keyword: string) => queryTerms(keyword).some((term) => wanted.has(term));
  const anyMatch = keywords.some(matches);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ul aria-label="Keywords" className="contents">
        {keywords.map((keyword) => (
          <li
            key={keyword}
            className={`border px-2.5 py-[5px] text-[13px] leading-tight ${
              matches(keyword) ? "border-accent text-accent-text" : "border-[#2E2E33]"
            }`}
          >
            {keyword}
          </li>
        ))}
      </ul>
      {anyMatch && <span className="ml-1 text-xs text-muted">Highlighted words matched your search</span>}
    </div>
  );
}

/** A3·10: how well it matched, and why. */
function MatchBlock({ hit, query, semanticOn }: { hit: SearchHit; query: string; semanticOn: boolean }) {
  const strong = isStrong(hit.confidence);
  const why = whyLine(
    matchedTerms(query, { ...hit.source, title: displayTitle(hit.source), nasaTitle: nasaTitleIfDifferent(hit.source) }),
    hit.semantic_score,
    idRuleNote(hit.id_rule, query),
  );
  const bar = useRef<HTMLDivElement>(null);
  const percent = useRef<HTMLSpanElement>(null);
  useFillIn(bar, percent, hit.confidence);
  return (
    // Built like "Its place in time" beside it: label, one sentence, then the figure at the
    // bottom, so the bar lines up with the timeline's axis and the labels share a line.
    <div className="group flex flex-col gap-1.5">
      {/* The query as an orange chip, like the matched keyword chips, so it is easy to find. */}
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        Match for
        <span className="-my-[3px] max-w-full break-words border border-accent px-2 py-px text-[13px] leading-tight text-accent-text">
          {query}
        </span>
      </span>
      <span className="text-[13px]">{why}.</span>
      {/* sm:pb-5: the height of the timeline's year labels, so the bar sits on its axis line (side by side only). */}
      <div className="mt-auto flex flex-col gap-2.5 pt-2 sm:pb-5">
        <div className="flex items-baseline justify-between gap-3">
          <span
            ref={percent}
            className={`text-[40px] tabular-nums leading-none tracking-[-0.03em] ${strong ? "text-accent-text" : "text-fg"}`}
          >
            {formatPercent(hit.confidence)}
          </span>
          {/* The breakdown: on hover for a mouse, always on touch, always in the accessibility tree. */}
          <span className="text-right text-[11px] text-faint opacity-0 transition-opacity group-hover:opacity-100 [@media(hover:none)]:opacity-100">
            {scoreBreakdown(hit, semanticOn, query)}
          </span>
        </div>
        <div ref={bar}>
          <ConfidenceBar confidence={hit.confidence} variant="detail" />
        </div>
      </div>
    </div>
  );
}

// The fill starts once the dialog has settled, and is slow enough to read as "measuring".
const FILL = { delay: 220, duration: 900 };

/**
 * On open (and on prev/next, which remounts the column), the confidence bar
 * fills from 0 and the % counts up with it. Both write to the DOM directly:
 * the Web Animations API for the bar, textContent for the number, so the
 * animation never re-renders React. Under reduced motion both start final.
 */
function useFillIn(bar: RefObject<HTMLElement>, percent: RefObject<HTMLElement>, confidence: number) {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const fill = bar.current?.querySelector<HTMLElement>("span > span");
    const number = percent.current;
    if (!fill || !number) return;
    const easing = "cubic-bezier(0.22, 1, 0.36, 1)"; // ease-out: fast start, gentle landing
    const animation = fill.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], {
      ...FILL,
      easing,
      fill: "backwards", // hold at 0 during the delay
    });
    fill.style.transformOrigin = "left";

    // The number follows the same curve (an ease-out cubic is close to that bezier).
    const start = performance.now() + FILL.delay;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / FILL.duration));
      number.textContent = formatPercent(confidence * (1 - (1 - t) ** 3));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      animation.cancel();
      cancelAnimationFrame(frame);
      number.textContent = formatPercent(confidence);
    };
  }, [bar, percent, confidence]);
}

/** A3·11: when it was taken, against the whole archive. */
function PlaceInTime({ source, archive, extent }: { source: Source; archive: Source[]; extent: YearRange }) {
  const year = yearOf(source.date_created);
  const sameYear = archive.filter((item) => yearOf(item.date_created) === year).length;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted">Its place in time</span>
      <span className="text-[13px]">{yearSentence(year, sameYear)}</span>
      <div className="mt-auto">
        <MiniTimeline sources={archive} extent={extent} current={source} />
      </div>
    </div>
  );
}

/**
 * A3·12–13: where it was seen. The locator spans the column; under it, one
 * line: the place, and the door into the Space view. How we know the place
 * is in the locator's corner and in the tooltip.
 */
function WhereSeen({ source }: { source: Source }) {
  const place = source.place!;
  const body = bodyLabel(place.body);
  const label = place.label === body ? body : `${place.label}, ${body}`;
  return (
    <section aria-label="Where this was seen" className="flex flex-col gap-3">
      <div className="border border-line">
        <LocatorMini place={place} sourceId={source.id} />
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <span className="flex min-w-0 items-baseline gap-2 text-[17px] leading-tight" title={`Place ${provenanceLabel(place.provenance)}`}>
          <PinIcon size={16} className="shrink-0 translate-y-[2px] text-muted" />
          <span className="min-w-0">{label}</span>
        </span>
        <Link
          to={`/scene?focus=${source.id}`}
          className="shrink-0 text-[13px] underline underline-offset-2 hover:text-accent-text"
        >
          Fly there in Space view →
        </Link>
      </div>
    </section>
  );
}
