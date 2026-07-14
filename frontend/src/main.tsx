import "@unocss/reset/tailwind.css";
import "virtual:uno.css";
import "@hotosm/ui/dist/style-core.css";
import "@hotosm/ui/dist/components/header/header.js";
import "@awesome.me/webawesome/dist/components/button/button.js";
import "@awesome.me/webawesome/dist/components/card/card.js";
import "@awesome.me/webawesome/dist/components/icon/icon.js";
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
