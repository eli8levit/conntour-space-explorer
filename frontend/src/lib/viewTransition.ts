import { flushSync } from "react-dom";
import { ASIDE_FADE_MS, GLIDE_EASE, GLIDE_MS, RENDER_WAIT_MS, ROOT_FADE_MS, rankDelay } from "./motion";

let reflowing = false;

/** True while a reflow View Transition is rendering or running: the results page then skips its own rise. */
export function isReflowing(): boolean {
  return reflowing;
}

/**
 * Runs a navigation inside a View Transition (handoff §6, P2): each frame
 * that has the same `view-transition-name` on both pages (`frame-<id>`)
 * glides from its old box to its new one, so A1 visibly reflows into A2.
 *
 * `rendered` says when the new page is in the DOM. It is needed because the
 * router renders route changes in a React transition (the v7_startTransition
 * flag), which flushSync does not flush: without the wait, the browser would
 * take its "after" snapshot of the old page and nothing would glide.
 *
 * The glide is staggered by rank (rank 1 first). The ranks are read from the
 * new page (`data-vt-rank`) and written as a short-lived stylesheet of
 * per-name delays. Set-aside frames lose their name for the transition, so
 * they fade where they were instead of flying too.
 *
 * Browsers without the API, and users who ask for reduced motion, get a plain navigation.
 */
export function withViewTransition(update: () => void, rendered?: () => boolean): void {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced || typeof document.startViewTransition !== "function") {
    update();
    return;
  }

  const style = document.createElement("style");
  const unnamed: [HTMLElement, string][] = [];
  reflowing = true;
  const transition = document.startViewTransition(async () => {
    flushSync(update);
    if (rendered) await waitUntil(rendered, RENDER_WAIT_MS);
    style.textContent = choreography(unnamed);
    document.head.appendChild(style);
  });

  // The overlay never swallows input: a click or a key lands on the new page and ends the motion.
  const finish = () => transition.skipTransition();
  window.addEventListener("pointerdown", finish, true);
  window.addEventListener("keydown", finish, true);
  void transition.finished
    .catch(() => {}) // a skipped or failed transition still ends here
    .finally(() => {
      reflowing = false;
      style.remove();
      for (const [element, name] of unnamed) element.style.viewTransitionName = name;
      window.removeEventListener("pointerdown", finish, true);
      window.removeEventListener("keydown", finish, true);
    });
}

/**
 * Resolves once `test()` is true, or after `timeout` ms. It watches DOM changes,
 * not animation frames: the browser pauses rendering (and rAF) while a View
 * Transition waits for its update callback.
 */
function waitUntil(test: () => boolean, timeout: number): Promise<void> {
  return new Promise((resolve) => {
    if (test()) return resolve();
    const done = () => {
      observer.disconnect();
      window.clearTimeout(timer);
      resolve();
    };
    const observer = new MutationObserver(() => {
      if (test()) done();
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    const timer = window.setTimeout(done, timeout);
  });
}

/** The per-frame timing rules for the new page now in the DOM. */
function choreography(unnamed: [HTMLElement, string][]): string {
  const rules = [
    "::view-transition { pointer-events: none; }",
    `::view-transition-old(root), ::view-transition-new(root) { animation-duration: ${ROOT_FADE_MS}ms; }`,
  ];
  for (const element of document.querySelectorAll<HTMLElement>("[data-vt-rank]")) {
    const name = element.style.viewTransitionName;
    if (!name || name === "none") continue;
    const rank = element.dataset.vtRank;
    if (rank === "aside") {
      // Its old frame (on the canvas or among the old results) fades out in place.
      unnamed.push([element, name]);
      element.style.viewTransitionName = "none";
      rules.push(
        `::view-transition-group(${name}), ::view-transition-old(${name}) { animation-duration: ${ASIDE_FADE_MS}ms; }`,
      );
      continue;
    }
    const delay = rankDelay(Number(rank) - 1);
    rules.push(
      `::view-transition-group(${name}), ::view-transition-old(${name}), ::view-transition-new(${name}) {` +
        ` animation-duration: ${GLIDE_MS}ms; animation-delay: ${delay}ms;` +
        ` animation-timing-function: ${GLIDE_EASE}; animation-fill-mode: both; }`,
    );
  }
  return rules.join("\n");
}

/** The shared name that pairs one image's frame across pages. */
export const frameTransitionName = (id: number) => `frame-${id}`;
