// The few line icons the design uses. Inline SVG: no icon library for five glyphs.
// `currentColor` lets the parent's text color paint them.

interface IconProps {
  size?: number;
  className?: string;
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  "aria-hidden": true,
});

export function SearchIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={1.7} className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </svg>
  );
}

export function HistoryIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={1.6} className={className}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function ChevronIcon({ size = 14, direction = "right", className }: IconProps & { direction?: "left" | "right" }) {
  return (
    <svg {...base(size)} strokeWidth={1.8} className={className}>
      <path d={direction === "right" ? "M9 6l6 6-6 6" : "M15 6l-6 6 6 6"} />
    </svg>
  );
}

export function CloseIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={1.8} className={className}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/** A map pin: marks the place line under the locator. */
export function PinIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={1.6} className={className}>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </svg>
  );
}
