import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import type {
  FilterSpecification,
  Map as MapLibreMap,
  RasterTileSource,
} from "maplibre-gl";
import bbox from "@turf/bbox";
import "maplibre-gl/dist/maplibre-gl.css";

import {
  PMTILES_SOURCE_URL,
  PMTILES_SOURCE_LAYER,
  DENSITY_SOURCE_URL,
  DENSITY_SOURCE_LAYER,
  MAPBOX_TOKEN,
  FOOTPRINT_MIN_ZOOM,
  LARGE_IMAGE_THRESHOLD_SQ_KM,
  TMS_LARGE_MIN_ZOOM,
  TMS_ALL_MIN_ZOOM,
  MAX_TMS,
  MAX_PREVIEWS,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
} from "../utils/constants";
import { readInitialView, writeView } from "../utils/url";
import {
  buildFilter,
  densityCountExpr,
  matchesFilters,
} from "../utils/filters";
import { transformFeature } from "../utils/format";
import { bboxAreaKm2, getFullBbox, type BBox } from "../utils/geo";
import { fetchItemBounds, getTmsUrl, thumbUrl } from "../utils/tiles";
import type { Filters, ImageFeature, RawTileProperties } from "../utils/types";
import type { Basemap } from "./Toolbar";

interface Props {
  onMapInit?: (m: MapLibreMap) => void;
  selectedFeature: ImageFeature | null;
  onSelect: (f: ImageFeature | null) => void;
  onFeaturesUpdate: (fs: ImageFeature[]) => void;
  searchBbox: BBox | null;
  onSearchArea: (
    bbox: BBox,
    center: [number, number],
    exactBounds: BBox,
  ) => void;
  previewsEnabled: boolean;
  setPreviewsEnabled: (v: boolean) => void;
  hoveredFeatureId: string | null;
  onHover: (id: string | null) => void;
  basemap: Basemap;
  filters: Filters;
}

const TMS_PREFIX = "tms-";

// Augment the MapLibre Map instance with a scratch field for the set of
// image ids that currently have a TMS layer, so the preview effect can
// avoid double-rendering the same image as both a stretched thumbnail
// and a full-res raster. Kept off the React tree because both effects
// need synchronous access mid-render.
type MapWithTmsIds = MapLibreMap & { _tmsImageIds?: Set<string> };

