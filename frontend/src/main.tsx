import "@unocss/reset/tailwind.css";
import "virtual:uno.css";
import "@hotosm/ui/dist/style-core.css";
import "@hotosm/ui/dist/components/header/header.js";
import "@awesome.me/webawesome/dist/components/button/button.js";
import "@awesome.me/webawesome/dist/components/card/card.js";
import "@awesome.me/webawesome/dist/components/icon/icon.js";
import maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

maplibregl.addProtocol("pmtiles", new Protocol().tile);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
