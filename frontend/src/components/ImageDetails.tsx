import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { SearchHit, Source } from "../api/types";
import { displayTitle, nasaTitleIfDifferent, titleForMatching } from "../lib/displayTitle";
import { eyebrow, parseCaption } from "../lib/details";
import { bodyLabel, formatCoordinates, formatDate, formatPercent, provenanceLabel, scoreBreakdown, yearOf } from "../lib/format";
import { queryTerms } from "../lib/highlight";
import { isStrong, matchedTerms, whyLine } from "../lib/match";
import { yearSentence, type YearRange } from "../lib/timeline";
import { HighlightedText } from "./HighlightedText";
import { CloseIcon } from "./Icons";
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

  return (
    <div className="flex min-h-full flex-col gap-5 px-5 pb-6 pt-[26px] sm:px-[30px]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-[13px] text-muted">{eyebrow(source)}</span>
          {/* Focus starts on the title (not the × button), so screen readers announce where they are. */}
          <h2 tabIndex={-1} data-initial-focus className="text-balance text-[32px] leading-none tracking-[-0.025em] focus-visible:outline-none sm:text-[44px]">
            <HighlightedText text={title} terms={terms} />
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="flex h-9 w-9 shrink-0 items-center justify-center border border-line-strong transition-colors hover:border-faint"
        >
          <CloseIcon />
        </button>
      </div>

      <Description text={caption.text} terms={terms} />
      <MetaGrid source={source} caption={caption} />
      <Keywords keywords={source.keywords} terms={terms} />

      <div className={`grid gap-7 border-t border-line pt-4 ${hit && query ? "sm:grid-cols-2" : ""}`}>
        {hit && query && <MatchBlock hit={hit} query={query} semanticOn={semanticOn} />}
        {archive.length > 0 && <PlaceInTime source={source} archive={archive} extent={extent} />}
      </div>

      {source.place && <WhereSeen source={source} />}
    </div>
  );
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
  return (
    <dl className="grid grid-cols-2 border-t border-line sm:grid-cols-3">
      {fields.map(([label, value]) => (
        // The last column needs no gutter: "NASA/JPL-Caltech/ASU" then fits on one line, as in the design.
        <div key={label} className="flex min-w-0 flex-col gap-1 border-b border-line py-3 pr-3 sm:[&:nth-child(3n)]:pr-0">
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
  const why = whyLine(matchedTerms(query, { ...hit.source, title: titleForMatching(hit.source) }), hit.semantic_score);
  return (
    <div className="group relative flex flex-col gap-1.5">
      <span className="text-xs text-muted">Match for “{query}”</span>
      <span className={`text-[40px] leading-none tracking-[-0.03em] ${strong ? "text-accent-text" : "text-fg"}`}>
        {formatPercent(hit.confidence)}
      </span>
      <ConfidenceBar confidence={hit.confidence} variant="detail" className="mt-1" />
      <span className="text-xs leading-normal text-muted">{why}.</span>
      {/* The breakdown: on hover for a mouse, always in the accessibility tree. */}
      <span className="text-[11px] text-faint opacity-0 transition-opacity group-hover:opacity-100 [@media(hover:none)]:opacity-100">
        {scoreBreakdown(hit, semanticOn)}
      </span>
    </div>
  );
}

/** A3·11: when it was taken, against the whole archive. */
function PlaceInTime({ source, archive, extent }: { source: Source; archive: Source[]; extent: YearRange }) {
  const year = yearOf(source.date_created);
  const sameYear = archive.filter((item) => yearOf(item.date_created) === year).length;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted">Its place in time</span>
      <span className="text-[13px]">{yearSentence(year, sameYear)}</span>
      <MiniTimeline sources={archive} extent={extent} current={source} />
    </div>
  );
}

/** A3·12–13: where it was seen, how we know, and the door into the Space view. */
function WhereSeen({ source }: { source: Source }) {
  const place = source.place!;
  const coordinates = formatCoordinates(place);
  const body = bodyLabel(place.body);
  const label = place.label === body ? body : `${place.label}, ${body}`;
  return (
    <div className="mt-auto grid items-center gap-[18px] border-t border-line pt-[18px] sm:grid-cols-[220px_minmax(0,1fr)]">
      <div className="h-[150px] w-[220px] border border-line bg-[#050506]">
        <LocatorMini place={place} />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted">Where this was seen</span>
        <span className="text-[17px]">{label}</span>
        {coordinates && <span className="text-xs text-soft">{coordinates}</span>}
        <span className="text-xs text-faint">{provenanceLabel(place.provenance)}</span>
        <Link to={`/scene?focus=${source.id}`} className="mt-1 text-[13px] underline underline-offset-2 hover:text-accent-text">
          Fly there in Space view →
        </Link>
      </div>
    </div>
  );
}
