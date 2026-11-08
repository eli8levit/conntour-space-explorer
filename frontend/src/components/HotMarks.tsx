/**
 * The "hot" frame treatment (A1·5): a 1px orange outline, four corner
 * brackets just outside the frame and a faint crosshair through the middle.
 * Drawn on top of a `relative` frame; it never takes pointer events.
 */
export function HotMarks() {
  const bracket = "pointer-events-none absolute h-[14px] w-[14px] border-accent";
  return (
    <span aria-hidden="true">
      <span className="pointer-events-none absolute inset-0 outline outline-1 outline-accent" />
      <span className={`${bracket} -left-1.5 -top-1.5 border-l-[1.5px] border-t-[1.5px]`} />
      <span className={`${bracket} -right-1.5 -top-1.5 border-r-[1.5px] border-t-[1.5px]`} />
      <span className={`${bracket} -bottom-1.5 -left-1.5 border-b-[1.5px] border-l-[1.5px]`} />
      <span className={`${bracket} -bottom-1.5 -right-1.5 border-b-[1.5px] border-r-[1.5px]`} />
      <span className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-accent/55" />
      <span className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-accent/55" />
    </span>
  );
}
