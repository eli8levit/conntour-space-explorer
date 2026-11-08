// Every piece of text in the scene is plain HTML on top of the canvas: crisp at
// any zoom, real Instrument Sans, selectable, and no font atlas to ship.
// Each frame, the canvas calls `update`, which projects each label's 3D anchor to
// pixels and moves the div with a CSS transform (no React re-render per frame).
import { type MutableRefObject, type ReactNode, useEffect, useRef } from "react";
import { type Camera, Vector3 } from "three";
import type { Sphere } from "./layout";
import { toScreen } from "./screen";

export interface Label {
  key: string;
  /** Writes the label's 3D position into `out` (a function, because orbit pins move). */
  anchor: (out: Vector3) => Vector3;
  /** The planet that can hide this label when it is on the far side. */
  occluder: Sphere | null;
  content: ReactNode;
  className?: string;
  /** "right": text starts 10px right of the point. "center": centered on it (the active-pin outline). */
  align?: "right" | "center";
  /** Never higher than the level bar ([data-scene-bar]): a body name pushed under the buttons is unreadable. */
  belowBar?: boolean;
}

/**
 * Labels farther than this from the camera are hidden. Every level view is closer
 * than ~7 units, and the levels are ~15 apart, so mid-flight the destination's
 * names appear only once it is near, not as a smudge of text around a dot.
 */
const LABEL_RANGE = 9;

export type FrameListener = (camera: Camera, width: number, height: number) => void;

/** True when two screen boxes overlap. */
function overlaps(a: DOMRect, b: { left: number; right: number; top: number; bottom: number }): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

export function Overlay({ labels, register }: { labels: Label[]; register: MutableRefObject<FrameListener | null> }) {
  const elements = useRef(new Map<string, HTMLDivElement>());
  const root = useRef<HTMLDivElement>(null);
  const latest = useRef(labels);
  latest.current = labels;

  useEffect(() => {
    const point = new Vector3();
    register.current = (camera, width, height) => {
      // The open card (pin or cluster list) sits over the canvas: a label under it would be cut in half.
      const card = document.querySelector("[data-scene-card]")?.getBoundingClientRect() ?? null;
      const barBottom = document.querySelector("[data-scene-bar]")?.getBoundingClientRect().bottom ?? null;
      const origin = root.current?.getBoundingClientRect();
      for (const label of latest.current) {
        const el = elements.current.get(label.key);
        if (!el) continue;
        const screen = toScreen(label.anchor(point), camera, width, height, label.occluder);
        const near = camera.position.distanceTo(point) < LABEL_RANGE;
        const center = label.align === "center";
        if (label.belowBar && barBottom !== null && origin) {
          // On a phone the planet fills the width, so its name (above the north pole) reached the
          // level buttons. Push it down to 6px under the bar instead.
          const minY = barBottom + 6 + el.offsetHeight / 2 - origin.top;
          screen.y = Math.max(screen.y, minY);
        }
        let underCard = false;
        if (card && origin) {
          const w = el.offsetWidth;
          const h = el.offsetHeight;
          const left = origin.left + screen.x + (center ? -w / 2 : 10);
          const top = origin.top + screen.y - h / 2;
          underCard = overlaps(card, { left, right: left + w, top, bottom: top + h });
        }
        el.style.visibility = screen.visible && near && !underCard ? "visible" : "hidden";
        const shift = center ? "translate(-50%, -50%)" : "translate(10px, -50%)";
        el.style.transform = `translate(${screen.x.toFixed(1)}px, ${screen.y.toFixed(1)}px) ${shift}`;
      }
    };
    return () => {
      register.current = null;
    };
  }, [register]);

  return (
    <div ref={root} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {labels.map((label) => (
        <div
          key={label.key}
          ref={(el) => {
            if (el) elements.current.set(label.key, el);
            else elements.current.delete(label.key);
          }}
          className={`absolute left-0 top-0 whitespace-nowrap ${label.className ?? ""}`}
          style={{ visibility: "hidden" }}
        >
          {label.content}
        </div>
      ))}
    </div>
  );
}
