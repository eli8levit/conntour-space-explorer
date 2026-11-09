import {
  memo,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type MouseEvent,
  type PointerEvent,
  type WheelEvent,
} from "react";
import { flushSync } from "react-dom";
import type { Source } from "../api/types";
import { useReducedMotion } from "../scene/useReducedMotion";
import { GAP, PITCH, formatPlate, packRound, shuffle, spanFor, type Round } from "../lib/canvas";
import { frameTransitionName } from "../lib/viewTransition";
import { CanvasFrame } from "./CanvasFrame";

// The canvas scrolls upward on its own, forever. It is built from "rounds":
// each round is the whole archive in a new random order, packed into a full
// rectangle. Rounds stack below each other; when one has left the top of the
// window it is dropped and a freshly shuffled one joins at the bottom.
// So at most 3–4 rounds exist in the DOM at any time.

/** Upward speed, px per second. */
const SPEED = 18;
/** Seconds to ease to a new speed (stop on hover, start again after). */
const EASE = 0.45;
/** The first round starts a little above the window, so frames are cropped at the top edge too. */
const START_OFFSET = 96;
/** Rows on each side of a seam between rounds that must not share a photo. */
const SEAM_ROWS = 4;
// Movement below this many pixels is a click, not a drag.
const DRAG_THRESHOLD = 4;

/**
 * The grid is wider than the window and starts left of it, so frames are
 * cropped at both sides: a window onto a bigger table, not a page.
 */
export function canvasGeometry(width: number) {
  const crop = Math.round(Math.min(262, Math.max(36, width * 0.18)));
  const cols = Math.max(3, Math.ceil((width + 2 * crop) / PITCH));
  return { crop, cols, gridWidth: cols * PITCH - GAP };
}

interface Block {
  key: number;
  round: Round<Source>;
}
const heightOf = (block: Block) => block.round.rows * PITCH;

interface BrowseCanvasProps {
  /** Empty while the archive loads: the canvas then shows grey blocks at their final sizes. */
  sources: Source[];
  imageLink: (id: number) => string;
  /** True while a dialog covers the canvas: no reason to keep moving. */
  paused: boolean;
}

/**
 * A1 canvas. Moves by itself (requestAnimationFrame, eased to a stop while a
 * frame is hovered or focused, off under reduced motion), and pans with a
 * drag or the wheel. Motion writes the transform straight to the element:
 * a React render per frame would be wasted work. React renders only when a
 * round is added or dropped.
 */
