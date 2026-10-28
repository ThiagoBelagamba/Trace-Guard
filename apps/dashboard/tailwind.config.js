/** @type {import('tailwindcss').Config} */
const tg = (name) => `var(--tg-${name})`;

module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        tg: {
          bg: tg("bg"),
          sidebar: tg("sidebar"),
          surface: tg("surface"),
          "surface-2": tg("surface-2"),
          "surface-3": tg("surface-3"),
          hover: tg("hover"),
          border: tg("border"),
          "border-subtle": tg("border-subtle"),
          "border-strong": tg("border-strong"),
          text: tg("text"),
          "text-2": tg("text-2"),
          "text-3": tg("text-3"),
          error: tg("error"),
          "error-text": tg("error-text"),
          "error-fill": tg("error-fill"),
          "error-line": tg("error-line"),
          info: tg("info"),
          "info-text": tg("info-text"),
          "info-fill": tg("info-fill"),
          "info-line": tg("info-line"),
          threat: tg("threat"),
          "threat-text": tg("threat-text"),
          "threat-fill": tg("threat-fill"),
          "threat-line": tg("threat-line"),
          warn: tg("warn"),
          "warn-text": tg("warn-text"),
          ok: tg("ok"),
          "chart-line": tg("chart-line"),
          "chart-grid": tg("chart-grid"),
          "chart-axis": tg("chart-axis"),
        },
      },
      fontFamily: {
        sans: ["var(--tg-font)"],
        mono: ["var(--tg-mono)"],
      },
      borderRadius: {
        "tg-sm": tg("radius-sm"),
        "tg-md": tg("radius-md"),
        "tg-lg": tg("radius-lg"),
        "tg-xl": tg("radius-xl"),
      },
    },
  },
  plugins: [],
};
