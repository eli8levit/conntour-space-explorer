import type { ReactNode } from "react";

/** 2 columns on a phone, up to 5 on a wide screen. Shared with the loading skeleton. */
export const GRID_CLASSES = "grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";

/** The list every image grid uses. Children are <li> elements. */
export function ImageGrid({ children }: { children: ReactNode }) {
  return <ul className={GRID_CLASSES}>{children}</ul>;
}