export default function OamMap({
  onMapInit,
  selectedFeature,
  onSelect,
  onFeaturesUpdate,
  searchBbox,
  onSearchArea,
  previewsEnabled,
  setPreviewsEnabled,
  hoveredFeatureId,
  onHover,
  basemap,
  filters,
}: Props) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isProgrammaticMove = useRef(false);

  // Refs for callbacks accessed from map event handlers (bound once on
  // load). Effects below keep them fresh so we never close over stale
  // props inside the long-lived event listeners.
  const onSearchRef = useRef(onSearchArea);
  const onSelectRef = useRef(onSelect);
  const selectedFeatureRef = useRef(selectedFeature);
  const onHoverRef = useRef(onHover);
  const onFeaturesUpdateRef = useRef(onFeaturesUpdate);
  const filtersRef = useRef(filters);

  const [isLoaded, setIsLoaded] = useState(false);
  const [idleTick, setIdleTick] = useState(0);
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM);
  // Per-item bounds (WGS84) fetched from TiTiler-PgSTAC. Keyed by STAC
  // item id, populated lazily when an item first needs a TMS layer.
  // Bounding the raster source cuts 404 floods from tile requests
  // outside the image extent.
  const itemBoundsRef = useRef<Map<string, number[] | "fetching">>(new Map());
  const [itemBoundsTick, setItemBoundsTick] = useState(0);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);
  useEffect(() => {
    selectedFeatureRef.current = selectedFeature;
  }, [selectedFeature]);
  useEffect(() => {
    onSearchRef.current = onSearchArea;
  }, [onSearchArea]);
  useEffect(() => {
    onHoverRef.current = onHover;
  }, [onHover]);
  useEffect(() => {
    onFeaturesUpdateRef.current = onFeaturesUpdate;
  }, [onFeaturesUpdate]);
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const closePopup = () => {
    popupRef.current?.remove();
    popupRef.current = null;
  };

  // Query visible PMTiles source features (deduped by id), apply
  // filters, drop anything outside the viewport, sort by capture date
  // desc, and hand up to the sidebar.
  //
  // Gated on FOOTPRINT_MIN_ZOOM: below that zoom the underlying PMTiles
  // tiles carry only a drop-densest'd subset of the catalogue and
  // querySourceFeatures returns an unstable, zoom-dependent count
  // (e.g. 3.8k features at z2, 1.8k at z1 for a 21k-item catalogue).
  // Surfacing that count in the sidebar would be misleading - see the
  // block comment on FOOTPRINT_MIN_ZOOM in utils/constants.ts for the
  // full explanation. Emitting `[]` triggers the Sidebar's built-in
  // "Zoom in to see images" prompt.
  const emitVisibleFeatures = () => {
    if (!map.current || !onFeaturesUpdateRef.current) return;
    if (map.current.getZoom() < FOOTPRINT_MIN_ZOOM) {
      onFeaturesUpdateRef.current([]);
      return;
    }
    try {
      const raw = map.current.querySourceFeatures("oam-tiles", {
        sourceLayer: PMTILES_SOURCE_LAYER,
      });
      const vb = map.current.getBounds();
      const vw = vb.getWest();
      const vs = vb.getSouth();
      const ve = vb.getEast();
      const vn = vb.getNorth();
      const seen = new Set<string>();
      const unique: ImageFeature[] = [];
      for (const f of raw) {
        const p = f.properties as RawTileProperties;
        const id = p._id;
        if (!id || seen.has(id)) continue;
        seen.add(id);
        if (!matchesFilters(p, filtersRef.current)) continue;
        try {
          const fb = bbox(f) as BBox;
          if (fb[2] < vw || fb[0] > ve || fb[3] < vs || fb[1] > vn) continue;
        } catch {
          // include if bbox fails
        }
        unique.push(transformFeature(f));
      }
      unique.sort((a, b) => {
        const da = a.properties.acquisition_end || "";
        const db = b.properties.acquisition_end || "";
        return db.localeCompare(da);
      });
      onFeaturesUpdateRef.current(unique);
    } catch (e) {
      console.error("Error querying source features:", e);
    }
  };

  const applyFilters = (f: Filters) => {
    if (!map.current) return;
    const filter = buildFilter(f) as FilterSpecification | null;
    ["footprint-fill", "footprint-line"].forEach((id) => {
      if (map.current!.getLayer(id)) map.current!.setFilter(id, filter);
    });
  };

  // Swap the density layer's count source (fill ramp, label text, and
  // hide-when-zero filter) between the total `count` and a filter-aware
  // expression that reads pre-baked bucket keys - see
  // utils/filters.ts::densityCountExpr and the generator at
  // backend/global-mosaic/scripts/gen_coverage_vector.py.
  //
  // For multi-filter selections the expression evaluates to the min of
  // per-dimension bucket counts, which is an upper bound on the true
  // intersection - cells with a 0 in any dimension correctly disappear.
  const applyDensityFilters = (f: Filters) => {
    if (!map.current) return;
    const countExpr = densityCountExpr(f);
    if (map.current.getLayer("density-fill")) {
      map.current.setPaintProperty("density-fill", "fill-color", [
        "interpolate",
        ["linear"],
        countExpr,
        1,
        "#cceeff",
        5,
        "#66b3ff",
        20,
        "#0066cc",
        50,
        "#003366",
      ] as unknown as maplibregl.DataDrivenPropertyValueSpecification<string>);
      map.current.setFilter("density-fill", [
        "all",
        ["==", ["geometry-type"], "Polygon"],
        [">", countExpr, 0],
      ] as FilterSpecification);
    }
    if (map.current.getLayer("density-count")) {
      map.current.setLayoutProperty("density-count", "text-field", [
        "to-string",
        countExpr,
      ] as unknown as maplibregl.DataDrivenPropertyValueSpecification<string>);
      map.current.setFilter("density-count", [
        "all",
        ["==", ["geometry-type"], "Point"],
        [">", countExpr, 0],
      ] as FilterSpecification);
    }
  };

  // Build a disambiguation popup for a click that overlapped multiple
  // footprints. Declared above the map init effect so the click handler
  // registered inside can reference it without a TDZ warning.
  const openDisambigPopup = (
    lngLat: maplibregl.LngLat,
    features: ImageFeature[],
  ) => {
    const container = document.createElement("div");
    container.className = "oam-popup-container";

    const header = document.createElement("div");
    header.className = "oam-popup-header";
    header.textContent = `${features.length} images here`;
    container.appendChild(header);

    const items = document.createElement("div");
    items.className = "oam-popup-items";

    for (const feat of features) {
      const fp = feat.properties;
      const item = document.createElement("div");
      item.className = "oam-popup-item";

      const title = document.createElement("div");
      title.className = "oam-popup-item-title";
      title.textContent = fp.title || "Untitled";
      item.appendChild(title);

      const meta = document.createElement("div");
      meta.className = "oam-popup-item-meta";
      const dateStr =
        fp.date && fp.date !== "Unknown Date"
          ? new Date(fp.date).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          : "Unknown Date";
      meta.textContent = `${dateStr} · ${fp.provider || "Unknown"}`;
      item.appendChild(meta);

      item.addEventListener("click", () => {
        onSelectRef.current?.(feat);
        closePopup();
      });
      items.appendChild(item);
    }
    container.appendChild(items);

    popupRef.current = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: true,
      maxWidth: "280px",
      className: "oam-disambig-popup",
    })
      .setLngLat(lngLat)
      .setDOMContent(container)
      .addTo(map.current!);
  };

  // 1. INITIALIZE MAP
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    const { center, zoom } = readInitialView({
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    });

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          "basemap-source": {
            type: "raster",
            tiles: [
              "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
            ],
            tileSize: 256,
            attribution: "&copy; OpenStreetMap &copy; CARTO",
          },
        },
        layers: [
          { id: "basemap-layer", type: "raster", source: "basemap-source" },
        ],
      },
      center,
      zoom,
      attributionControl: false,
    });

    onMapInit?.(map.current);
    map.current.addControl(new maplibregl.AttributionControl(), "bottom-right");

    map.current.on("load", () => {
      setIsLoaded(true);
      writeView(
        [map.current!.getCenter().lng, map.current!.getCenter().lat],
        map.current!.getZoom(),
      );

      map.current!.addSource("oam-tiles", {
        type: "vector",
        url: PMTILES_SOURCE_URL,
        promoteId: "_id",
      });

      // Density layer lives in a separate PMTiles archive
      // (global-coverage.pmtiles) shared with the standalone TMS.
      // Rendered directly rather than re-clustered client-side: its
      // counts are pre-computed from all ~21k images and its per-cell
      // bboxW/S/E/N properties give us precise click-to-zoom without
      // dragging the drop-densest'd footprint tiles into it. See the
      // block comment on DENSITY_PMTILES_URL in utils/constants.ts.
      map.current!.addSource("oam-density", {
        type: "vector",
        url: DENSITY_SOURCE_URL,
      });

      // Density polygons - fill + click target. Hidden once footprints
      // take over so the two never overlap on-screen.
      map.current!.addLayer({
        id: "density-fill",
        type: "fill",
        source: "oam-density",
        "source-layer": DENSITY_SOURCE_LAYER,
        maxzoom: FOOTPRINT_MIN_ZOOM,
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: {
          "fill-color": [
            "interpolate",
            ["linear"],
            ["get", "count"],
            1,
            "#cceeff",
            5,
            "#66b3ff",
            20,
            "#0066cc",
            50,
            "#003366",
          ],
          "fill-opacity": 0.65,
        },
      });
      // Density labels - Points from the backend generator (separate
      // features so tile clipping doesn't drift labels onto cell edges).
      map.current!.addLayer({
        id: "density-count",
        type: "symbol",
        source: "oam-density",
        "source-layer": DENSITY_SOURCE_LAYER,
        maxzoom: FOOTPRINT_MIN_ZOOM,
        filter: ["==", ["geometry-type"], "Point"],
        layout: {
          "text-field": "{count}",
          "text-size": 12,
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": "#003366",
          "text-halo-color": "#ffffff",
          "text-halo-width": 2,
        },
      });

      map.current!.addLayer({
        id: "footprint-fill",
        type: "fill",
        source: "oam-tiles",
        "source-layer": PMTILES_SOURCE_LAYER,
        minzoom: FOOTPRINT_MIN_ZOOM,
        paint: { "fill-color": "#00E5FF", "fill-opacity": 0.1 },
      });
      map.current!.addLayer({
        id: "footprint-line",
        type: "line",
        source: "oam-tiles",
        "source-layer": PMTILES_SOURCE_LAYER,
        minzoom: FOOTPRINT_MIN_ZOOM,
        paint: {
          "line-color": "#00B0FF",
          "line-width": 2,
          "line-opacity": 0.8,
        },
      });
      map.current!.addLayer({
        id: "footprint-hover",
        type: "line",
        source: "oam-tiles",
        "source-layer": PMTILES_SOURCE_LAYER,
        filter: ["==", "_id", ""],
        paint: {
          "line-color": "#2196F3",
          "line-width": 3,
          "line-opacity": 0.9,
        },
      });
      map.current!.addLayer({
        id: "footprint-highlight",
        type: "line",
        source: "oam-tiles",
        "source-layer": PMTILES_SOURCE_LAYER,
        filter: ["==", "_id", ""],
        paint: { "line-color": "#FF0000", "line-width": 3 },
      });

      applyFilters(filtersRef.current);
      applyDensityFilters(filtersRef.current);

      map.current!.on("mousemove", (e) => {
        if (!selectedFeatureRef.current) {
          onHoverRef.current?.(null);
          map.current!.getCanvas().style.cursor = "";
          return;
        }
        const hits = map.current!.queryRenderedFeatures(e.point, {
          layers: ["footprint-fill"],
        });
        const hoveredId =
          hits.length > 0 ? (hits[0].properties?._id ?? null) : null;
        onHoverRef.current?.(hoveredId);
        map.current!.getCanvas().style.cursor = hoveredId ? "pointer" : "";
      });

      map.current!.on("click", (e) => {
        closePopup();

        const hits = map.current!.queryRenderedFeatures(e.point, {
          layers: ["footprint-fill"],
        });
        if (hits.length > 0) {
          const uniqueMap = new Map<string, ImageFeature>();
          for (const h of hits) {
            const id = h.properties?._id as string | undefined;
            if (!id || uniqueMap.has(id)) continue;
            const feature = transformFeature(h);
            const full = getFullBbox(map.current!, id);
            if (full) {
              const b = full.bbox;
              feature.geometry = {
                type: "Polygon",
                coordinates: [
                  [
                    [b[0], b[1]],
                    [b[2], b[1]],
                    [b[2], b[3]],
                    [b[0], b[3]],
                    [b[0], b[1]],
                  ],
                ],
              };
            }
            uniqueMap.set(id, feature);
          }
          const uniqueFeatures = [...uniqueMap.values()];

          if (uniqueFeatures.length === 1) {
            onSelectRef.current?.(uniqueFeatures[0]);
            return;
          }
          if (uniqueFeatures.length > 1) {
            openDisambigPopup(e.lngLat, uniqueFeatures);
            return;
          }
        }

        // Click on a density grid cell → zoom to the imagery inside.
        // The cell's bboxW/S/E/N properties are the union of contained
        // image bboxes (baked into the tile by the backend generator),
        // so we land on the actual imagery not the cell corner. maxZoom
        // caps the zoom so a cell with a single tiny image doesn't
        // catapult the user past FOOTPRINT_MIN_ZOOM without a chance to
        // orient - they'll typically click again once footprints appear.
        const densityHits = map.current!.queryRenderedFeatures(e.point, {
          layers: ["density-fill"],
        });
        if (
          densityHits.length > 0 &&
          (densityHits[0].properties?.count as number) > 0
        ) {
          const gp = densityHits[0].properties as {
            count: number;
            bboxW?: number;
            bboxS?: number;
            bboxE?: number;
            bboxN?: number;
          };
          const imageBounds: BBox =
            gp.bboxW != null
              ? [gp.bboxW, gp.bboxS!, gp.bboxE!, gp.bboxN!]
              : (bbox(densityHits[0]) as BBox);
          map.current!.fitBounds(imageBounds, {
            padding: 20,
            maxZoom: FOOTPRINT_MIN_ZOOM + 2,
          });
          return;
        }

        onSelectRef.current?.(null);
      });

      ["footprint-fill", "density-fill"].forEach((layer) => {
        map.current!.on("mouseenter", layer, () => {
          map.current!.getCanvas().style.cursor = "pointer";
        });
        map.current!.on("mouseleave", layer, () => {
          if (!selectedFeatureRef.current) {
            map.current!.getCanvas().style.cursor = "";
          }
        });
      });

      map.current!.on("movestart", () => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
      });

      map.current!.on("moveend", () => {
        writeView(
          [map.current!.getCenter().lng, map.current!.getCenter().lat],
          map.current!.getZoom(),
        );
        if (isProgrammaticMove.current) {
          isProgrammaticMove.current = false;
          return;
        }
        debounceTimer.current = setTimeout(() => {
          if (!map.current) return;
          const bounds = map.current.getBounds();
          const center = map.current.getCenter();
          const bboxArray: BBox = [
            bounds.getWest(),
            bounds.getSouth(),
            bounds.getEast(),
            bounds.getNorth(),
          ];
          onSearchRef.current?.(bboxArray, [center.lng, center.lat], bboxArray);
        }, 500);
      });

      map.current!.on("idle", () => {
        emitVisibleFeatures();
        setMapZoom(map.current!.getZoom());
        setIdleTick((t) => t + 1);
      });
    });

    // Cleanup on unmount / StrictMode re-invoke. Without this the
    // WebGL context, tile listeners, pending debounce timer, and any
    // open popup all leak on every remount - very visible in dev
    // where React StrictMode mounts, unmounts, and remounts.
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
      popupRef.current?.remove();
      popupRef.current = null;
      map.current?.remove();
      map.current = null;
    };
    // Intentional mount-only effect: the map is built once and event
    // handlers read fresh values via *Ref indirections rather than by
    // closing over props. Adding onMapInit / openDisambigPopup to the
    // deps would re-init the map on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. SEARCH (external bbox request)
  useEffect(() => {
    if (!map.current || !isLoaded || !searchBbox) return;
    try {
      isProgrammaticMove.current = true;
      map.current.fitBounds(searchBbox, { padding: 50, maxZoom: 14 });
    } catch {
      // ignore
    }
  }, [searchBbox, isLoaded]);

  // 3. BASEMAP SWITCHER
  useEffect(() => {
    if (!map.current || !isLoaded) return;
    let tiles: string[] = [];
    if (basemap === "carto") {
      tiles = ["https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"];
    } else if (basemap === "hot") {
      tiles = ["https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"];
    } else if (basemap === "satellite" && MAPBOX_TOKEN) {
      tiles = [
        `https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}@2x.png?access_token=${MAPBOX_TOKEN}`,
      ];
    }
    const source = map.current.getSource("basemap-source") as
      | RasterTileSource
      | undefined;
    if (source && tiles.length > 0) source.setTiles(tiles);
  }, [basemap, isLoaded]);

  // 4. FILTERS
  //
  // Two paths: footprint layers use a plain buildFilter over the
  // per-image properties; the density layer swaps its count source to
  // a filter-aware expression reading pre-baked bucket keys (see
  // utils/filters.ts and the generator). Both must be kept in sync so
  // world-zoom counts and per-image visibility agree.
  useEffect(() => {
    if (!map.current || !isLoaded) return;
    applyFilters(filtersRef.current);
    applyDensityFilters(filtersRef.current);
    emitVisibleFeatures();
  }, [filters, isLoaded]);

  // 5. SELECTION highlight + fitBounds
  useEffect(() => {
    if (!map.current || !isLoaded) return;
    closePopup();
    const mapInstance = map.current;
    const selectedId = selectedFeature?.properties?.id;

    mapInstance.setFilter(
      "footprint-highlight",
      selectedId
        ? (["==", "_id", selectedId] as FilterSpecification)
        : (["==", "_id", ""] as FilterSpecification),
    );

    if (selectedFeature) {
      try {
        isProgrammaticMove.current = true;
        const full = selectedId ? getFullBbox(mapInstance, selectedId) : null;
        const bounds = full ? full.bbox : (bbox(selectedFeature) as BBox);
        mapInstance.fitBounds(bounds, {
          padding: 50,
          maxZoom: 18,
          duration: 1500,
        });
      } catch {
        // ignore
      }
    }

    // Layer stacking + opacity dim on non-selected images.
    const style = mapInstance.getStyle();
    const selectedPreviewLayer = selectedId ? `preview-${selectedId}` : null;
    const selectedTmsLayer = selectedId
      ? `${TMS_PREFIX}${selectedId}-layer`
      : null;
    style?.layers?.forEach((layer) => {
      if (layer.id.startsWith("preview-")) {
        const previewId = layer.id.replace("preview-", "");
        const opacity = selectedId
          ? previewId === selectedId
            ? 1.0
            : 0.3
          : 0.95;
        mapInstance.setPaintProperty(layer.id, "raster-opacity", opacity);
      }
      if (layer.id.startsWith(TMS_PREFIX) && layer.id.endsWith("-layer")) {
        const tmsId = layer.id.replace(TMS_PREFIX, "").replace("-layer", "");
        const opacity = selectedId ? (tmsId === selectedId ? 1.0 : 0.6) : 0.95;
        mapInstance.setPaintProperty(layer.id, "raster-opacity", opacity);
      }
    });
    if (selectedPreviewLayer && mapInstance.getLayer(selectedPreviewLayer)) {
      mapInstance.moveLayer(selectedPreviewLayer, "footprint-hover");
    }
    if (selectedTmsLayer && mapInstance.getLayer(selectedTmsLayer)) {
      mapInstance.moveLayer(selectedTmsLayer, "footprint-hover");
    }

    const fillOpacity = selectedId ? 0 : 0.1;
    const lineOpacity = selectedId ? 0.15 : 0.8;
    if (mapInstance.getLayer("footprint-fill")) {
      mapInstance.setPaintProperty(
        "footprint-fill",
        "fill-opacity",
        fillOpacity,
      );
    }
    if (mapInstance.getLayer("footprint-line")) {
      mapInstance.setPaintProperty(
        "footprint-line",
        "line-opacity",
        lineOpacity,
      );
    }
  }, [selectedFeature, isLoaded]);

  // 6. PREVIEW MANAGEMENT (stretched thumbnails at FOOTPRINT_MIN_ZOOM+)
  useEffect(() => {
    if (!map.current || !isLoaded) return;
    const mapInstance = map.current as MapWithTmsIds;
    const zoom = mapInstance.getZoom();
    const selectedId = selectedFeature?.properties?.id;

    const tmsImageIds = mapInstance._tmsImageIds || new Set<string>();
    const visibleIds = new Set<string>();
    const featureThumbnails = new Map<string, string>();
    if (previewsEnabled && zoom >= FOOTPRINT_MIN_ZOOM) {
      try {
        const raw = mapInstance.queryRenderedFeatures(undefined, {
          layers: ["footprint-fill"],
        });
        for (const f of raw) {
          const p = f.properties as RawTileProperties;
          const id = p._id;
          if (!id || !p.thumbnail) continue;
          if (tmsImageIds.has(id)) continue;
          if (visibleIds.has(id)) continue;
          if (visibleIds.size >= MAX_PREVIEWS) continue;
          visibleIds.add(id);
          featureThumbnails.set(id, p.thumbnail);
        }
      } catch {
        // ignore
      }
    }

    const style = mapInstance.getStyle();
    style?.layers?.forEach((layer) => {
      if (!layer.id.startsWith("preview-")) return;
      const id = layer.id.replace("preview-", "");
      if (!visibleIds.has(id) || mapInstance.getSource(`${TMS_PREFIX}${id}`)) {
        mapInstance.removeLayer(layer.id);
        if (mapInstance.getSource(layer.id)) mapInstance.removeSource(layer.id);
      }
    });

    for (const id of visibleIds) {
      const layerId = `preview-${id}`;
      try {
        const full = getFullBbox(mapInstance, id);
        if (!full) continue;
        const b = full.bbox;
        const coords: [
          [number, number],
          [number, number],
          [number, number],
          [number, number],
        ] = [
          [b[0], b[3]],
          [b[2], b[3]],
          [b[2], b[1]],
          [b[0], b[1]],
        ];

        if (mapInstance.getLayer(layerId)) {
          const source = mapInstance.getSource(layerId) as
            | maplibregl.ImageSource
            | undefined;
          source?.setCoordinates(coords);
          continue;
        }

        const proxyUrl = thumbUrl(featureThumbnails.get(id) || null);
        if (!proxyUrl) continue;
        const opacity = selectedId ? (id === selectedId ? 1.0 : 0.3) : 0.95;

        mapInstance.addSource(layerId, {
          type: "image",
          url: proxyUrl,
          coordinates: coords,
        });
        mapInstance.addLayer(
          {
            id: layerId,
            type: "raster",
            source: layerId,
            paint: { "raster-opacity": opacity, "raster-fade-duration": 0 },
          },
          "footprint-hover",
        );
      } catch {
        // ignore
      }
    }
  }, [isLoaded, selectedFeature, previewsEnabled, idleTick]);

  // 7. TMS FULL-RESOLUTION LAYERS
  // - z10+ (selected only): fitBounds may zoom out below z12, so a lower
  //   threshold for the explicitly-picked image keeps it full-res.
  // - z12+: large images (>50 km²) get TMS automatically.
  // - z16+: all images get TMS, capped at MAX_TMS to bound network cost.
  useEffect(() => {
    if (!map.current || !isLoaded) return;
    const mapInstance = map.current as MapWithTmsIds;
    const zoom = mapInstance.getZoom();
    const selectedId = selectedFeature?.properties?.id;

    const desiredTms = new Map<
      string,
      { url: string; bounds: number[] | null; area: number }
    >();
    const tmsImageIds = new Set<string>();

    if (selectedFeature && zoom >= 10 && selectedId) {
      const p = selectedFeature.properties;
      const rawProps: RawTileProperties = {
        _id: p.id,
        asset_name: p.assetName,
      };
      const tmsUrl = getTmsUrl(rawProps);
      if (tmsUrl) {
        // Lazy-fetch WGS84 bounds so MapLibre only requests tiles
        // where the image has data. Cached per item id; subsequent
        // renders reuse the same entry.
        let itemBounds = itemBoundsRef.current.get(p.id);
        if (itemBounds === "fetching") itemBounds = undefined;
        if (!itemBoundsRef.current.has(p.id)) {
          fetchItemBounds(itemBoundsRef.current, p.id, p.assetName, () =>
            setItemBoundsTick((t) => t + 1),
          );
        }

        const boundsArr = Array.isArray(itemBounds) ? itemBounds : null;
        const area = boundsArr ? bboxAreaKm2(boundsArr as BBox) : 0;
        desiredTms.set(`${TMS_PREFIX}${selectedId}`, {
          url: tmsUrl,
          bounds: boundsArr,
          area,
        });
        tmsImageIds.add(selectedId);
      }
    }

    if (zoom >= TMS_LARGE_MIN_ZOOM) {
      try {
        const raw = mapInstance.querySourceFeatures("oam-tiles", {
          sourceLayer: PMTILES_SOURCE_LAYER,
        });
        const seen = new Set<string>();
        for (const f of raw) {
          if (desiredTms.size >= MAX_TMS) break;
          const p = f.properties as RawTileProperties;
          const id = p._id;
          if (!id || seen.has(id)) continue;
          seen.add(id);
          if (desiredTms.has(`${TMS_PREFIX}${id}`)) continue;
          if (!matchesFilters(p, filtersRef.current)) continue;

          const full = getFullBbox(mapInstance, id);
          if (!full) continue;
          const area = bboxAreaKm2(full.bbox);
          if (zoom < TMS_ALL_MIN_ZOOM && area <= LARGE_IMAGE_THRESHOLD_SQ_KM) {
            continue;
          }
          const tmsUrl = getTmsUrl(p);
          if (tmsUrl) {
            desiredTms.set(`${TMS_PREFIX}${id}`, {
              url: tmsUrl,
              bounds: full.bbox as number[],
              area,
            });
            tmsImageIds.add(id);
          }
        }
      } catch {
        // ignore
      }
    }

    mapInstance._tmsImageIds = tmsImageIds;

    const style = mapInstance.getStyle();
    style?.layers?.forEach((layer) => {
      if (!layer.id.startsWith(TMS_PREFIX)) return;
      if (!layer.id.endsWith("-layer")) return;
      const sourceId = layer.id.replace("-layer", "");
      if (desiredTms.has(sourceId)) return;
      mapInstance.removeLayer(layer.id);
      if (mapInstance.getSource(sourceId)) mapInstance.removeSource(sourceId);
    });

    const sorted = [...desiredTms.entries()].sort((a, b) => {
      const aIsSelected = a[0] === `${TMS_PREFIX}${selectedId}`;
      const bIsSelected = b[0] === `${TMS_PREFIX}${selectedId}`;
      if (aIsSelected) return 1;
      if (bIsSelected) return -1;
      return (b[1].area || 0) - (a[1].area || 0);
    });

    for (const [sourceId, { url, bounds }] of sorted) {
      const layerId = `${sourceId}-layer`;
      const isSelected = sourceId === `${TMS_PREFIX}${selectedId}`;

      const existing = mapInstance.getSource(sourceId) as
        | (RasterTileSource & { tiles?: string[]; bounds?: number[] })
        | undefined;
      if (existing) {
        const urlMatch = existing.tiles && existing.tiles[0] === url;
        const boundsMatch =
          !bounds ||
          (!!existing.bounds &&
            existing.bounds[0] <= bounds[0] &&
            existing.bounds[1] <= bounds[1] &&
            existing.bounds[2] >= bounds[2] &&
            existing.bounds[3] >= bounds[3]);
        if (urlMatch && boundsMatch) {
          const opacity = isSelected ? 1.0 : selectedId ? 0.6 : 0.95;
          if (mapInstance.getLayer(layerId)) {
            mapInstance.setPaintProperty(layerId, "raster-opacity", opacity);
            mapInstance.moveLayer(layerId, "footprint-hover");
          }
          continue;
        }
        if (mapInstance.getLayer(layerId)) mapInstance.removeLayer(layerId);
        mapInstance.removeSource(sourceId);
      }

      try {
        const opacity = isSelected ? 1.0 : selectedId ? 0.6 : 0.95;
        const sourceOpts: maplibregl.RasterSourceSpecification = {
          type: "raster",
          tiles: [url],
          tileSize: 256,
          minzoom: isSelected ? 10 : 12,
          maxzoom: 22,
        };
        if (bounds)
          sourceOpts.bounds = bounds as [number, number, number, number];
        mapInstance.addSource(sourceId, sourceOpts);
        mapInstance.addLayer(
          {
            id: layerId,
            type: "raster",
            source: sourceId,
            paint: { "raster-opacity": opacity },
          },
          "footprint-hover",
        );
      } catch (e) {
        console.error("TMS layer error:", e);
      }
    }
  }, [selectedFeature, isLoaded, idleTick, itemBoundsTick, filters]);

  // 8. HOVER HIGHLIGHT
  useEffect(() => {
    if (!map.current || !isLoaded) return;
    const selectedId = selectedFeature?.properties?.id;
    const showHover =
      selectedId && hoveredFeatureId && hoveredFeatureId !== selectedId;
    map.current.setFilter(
      "footprint-hover",
      showHover
        ? (["==", "_id", hoveredFeatureId] as FilterSpecification)
        : (["==", "_id", ""] as FilterSpecification),
    );
  }, [hoveredFeatureId, selectedFeature, isLoaded]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />
      <div className="absolute bottom-8 left-4 z-10">
        <button
          onClick={() => setPreviewsEnabled(!previewsEnabled)}
          disabled={mapZoom < FOOTPRINT_MIN_ZOOM}
          className={`px-4 py-2 text-xs font-semibold rounded-md shadow-md border transition-all ${
            mapZoom < FOOTPRINT_MIN_ZOOM
              ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
              : previewsEnabled
                ? "bg-cyan-50 text-cyan-700 border-cyan-200"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
          }`}
        >
          {mapZoom < FOOTPRINT_MIN_ZOOM
            ? "Previews (zoom in)"
            : previewsEnabled
              ? "Previews On"
              : "Previews Off"}
        </button>
      </div>
    </div>
  );
}
