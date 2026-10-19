import { useEffect, useMemo, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import bbox from "@turf/bbox";
import SiteHeader from "../SiteHeader";
import { ownerIdFor, useAuthUser } from "../auth";
import Map from "./components/Map";
import Sidebar from "./components/Sidebar";
import MapFilterBar from "./components/MapFilterBar";
import Toolbar from "./components/Toolbar";
import ViewTabs from "./components/ViewTabs";
import type { Basemap } from "./utils/basemaps";
import MiniMap from "./components/MiniMap";
import { useMyImagery, type MyImagery } from "./useMyImagery";
import { UPLOADER_URL } from "./utils/constants";
import { matchesFilters } from "./utils/filters";
import { toImageFeature } from "./utils/format";
import type { BrowseMode, Filters, ImageFeature, RawFeature } from "./utils/types";
import { EMPTY_FILTERS } from "./utils/types";
import type { BBox } from "./utils/geo";
import {
  readInitialFilters,
  readInitialMode,
  readSelectedId,
  writeFilters,
  writeMode,
  writeSelectedId,
} from "./utils/url";

// Filters apply to the pages loaded so far, so say so while more remain.
function myImageryHeader(mine: MyImagery, shown: number): string {
  if (mine.loading) return "Loading your imagery";
  if (mine.error) return "Your imagery";
  const total = mine.features.length;
  const count = mine.hasMore ? `${total}+` : `${total}`;
  if (shown === total) return `${count} image${total === 1 && !mine.hasMore ? "" : "s"} you own`;
  return `${shown} of ${count} match the filters`;
}

function MyImageryEmpty({ mine }: { mine: MyImagery }) {
  if (mine.loading) {
    return (
      <p className="flex items-center justify-center gap-2 text-gray-500 py-8">
        <wa-spinner /> Loading your imagery…
      </p>
    );
  }
  if (mine.error) {
    return (
      <div className="px-2 py-6 space-y-3">
        <wa-callout variant="danger" size="s" class="text-xs">
          Could not load your imagery: {mine.error}
        </wa-callout>
        <wa-button size="s" appearance="outlined" class="w-full" onClick={mine.retry}>
          Try again
        </wa-button>
      </div>
    );
  }
  if (mine.features.length > 0) {
    // Filters apply to the loaded pages, so more may still match.
    return (
      <div className="space-y-4">
        <p className="text-center text-gray-500 py-8 px-6">
          None of your imagery loaded so far matches the filters.
        </p>
        <MyImageryMore mine={mine} />
      </div>
    );
  }
  return (
    <div className="text-center text-gray-500 py-8 px-6 space-y-4">
      <p>Imagery you upload while signed in to your HOT account will appear here.</p>
      <wa-button size="s" variant="brand" appearance="filled" href={UPLOADER_URL}>
        Upload imagery
      </wa-button>
    </div>
  );
}

function MyImageryMore({ mine }: { mine: MyImagery }) {
  if (!mine.hasMore) return null;
  return (
    <div className="space-y-2">
      <wa-button
        appearance="outlined"
        size="s"
        class="w-full"
        loading={mine.loadingMore}
        onClick={mine.loadMore}
      >
        Load more of your imagery
      </wa-button>
      {mine.moreError && (
        <wa-callout variant="danger" size="s" class="text-xs">
          Could not load more: {mine.moreError}
        </wa-callout>
      )}
    </div>
  );
}

export default function Browse() {
  const user = useAuthUser();
  const ownerId = user ? ownerIdFor(user) : null;
  const [mode, setMode] = useState<BrowseMode>(readInitialMode);
  // A `view=mine` link opened while signed out shows all imagery instead.
  const showingMine = mode === "mine" && ownerId !== null;
  const mine = useMyImagery(showingMine ? ownerId : null);

  const [features, setFeatures] = useState<ImageFeature[]>([]);
  const [seenCollections, setSeenCollections] = useState<string[]>([]);
  const [selectedFeature, setSelectedFeature] = useState<ImageFeature | null>(null);
  const [mapBbox, setMapBbox] = useState<BBox | null>(null);

  const [mapInstance, setMapInstance] = useState<MapLibreMap | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([0, 20]);
  const [mapBounds, setMapBounds] = useState<BBox | null>(null);

  // One-shot restore of ?selected_id, from whichever list carries it first:
  // the viewport (see handleFeaturesUpdate) or My imagery (below). State
  // rather than a ref so the render-time check stays lint-clean.
  const [urlSelectedId] = useState(readSelectedId);
  const [urlSelectionDone, setUrlSelectionDone] = useState(!urlSelectedId);

  const [previewsEnabled, setPreviewsEnabled] = useState(true);
  const [hoveredFeatureId, setHoveredFeatureId] = useState<string | null>(null);
  const [basemap, setBasemap] = useState<Basemap>("light");

  const [filters, setFilters] = useState<Filters>(() => {
    const f = readInitialFilters();
    return { ...EMPTY_FILTERS, ...f };
  });

  const handleSelectFeature = (feature: ImageFeature | null) => {
    // A choice made before the restore fires wins over the URL.
    setUrlSelectionDone(true);
    setSelectedFeature(feature);
    writeSelectedId(feature ? feature.properties.id : null);
  };

  // Escape deselects. The selected footprint fades surrounding
  // imagery, so users need a keyboard escape hatch as well as the
  // card X button.
  useEffect(() => {
    if (!selectedFeature) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleSelectFeature(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedFeature]);

  // Handle features arriving from the map. Also handles the one-shot
  // URL restore: if the incoming URL had ?selected_id and we haven't
  // restored yet, look for it in this batch and select it. Doing this
  // in the callback (rather than a features-watching effect) keeps the
  // setState out of an effect body - see react-hooks/set-state-in-effect.
  const handleFeaturesUpdate = (newFeatures: ImageFeature[]) => {
    setFeatures(newFeatures);
    if (!urlSelectionDone && newFeatures.length > 0) {
      setUrlSelectionDone(true);
      const feat = newFeatures.find((f) => f.properties.id === urlSelectedId);
      if (feat) {
        setSelectedFeature(feat);
      }
    }
  };

  const handleFilterChange = (newFilters: Filters) => {
    setFilters(newFilters);
    writeFilters(newFilters);
  };

  const handleModeChange = (next: BrowseMode) => {
    setMode(next);
    writeMode(next);
  };

  // The filter bar applies to My imagery too, on the client.
  const myFeatures = useMemo<RawFeature[] | null>(
    () => (showingMine ? mine.features.filter((f) => matchesFilters(f.properties, filters)) : null),
    [showingMine, mine.features, filters],
  );
  const myCards = useMemo(
    () => (myFeatures ?? []).map((f) => toImageFeature(f.geometry, f.properties)),
    [myFeatures],
  );

  // The My imagery half of the ?selected_id restore. Its list arrives from
  // the search, not the map, so the check runs here; setState during render
  // short-circuits once done, the pattern Sidebar.tsx uses.
  if (!urlSelectionDone) {
    const feat = myCards.find((f) => f.properties.id === urlSelectedId);
    if (feat) {
      setUrlSelectionDone(true);
      setSelectedFeature(feat);
    }
  }

  const handleLocationSelect = (bbox: BBox) => setMapBbox(bbox);

  const handleMapMoveEnd = (_bbox: BBox, center: [number, number], exactBounds: BBox) => {
    setMapCenter(center);
    setMapBounds(exactBounds);
  };

  // Accumulate collections so filtering and panning cannot remove source options.
  const handleCollectionsUpdate = (ids: string[]) => {
    setSeenCollections((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const c of ids) {
        if (!next.has(c)) {
          next.add(c);
          changed = true;
        }
      }
      return changed ? Array.from(next).sort() : prev;
    });
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <SiteHeader />

      <div className="flex flex-1 w-full min-h-0 bg-gray-100 font-sans">
        <div className="flex flex-col w-96 h-full bg-white border-r border-gray-200 shadow-xl z-20 relative">
          {ownerId && <ViewTabs mode={showingMine ? "mine" : "all"} onChange={handleModeChange} />}
          {showingMine ? (
            <Sidebar
              key="mine"
              features={myCards}
              onSelect={handleSelectFeature}
              selectedFeature={selectedFeature}
              header={myImageryHeader(mine, myCards.length)}
              headerAction={
                myFeatures && myFeatures.length > 0 ? (
                  <button
                    type="button"
                    className="shrink-0 text-xs font-semibold text-cyan-600 hover:text-cyan-700 cursor-pointer"
                    onClick={() =>
                      setMapBbox(bbox({ type: "FeatureCollection", features: myFeatures }) as BBox)
                    }
                  >
                    Show on map
                  </button>
                ) : undefined
              }
              empty={<MyImageryEmpty mine={mine} />}
              footer={<MyImageryMore mine={mine} />}
              resetKey={ownerId}
            />
          ) : (
            <Sidebar
              key="all"
              features={features}
              onSelect={handleSelectFeature}
              selectedFeature={selectedFeature}
            />
          )}
        </div>

        <div className="flex-1 h-full relative">
          <div className="absolute top-4 left-4 z-30 w-full max-w-4xl">
            <MapFilterBar
              filters={filters}
              onChange={handleFilterChange}
              availableCollections={seenCollections}
            />
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
            onCollectionsUpdate={handleCollectionsUpdate}
            searchBbox={mapBbox}
            onSearchArea={handleMapMoveEnd}
            previewsEnabled={previewsEnabled}
            setPreviewsEnabled={setPreviewsEnabled}
            hoveredFeatureId={hoveredFeatureId}
            onHover={setHoveredFeatureId}
            basemap={basemap}
            filters={filters}
            ownerId={ownerId}
            myImagery={myFeatures}
          />
        </div>
      </div>
    </div>
  );
}
