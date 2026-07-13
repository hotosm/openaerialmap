import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import Map from "./components/Map";
import Sidebar from "./components/Sidebar";
import MapFilterBar from "./components/MapFilterBar";
import Toolbar, { type Basemap } from "./components/Toolbar";
import MiniMap from "./components/MiniMap";
import type { Filters, ImageFeature } from "./utils/types";
import { EMPTY_FILTERS } from "./utils/types";
import type { BBox } from "./utils/geo";
import {
  readInitialFilters,
  readSelectedId,
  writeFilters,
  writeSelectedId,
} from "./utils/url";

// Landing point for the (upcoming) imagery uploader. Currently the
// legacy site; swap this in one place when the new uploader ships.
const SHARE_IMAGERY_URL = "https://map.openaerialmap.org";

// Header tabs: primary navigation plus links out to the wider STAC
// stack. Folded into the hot-header drawer on narrow viewports.
const HEADER_TABS = [
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
    label: "API",
    clickEvent: () => {
      window.open("https://api.imagery.hotosm.org", "_blank");
    },
  },
  {
    label: "Docs",
    clickEvent: () => {
      window.open("https://docs.imagery.hotosm.org/", "_blank");
    },
  },
  {
    label: "Report a bug",
    clickEvent: () => {
      window.open("https://roadmap.hotosm.org/#tech-request", "_blank");
    },
  },
];

type HotHeaderElement = HTMLElement & { tabs: typeof HEADER_TABS };

export default function Browse() {
  const headerRef = useRef<HotHeaderElement>(null);

  const [features, setFeatures] = useState<ImageFeature[]>([]);
  const [selectedFeature, setSelectedFeature] = useState<ImageFeature | null>(
    null,
  );
  const [mapBbox, setMapBbox] = useState<BBox | null>(null);

  const [mapInstance, setMapInstance] = useState<MapLibreMap | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([0, 20]);
  const [mapBounds, setMapBounds] = useState<BBox | null>(null);

  const initialUrlSelectionDone = useRef(false);

  const [previewsEnabled, setPreviewsEnabled] = useState(true);
  const [hoveredFeatureId, setHoveredFeatureId] = useState<string | null>(null);
  const [basemap, setBasemap] = useState<Basemap>("carto");

  const [filters, setFilters] = useState<Filters>(() => {
    const f = readInitialFilters();
    return { ...EMPTY_FILTERS, ...f };
  });

  useEffect(() => {
    if (headerRef.current) headerRef.current.tabs = HEADER_TABS;
  }, []);

  const handleSelectFeature = (feature: ImageFeature | null) => {
    setSelectedFeature(feature);
    writeSelectedId(feature ? feature.properties.id : null);
  };

  // Handle features arriving from the map. Also handles the one-shot
  // URL restore: if the incoming URL had ?selected_id and we haven't
  // restored yet, look for it in this batch and select it. Doing this
  // in the callback (rather than a features-watching effect) keeps the
  // setState out of an effect body - see react-hooks/set-state-in-effect.
  const handleFeaturesUpdate = (newFeatures: ImageFeature[]) => {
    setFeatures(newFeatures);
    if (!initialUrlSelectionDone.current && newFeatures.length > 0) {
      initialUrlSelectionDone.current = true;
      const urlSelectedId = readSelectedId();
      if (urlSelectedId) {
        const feat = newFeatures.find((f) => f.properties.id === urlSelectedId);
        if (feat) {
          setSelectedFeature(feat);
        }
      }
    }
  };

  const handleFilterChange = (newFilters: Filters) => {
    setFilters(newFilters);
    writeFilters(newFilters);
  };

  const handleLocationSelect = (bbox: BBox) => setMapBbox(bbox);

  const handleMapMoveEnd = (
    _bbox: BBox,
    center: [number, number],
    exactBounds: BBox,
  ) => {
    setMapCenter(center);
    setMapBounds(exactBounds);
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <hot-header
        ref={headerRef}
        title="OpenAerialMap"
        logo="/openaerialmap.svg"
        size="small"
        tabs-center-align
      >
        <wa-button
          slot="auth"
          variant="brand"
          class="share-imagery-btn"
          onClick={() => {
            window.open(SHARE_IMAGERY_URL, "_blank");
          }}
        >
          Share Imagery
        </wa-button>
      </hot-header>

      <div className="flex flex-1 w-full min-h-0 bg-gray-100 font-sans">
        <div className="flex flex-col w-96 h-full bg-white border-r border-gray-200 shadow-xl z-20 relative">
          <Sidebar
            features={features}
            onSelect={handleSelectFeature}
            selectedFeature={selectedFeature}
          />
        </div>

        <div className="flex-1 h-full relative">
          <div className="absolute top-4 left-4 z-30 w-full max-w-2xl">
            <MapFilterBar filters={filters} onChange={handleFilterChange} />
          </div>

          <div className="absolute bottom-12 right-4 z-30">
            <MiniMap center={mapCenter} bounds={mapBounds} />
          </div>

          <Toolbar
            className="absolute bottom-36 left-4 z-30"
            mapInstance={mapInstance}
            onLocationSelect={handleLocationSelect}
            basemap={basemap}
            setBasemap={setBasemap}
          />

          <Map
            onMapInit={setMapInstance}
            selectedFeature={selectedFeature}
            onSelect={handleSelectFeature}
            onFeaturesUpdate={handleFeaturesUpdate}
            searchBbox={mapBbox}
            onSearchArea={handleMapMoveEnd}
            previewsEnabled={previewsEnabled}
            setPreviewsEnabled={setPreviewsEnabled}
            hoveredFeatureId={hoveredFeatureId}
            onHover={setHoveredFeatureId}
            basemap={basemap}
            filters={filters}
          />
        </div>
      </div>
    </div>
  );
}
