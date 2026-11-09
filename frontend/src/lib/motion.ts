// Search motion (A1 -> A2 and every fresh results page): every timing in one place.
//
// The sequence reads in rank order: rank 1 moves first, then each next rank a
// beat later, then the timeline lights up, strongest first. Even when the API
// answers in 50 ms the whole sequence takes about 1.4 s, so the user sees what
// happened (which images won, and how the layout changed) instead of a jump cut.
// None of it blocks input: a click or a key during the reflow finishes it at once.

/** Time between two ranks. Short enough to read as one wave, long enough to see the order. */
export const STAGGER_MS = 40;
/**
 * Ranks after the 10th start together (at 360 ms). In a glide every frame waits
 * on its old canvas spot until it starts, so a long wait would leave the old
 * canvas cluttering the new page.
 */
export const STAGGER_CAP = 9;

/** A1 -> A2: how long one frame takes to glide from the canvas to its result place. */
export const GLIDE_MS = 780;
/** Strong ease-out: frames leave quickly and settle softly. No overshoot (no bounce). */
export const GLIDE_EASE = "cubic-bezier(0.2, 0.7, 0.1, 1)";
/** Frames that are set aside fade out where they were, faster than the glide, so the eye follows the matches. */
export const ASIDE_FADE_MS = 360;
/** Longest wait for the results page to render inside the transition (the screen is frozen meanwhile). */
export const RENDER_WAIT_MS = 600;
/** The canvas behind the frames cross-fades to the results page. */
export const ROOT_FADE_MS = 480;

/** A fresh results page without a reflow (history, reload): each result rises into place. */
export const RISE_MS = 520;
/** Set-aside frames fade in once the results have started, so the results read first. */
export const ASIDE_DELAY_MS = STAGGER_CAP * STAGGER_MS;
/** Bars fill and percentages count up just after their frame appears. */
export const FILL_MS = 600;
export const FILL_AFTER_MS = 160;
/** In a glide, bars fill while the frame is still landing, so they finish together. */
export const GLIDE_FILL_AFTER_MS = Math.round(GLIDE_MS * 0.3);

/** The year timeline lights its result squares one by one, strongest first, once the frames have landed. */
export const TIMELINE_START_MS = 420;
export const TIMELINE_STEP_MS = 28;
/** At most this long for the whole timeline, however many results there are. */
export const TIMELINE_SPREAD_MS = 700;
/** One square going from grey to its colour. */
export const SQUARE_MS = 260;

/** After this, every entrance animation has ended and the page is static again. */
export const ENTRANCE_TOTAL_MS = 1800;

/** Delay for the item at `index` in rank order (0 = rank 1). */
export function rankDelay(index: number): number {
  return Math.min(Math.max(0, index), STAGGER_CAP) * STAGGER_MS;
}

/** Delay for the n-th lit timeline square, strongest first. */
export function timelineDelay(order: number, count: number): number {
  const step = count > 1 ? Math.min(TIMELINE_STEP_MS, TIMELINE_SPREAD_MS / (count - 1)) : 0;
  return TIMELINE_START_MS + order * step;
}

/**
 * How a results page entered: "glide" when a View Transition moved the frames
 * (they must not also rise), "rise" otherwise. Null once the entrance is over.
 */
export type EntranceMode = "glide" | "rise";

/** Inline timing for one entering element (the class names the keyframes, see index.css). */
export function enterStyle(delayMs: number, durationMs: number) {
  return { animationDelay: `${Math.round(delayMs)}ms`, animationDuration: `${durationMs}ms` };
}
