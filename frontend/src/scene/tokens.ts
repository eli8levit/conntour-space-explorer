// The scene's colors come from the same CSS variables as the rest of the app
// (docs/design-handoff/tokens.css), read once at runtime. So a token change
// restyles the 3D view too. If a variable is missing, we use the tokens.css value.
import { Color, SRGBColorSpace } from "three";

const FALLBACK = {
  bg: "9 9 10",
  surface: "12 12 14",
  line: "31 31 35",
  "line-strong": "42 42 46",
  fg: "233 231 226",
  soft: "214 212 206",
  muted: "166 164 158",
  faint: "142 140 134",
  accent: "255 90 31",
  "accent-text": "255 138 92",
} as const;

export type TokenName = keyof typeof FALLBACK;
export type Palette = Record<TokenName, Color>;

/** For HTML overlays: `rgb(var(--color-accent, 255 90 31))`, with the fallback built in. */
export function cssColor(name: TokenName, alpha = 1): string {
  return `rgb(var(--color-${name}, ${FALLBACK[name]}) / ${alpha})`;
}

/** For WebGL: every token as a THREE.Color. */
export function readPalette(): Palette {
  const style = getComputedStyle(document.documentElement);
  const palette = {} as Palette;
  for (const name of Object.keys(FALLBACK) as TokenName[]) {
    const raw = style.getPropertyValue(`--color-${name}`).trim() || FALLBACK[name];
    const [r = 0, g = 0, b = 0] = raw.split(/[\s,]+/).map(Number);
    // The tokens are sRGB; three.js mixes colors in linear space, so say which one this is.
    palette[name] = new Color().setRGB(r / 255, g / 255, b / 255, SRGBColorSpace);
  }
  return palette;
}

/** `amount` of the way from `a` to `b`, mixed in sRGB like CSS opacity would (16% means 16% on screen). */
export function mix(a: Color, b: Color, amount: number): Color {
  const ca = a.clone().convertLinearToSRGB();
  const cb = b.clone().convertLinearToSRGB();
  return ca.lerp(cb, amount).convertSRGBToLinear();
}
