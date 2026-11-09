import { useLayoutEffect, useRef } from "react";
import { formatPercent } from "../lib/format";
import { FILL_MS } from "../lib/motion";

/**
 * A percentage that counts up from 0 while its bar fills (entrance only).
 * It writes the text straight to the element on each frame: a React render
 * per frame for up to 50 numbers would be wasted work. Without `delay` it is
 * plain text.
 */
export function CountUp({ value, delay }: { value: number; delay?: number }) {
  const element = useRef<HTMLSpanElement>(null);

  // The text is ours, not React's (the span has no React children): React would
  // otherwise keep writing to a text node this effect replaced.
  useLayoutEffect(() => {
    const node = element.current;
    if (!node) return;
    node.textContent = formatPercent(value);
    if (delay === undefined) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    node.textContent = formatPercent(0);
    let frame = 0;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / FILL_MS));
      const eased = 1 - (1 - t) ** 3; // ease-out, like the bar
      node.textContent = formatPercent(value * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      node.textContent = formatPercent(value);
    };
  }, [value, delay]);

  return <span ref={element} />;
}
