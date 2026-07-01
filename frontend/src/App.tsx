import { StacMap, type StacMapProps } from "@developmentseed/stac-map";
import { useEffect, useRef } from "react";
import Landing from "./Landing";
import "./App.css";

const TABS = [
  {
    label: "Home",
    href: "/",
    clickEvent: () => {
      window.location.href = "/";
    },
  },
  {
    label: "Browse",
    href: "/browse",
    clickEvent: () => {
      window.location.href = "/browse";
    },
  },
  {
    label: "Upload",
    clickEvent: () => {
      window.open("https://map.openaerialmap.org", "_blank");
    },
  },
];

type HotHeaderElement = HTMLElement & {
  tabs: typeof TABS;
};

// The density heat-grid + TiTiler handoff at z15+ is handled server-side by
// backend/global-tms (see nginx.conf). Consuming the pre-styled raster
// tileserver keeps the browse map visually identical to the standalone TMS,
// and avoids having to duplicate the paint config in two places.
const extraLayers = [
  {
    source: {
      id: "oam-global-tms",
      type: "raster" as const,
      tiles: ["https://global.imagery.hotosm.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      minzoom: 0,
      maxzoom: 22,
      attribution:
        '&copy; <a href="https://openaerialmap.org">OpenAerialMap</a> contributors',
    },
    layer: {
      id: "oam-global-tms",
      type: "raster" as const,
      source: "oam-global-tms",
      minzoom: 0,
      maxzoom: 22,
      paint: {
        "raster-opacity": 0.85,
      },
    },
  },
] satisfies NonNullable<StacMapProps["extraLayers"]>;

function Browse() {
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

export default function App() {
  const path = window.location.pathname.replace(/\/+$/, "");
  if (path === "/browse" || path.startsWith("/browse/")) {
    return <Browse />;
  }
  return <Landing />;
}
