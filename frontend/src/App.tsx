import { StacMap, type StacMapProps } from "@developmentseed/stac-map";
import { useEffect, useRef } from "react";
import "./App.css";

const TABS = [
  {
    label: "Browse",
    clickEvent: () => {
      window.location.href = "/";
    },
  },
  {
    label: "Upload",
    clickEvent: () => {
      window.open("https://upload.imagery.hotosm.org", "_blank");
    },
  },
];

type HotHeaderElement = HTMLElement & {
  tabs: typeof TABS;
};

const extraLayers = [
  {
    source: {
      id: "oam-global-coverage",
      type: "vector" as const,
      url: "pmtiles://https://s3.amazonaws.com/oin-hotosm-temp/global-coverage.pmtiles",
    },
    layer: {
      id: "oam-global-coverage",
      type: "fill" as const,
      source: "oam-global-coverage",
      "source-layer": "globalcoverage",
      minzoom: 0,
      maxzoom: 15,
      filter: ["==", ["geometry-type"], "Polygon"],
      paint: {
        "fill-color": "#d43f3f",
        "fill-opacity": 0.2,
        "fill-outline-color": "#d43f3f",
      },
    },
  },
] satisfies NonNullable<StacMapProps["extraLayers"]>;

export default function App() {
  const headerRef = useRef<HotHeaderElement>(null);

  useEffect(() => {
    if (headerRef.current) headerRef.current.tabs = TABS;
  }, []);

  return (
    <div className="app-layout">
      <hot-header
        ref={headerRef}
        title="OpenAerialMap"
        logo="/favicon.ico"
        size="small"
        tabs-center-align
      />
      <div className="map-container">
        <StacMap
          defaultHref="https://api.imagery.hotosm.org/stac"
          extraLayers={extraLayers}
        />
      </div>
    </div>
  );
}
