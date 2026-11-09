// The Space Explorer mark: a ranked result set in miniature (the A2 reflow).
// Rank 1 is the big orange frame; rank 2 off-white; ranks 3-4 mid grey; the rest dark.
// Inline SVG so it inherits the design tokens. Same geometry as brand/mark.svg (32-unit grid).
type Props = { size?: number; className?: string; title?: string };

const CELLS: [x: number, y: number, size: number, fill: string][] = [
  [5, 5, 14, "rgb(var(--color-accent))"],  // rank 1
  [21, 5, 6, "rgb(var(--color-fg))"],      // rank 2
  [21, 13, 6, "rgb(var(--color-fg) / 0.55)"],
  [5, 21, 6, "rgb(var(--color-fg) / 0.55)"],
  [13, 21, 6, "rgb(var(--color-fg) / 0.2)"],
  [21, 21, 6, "rgb(var(--color-fg) / 0.2)"],
];

export function Mark({ size = 20, className, title }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      {CELLS.map(([x, y, s, fill]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={s} height={s} fill={fill} />
      ))}
    </svg>
  );
}
