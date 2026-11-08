import type { Config } from "tailwindcss";

// Each token reads a CSS variable from src/index.css. "<alpha-value>" lets
// Tailwind opacity modifiers work, e.g. `bg-fg/10`.
const token = (name: string) => `rgb(var(--color-${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: token("bg"),
        surface: token("surface"),
        raised: token("raised"),
        line: token("line"),
        "line-strong": token("line-strong"),
        fg: token("fg"),
        soft: token("soft"),
        muted: token("muted"),
        faint: token("faint"),
        accent: token("accent"),
        "accent-text": token("accent-text"),
        "bar-faint": token("bar-faint"),
        track: token("track"),
        danger: token("danger"),
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius)",
        handle: "var(--radius-handle)",
      },
      fontFamily: {
        // One family only. There is no monospace: numbers use tabular figures (set on body).
        sans: "var(--font-sans)",
        // Kept as an alias so older `font-mono` classes (and the scene) render the same family.
        mono: "var(--font-sans)",
      },
      boxShadow: {
        // Shadows only on floating things (§3).
        dock: "0 20px 50px rgba(0, 0, 0, 0.6)",
        modal: "0 40px 120px rgba(0, 0, 0, 0.7)",
        drawer: "40px 0 120px rgba(0, 0, 0, 0.6)",
        toast: "0 20px 40px rgba(0, 0, 0, 0.5)",
      },
    },
  },
  plugins: [],
} satisfies Config;