export function BrowseCanvas({ sources, imageLink, paused }: BrowseCanvasProps) {
  const viewport = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(() => window.innerWidth);
  const { crop, cols, gridWidth } = canvasGeometry(width);

  const [blocks, setBlocks] = useState<Block[]>([]);
  // The round that holds the middle of the window. Only its frames carry
  // view-transition names (a name must be unique on the page), so the search
  // reflow flies the copies the user is looking at.
  const [primaryKey, setPrimaryKey] = useState<number | null>(null);

  // Mutable state the animation loop reads and writes without re-rendering.
  const live = useRef({
    blocks: [] as Block[],
    nextKey: 0,
    offset: START_OFFSET, // px scrolled up from the top of the first round
    x: -crop,
    velocity: 0,
    hot: false, // a frame is under the pointer or has keyboard focus
    paused,
    sources,
    cols,
  });
  live.current.paused = paused;

  const drag = useRef<{ lastX: number; lastY: number; travelled: number; moved: boolean } | null>(null);
  const justDragged = useRef(false);

  /**
   * A new round, shuffled. `next to` is the round it will touch: the photos on
   * that round's facing edge go to the far end of the new order, so the same
   * photo never shows twice across the seam.
   */
  function makeBlock(nextTo?: { block: Block; side: "below" | "above" }): Block {
    const { sources: items, cols: columns } = live.current;
    let order = shuffle(items);
    let facing = new Set<number>();
    if (nextTo) {
      const { slots, rows } = nextTo.block.round;
      facing = new Set(
        slots
          .filter((slot) => (nextTo.side === "below" ? slot.y + slot.span[1] > rows - SEAM_ROWS : slot.y < SEAM_ROWS))
          .map((slot) => slot.item.id),
      );
      const near = order.filter((source) => facing.has(source.id));
      const far = order.filter((source) => !facing.has(source.id));
      // Packing fills top to bottom, so the start of the order lands at the top of the round.
      order = nextTo.side === "below" ? [...far, ...near] : [...near, ...far];
    }
    const round = packRound(order, (source) => spanFor(source.id), columns, (source) => facing.has(source.id));
    return { key: live.current.nextKey++, round };
  }

  /** Drops rounds that left the top, adds rounds so the window stays covered. */
  function settle(sync: boolean) {
    const state = live.current;
    if (state.sources.length === 0) return;
    const viewHeight = viewport.current?.clientHeight ?? window.innerHeight;
    let list = state.blocks;
    const before = list;
    while (list.length > 1 && state.offset >= heightOf(list[0]!)) {
      state.offset -= heightOf(list[0]!);
      list = list.slice(1);
    }
    while (state.offset < 0) {
      // Dragged down past the first round: a new one joins at the top.
      const block = makeBlock(list[0] && { block: list[0], side: "above" });
      list = [block, ...list];
      state.offset += heightOf(block);
    }
    let total = list.reduce((sum, block) => sum + heightOf(block), 0);
    while (total - state.offset < viewHeight + 2 * PITCH) {
      const block = makeBlock(list.at(-1) && { block: list.at(-1)!, side: "below" });
      list = [...list, block];
      total += heightOf(block);
    }
    if (list !== before) {
      state.blocks = list;
      // In the animation loop the DOM must change in the same frame as the
      // offset, or the canvas would jump by one round for a frame.
      if (sync) flushSync(() => setBlocks(list));
      else setBlocks(list);
    }
    // Which round holds the middle of the window.
    let top = -state.offset;
    const middle = viewHeight / 2;
    const primary = list.find((block) => {
      top += heightOf(block);
      return top > middle;
    });
    setPrimaryKey(primary?.key ?? null);
  }

  function apply() {
    const { x, offset } = live.current;
    if (strip.current) strip.current.style.transform = `translate3d(${x}px, ${-offset}px, 0)`;
  }

  function clampX(x: number) {
    const view = viewport.current?.clientWidth ?? window.innerWidth;
    return Math.min(0, Math.max(view - gridWidth, x));
  }

  // Track the window width: the number of columns follows it, so the canvas fills any screen.
  useEffect(() => {
    let frame = 0;
    const onResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setWidth(window.innerWidth));
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(frame);
    };
  }, []);

  // New data or a new column count: build the rounds again from the top.
  useLayoutEffect(() => {
    const state = live.current;
    state.sources = sources;
    state.cols = cols;
    state.blocks = [];
    state.offset = START_OFFSET;
    state.x = -crop;
    settle(false);
    apply();
    // settle/apply only read refs and stable setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources, cols, crop]);

  // The transform must follow every committed change of rounds.
  useLayoutEffect(apply, [blocks]);

  // The upward motion.
  useEffect(() => {
    if (reduced) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const state = live.current;
      // Clamped: after a hidden tab, the canvas resumes instead of leaping.
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const target = state.paused || state.hot || drag.current ? 0 : SPEED;
      state.velocity += (target - state.velocity) * Math.min(1, dt / EASE);
      if (state.velocity > 0.05) {
        state.offset += state.velocity * dt;
        settle(true);
        apply();
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  function moveBy(dx: number, dy: number) {
    const state = live.current;
    state.x = clampX(state.x + dx);
    state.offset -= dy;
    settle(true);
    apply();
  }

  function onPointerDown(event: PointerEvent) {
    justDragged.current = false;
    if (event.button !== 0) return;
    drag.current = { lastX: event.clientX, lastY: event.clientY, travelled: 0, moved: false };
  }

  function onPointerMove(event: PointerEvent) {
    const state = drag.current;
    if (!state) return;
    const dx = event.clientX - state.lastX;
    const dy = event.clientY - state.lastY;
    state.lastX = event.clientX;
    state.lastY = event.clientY;
    state.travelled += Math.hypot(dx, dy);
    if (!state.moved) {
      if (state.travelled < DRAG_THRESHOLD) return;
      state.moved = true;
      // Capture only once it is a real drag, so a plain click still reaches the frame link.
      viewport.current?.setPointerCapture(event.pointerId);
    }
    moveBy(dx, dy);
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

  // The page itself never scrolls, so the wheel and the trackpad move the canvas.
  function onWheel(event: WheelEvent) {
    moveBy(-event.deltaX, -event.deltaY);
  }

  // Hover or keyboard focus on a frame eases the canvas to a stop, so the annotation can be read.
  function onPointerOver(event: PointerEvent) {
    live.current.hot = Boolean((event.target as Element).closest("a"));
  }
  function onFocus(event: FocusEvent) {
    live.current.hot = (event.target as Element).matches(":focus-visible");
  }

  const placeholder = sources.length === 0;
  const plates = new Map(sources.map((source, index) => [source.id, formatPlate(index + 1)]));

  return (
    <div
      ref={viewport}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerOver={onPointerOver}
      onPointerLeave={() => (live.current.hot = false)}
      onFocus={onFocus}
      onBlur={() => (live.current.hot = false)}
      onClickCapture={onClickCapture}
      onWheel={onWheel}
      // touch-none: on a phone the finger pans the canvas instead of scrolling the page.
      className="fixed inset-0 cursor-grab touch-none select-none overflow-hidden active:cursor-grabbing"
    >
      <div ref={strip} className="absolute left-0 top-0 will-change-transform" style={{ width: gridWidth }}>
        {placeholder ? (
          <PlaceholderRound cols={cols} />
        ) : (
          blocks.map((block) => (
            <RoundView
              key={block.key}
              round={block.round}
              primary={block.key === primaryKey}
              plates={plates}
              imageLink={imageLink}
            />
          ))
        )}
      </div>
      {/* A1·11: the bottom scrim, so the dock reads over the photos. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[220px] bg-[linear-gradient(to_bottom,rgba(9,9,10,0),rgba(9,9,10,0.95)_55%)]" />
    </div>
  );
}

const box = (x: number, y: number, [cols, rows]: readonly [number, number]) => ({
  left: x * PITCH,
  top: y * PITCH,
  width: cols * PITCH - GAP,
  height: rows * PITCH - GAP,
});

interface RoundViewProps {
  round: Round<Source>;
  primary: boolean;
  plates: Map<number, string>;
  imageLink: (id: number) => string;
}

/**
 * One round of the archive. Memoized: the animation never re-renders it.
 * Only the primary round is in the accessibility tree and the tab order;
 * the others are visual copies.
 */
const RoundView = memo(function RoundView({ round, primary, plates, imageLink }: RoundViewProps) {
  return (
    <ul aria-hidden={primary ? undefined : true} className="relative" style={{ height: round.rows * PITCH }}>
      {round.slots.map((slot, index) => (
        <CanvasFrame
          key={slot.filler ? `f${index}` : slot.item.id}
          source={slot.item}
          span={slot.span}
          box={box(slot.x, slot.y, slot.span)}
          plate={plates.get(slot.item.id) ?? ""}
          to={imageLink(slot.item.id)}
          transitionName={primary && !slot.filler ? frameTransitionName(slot.item.id) : undefined}
          focusable={primary && !slot.filler}
        />
      ))}
    </ul>
  );
});

// While loading: one round of grey blocks at the frames' final sizes (no spinners).
const PLACEHOLDER_IDS = Array.from({ length: 100 }, (_, index) => index + 1);

function PlaceholderRound({ cols }: { cols: number }) {
  const round = packRound(PLACEHOLDER_IDS, spanFor, cols);
  return (
    <ul aria-hidden="true" className="relative" style={{ height: round.rows * PITCH }}>
      {round.slots.map((slot, index) => (
        <li key={index} className="absolute bg-raised" style={box(slot.x, slot.y, slot.span)} />
      ))}
    </ul>
  );
}

