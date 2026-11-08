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
        muted: token("muted"),
        faint: token("faint"),
        danger: token("danger"),
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius)",
      },
      fontFamily: {
        sans: "var(--font-sans)",
        mono: "var(--font-mono)",
      },
    },
  },
  plugins: [],
} satisfies Config;
