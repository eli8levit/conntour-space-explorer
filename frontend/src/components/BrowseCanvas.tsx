import { useRef, type MouseEvent, type PointerEvent, type ReactNode } from "react";

// The canvas grid is wider and taller than the window and starts off-screen
// (left −262, top −96), so frames are cropped at every edge: a window onto a
// bigger table, not a page.
const START_X = -262;
const START_Y = -96;
// Movement below this many pixels is a click, not a drag.
const DRAG_THRESHOLD = 4;

/**
 * A1 canvas: drifts very slowly (CSS, paused on hover and off under reduced
 * motion) and pans with the pointer. Panning writes the transform straight
 * to the element: a re-render per pointer move would be wasted work.
 */
export function BrowseCanvas({ children }: { children: ReactNode }) {
  const viewport = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const offset = useRef({ x: 0, y: 0 });
  const justDragged = useRef(false);
  const drag = useRef<{ startX: number; startY: number; fromX: number; fromY: number; moved: boolean } | null>(null);

  /** Keeps the grid covering the window: it cannot be dragged past its own edges. */
  function clamp(x: number, y: number) {
    const view = viewport.current!.getBoundingClientRect();
    const size = grid.current!.getBoundingClientRect();
    const minX = view.width - size.width - START_X;
    const minY = view.height - size.height - START_Y;
    return {
      x: Math.min(-START_X, Math.max(Math.min(minX, -START_X), x)),
      y: Math.min(-START_Y, Math.max(Math.min(minY, -START_Y), y)),
    };
  }

  function onPointerDown(event: PointerEvent) {
    justDragged.current = false;
    if (event.button !== 0) return;
    drag.current = { startX: event.clientX, startY: event.clientY, fromX: offset.current.x, fromY: offset.current.y, moved: false };
  }

  function onPointerMove(event: PointerEvent) {
    const state = drag.current;
    if (!state) return;
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    if (!state.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!state.moved) {
      state.moved = true;
      // Capture only once it is a real drag, so a plain click still reaches the frame link.
      viewport.current?.setPointerCapture(event.pointerId);
    }
    offset.current = clamp(state.fromX + dx, state.fromY + dy);
    grid.current!.style.transform = `translate(${offset.current.x}px, ${offset.current.y}px)`;
  }

  function onPointerUp() {
    justDragged.current = drag.current?.moved ?? false;
    drag.current = null;
  }

  // A drag must not end with a click on the frame under the pointer (that would open it).
  function onClickCapture(event: MouseEvent) {
    if (!justDragged.current) return;
    event.preventDefault();
    justDragged.current = false;
  }

  return (
    <div
      ref={viewport}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClickCapture={onClickCapture}
      // touch-none: on a phone the finger pans the canvas instead of scrolling the page.
      className="group/canvas fixed inset-0 cursor-grab touch-none select-none overflow-hidden active:cursor-grabbing"
    >
      <div ref={grid} className="absolute w-[1976px]" style={{ left: START_X, top: START_Y }}>
        <ul className="animate-drift grid grid-flow-row-dense grid-cols-[repeat(16,116px)] auto-rows-[116px] gap-2 group-hover/canvas:[animation-play-state:paused]">
          {children}
        </ul>
      </div>
      {/* A1·11: the bottom scrim, so the dock reads over the photos. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[220px] bg-[linear-gradient(to_bottom,rgba(9,9,10,0),rgba(9,9,10,0.95)_55%)]" />
    </div>
  );
}
