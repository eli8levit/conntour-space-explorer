import { useSyncExternalStore } from "react";

/**
 * True while a CSS media query matches. Used where the layout itself changes
 * (not only styles): on narrow screens the A2 rail and timeline move into the
 * page flow instead of floating over it.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
  );
}
