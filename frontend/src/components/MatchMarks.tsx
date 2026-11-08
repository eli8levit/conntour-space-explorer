// The two marks that carry a match score everywhere: the rank badge and the
// confidence bar. Two tiers only: strong (orange) and faint (off-white).
import { isStrong } from "../lib/match";

interface ConfidenceBarProps {
  confidence: number;
  /** "rail" bars are 2px with a grey faint fill; "frame" bars are 3px with an off-white faint fill. */
  variant?: "frame" | "rail" | "detail";
  className?: string;
}

const BAR_STYLE = {
  frame: { height: "h-[3px]", track: "bg-track", faint: "bg-fg" },
  rail: { height: "h-[2px]", track: "bg-line", faint: "bg-bar-faint" },
  detail: { height: "h-[2px]", track: "bg-track", faint: "bg-fg" },
} as const;

/** A track the width of its container, filled to `confidence × 100%`. */
export function ConfidenceBar({ confidence, variant = "frame", className = "" }: ConfidenceBarProps) {
  const style = BAR_STYLE[variant];
  const width = `${Math.round(Math.min(1, Math.max(0, confidence)) * 100)}%`;
  return (
    <span aria-hidden="true" className={`relative block ${style.height} ${style.track} ${className}`}>
      <span
        className={`absolute inset-y-0 left-0 ${isStrong(confidence) ? "bg-accent" : style.faint}`}
        style={{ width }}
      />
    </span>
  );
}

const BADGE_SIZE = {
  hero: "px-3 py-1.5 text-[26px] leading-none",
  large: "px-[9px] py-[5px] text-[17px] leading-none",
  small: "px-1.5 py-[3px] text-xs leading-none",
  modal: "px-[9px] py-[5px] text-[13px] leading-none",
} as const;

interface RankBadgeProps {
  rank: string;
  strong: boolean;
  size: keyof typeof BADGE_SIZE;
  className?: string;
}

/** Square badge with the zero-padded rank: orange fill when strong, off-white when faint. */
export function RankBadge({ rank, strong, size, className = "" }: RankBadgeProps) {
  return (
    <span
      className={`font-semibold text-bg ${strong ? "bg-accent" : "bg-fg"} ${BADGE_SIZE[size]} ${className}`}
    >
      {rank}
    </span>
  );
}
