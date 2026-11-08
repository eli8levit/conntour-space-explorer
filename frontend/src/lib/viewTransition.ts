import { flushSync } from "react-dom";

/**
 * Runs a navigation inside a View Transition (handoff §6, P2): each frame
 * that has the same `view-transition-name` on both pages (`frame-<id>`)
 * glides from its old box to its new one, so A1 visibly reflows into A2.
 *
 * flushSync makes React render the new page inside the callback, so the
 * browser snapshots the right "after" state. Browsers without the API, and
 * users who ask for reduced motion, get a plain navigation.
 */
export function withViewTransition(update: () => void): void {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced || typeof document.startViewTransition !== "function") {
    update();
    return;
  }
  document.startViewTransition(() => flushSync(update));
}

/** The shared name that pairs one image's frame across pages. */
export const frameTransitionName = (id: number) => `frame-${id}`;
