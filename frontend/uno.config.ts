import { defineConfig, presetWind3 } from "unocss";

// Remap UnoCSS's default palette to HOT design tokens so utility
// classes carried over from the earlier prototype render in the HOT
// brand rather than Tailwind defaults:
//
//   cyan-*  -> --hot-color-red-*        (the HOT brand red / primary)
//   gray-*  -> --hot-color-gray-*       (HOT dark-slate-gray neutral)
//
// Tokens are the ones defined in the design library and loaded
// transitively via @hotosm/ui/dist/style-core.css (which bundles
// hotosm-ui-design). Note that @hotosm/ui aliases --hot-color-primary-*
// to --hot-color-red-*, so classes below and utility use of "primary"
// stay in sync.
const scale = (prefix: string): Record<string, string> =>
  Object.fromEntries(
    [50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((step) => [
      String(step),
      `var(--hot-color-${prefix}-${step})`,
    ]),
  );

export default defineConfig({
  content: {
    filesystem: ["index.html", "src/**/*.{ts,tsx}"],
  },
  presets: [presetWind3()],
  theme: {
    colors: {
      cyan: scale("red"),
      gray: scale("gray"),
    },
    fontFamily: {
      sans: '"Barlow", system-ui, sans-serif',
      display: '"Archivo", system-ui, sans-serif',
    },
  },
});
