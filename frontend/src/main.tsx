import "@unocss/reset/tailwind.css";
import "virtual:uno.css";
import "@hotosm/ui/dist/style.css";
// register all wa-* elements before first render (avoids FOUCE)
import "@hotosm/ui/dist/webawesome-all.js";
import "@hotosm/ui/dist/components/header/header.js";
import "@hotosm/ui/dist/components/tool-menu/tool-menu.js";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

// MapLibre + pmtiles protocol registration lives in Map.tsx so the
// landing route doesn't pull the map runtime into the main chunk. See
// the lazy() import in browse/Browse.tsx.

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
