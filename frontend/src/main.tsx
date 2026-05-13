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
