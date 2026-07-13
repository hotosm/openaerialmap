import { defineConfig, presetWind3 } from "unocss";

// Point the cyan-* accent scale at the HOT red palette
// (--hot-color-red-*) so classes carried over from the earlier
// prototype (bg-cyan-*, text-cyan-*, border-cyan-*, ...) render in
// the HOT brand red rather than the default cyan. The HOT "primary"
// palette is grayscale, so we deliberately don't remap gray-* -
// UnoCSS's default already gives us that.
//
// Tokens are the ones defined in hotosm-ui-design/dist/hot.css,
// loaded transitively via @hotosm/ui/dist/style-core.css.
export default defineConfig({
  content: {
    filesystem: ["index.html", "src/**/*.{ts,tsx}"],
  },
  presets: [presetWind3()],
  theme: {
    colors: {
      cyan: {
        50: "var(--hot-color-red-50)",
        100: "var(--hot-color-red-100)",
        200: "var(--hot-color-red-200)",
        300: "var(--hot-color-red-300)",
        400: "var(--hot-color-red-400)",
        500: "var(--hot-color-red-500)",
        600: "var(--hot-color-red-600)",
        700: "var(--hot-color-red-700)",
        800: "var(--hot-color-red-800)",
        900: "var(--hot-color-red-900)",
      },
    },
    fontFamily: {
      sans: '"Barlow", system-ui, sans-serif',
      display: '"Archivo", system-ui, sans-serif',
    },
  },
});
