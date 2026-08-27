import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { BBox } from "../utils/geo";
import { BASEMAP_STYLE_URL } from "../utils/constants";

interface MiniMapProps {
  center: [number, number] | null;
  bounds: BBox | null;
}

function drawBox(map: maplibregl.Map | null, bounds: BBox | null) {
  if (!map || !bounds) return;
  const source = map.getSource("box") as maplibregl.GeoJSONSource | undefined;
  if (!source) return;
  const [w, s, e, n] = bounds;
  source.setData({
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [w, n],
          [e, n],
          [e, s],
          [w, s],
          [w, n],
        ],
      ],
    },
  });
}

// Small overview map anchored bottom-right that mirrors the main map's
// viewport as a red rectangle. Intentionally non-interactive.
export default function MiniMap({ center, bounds }: MiniMapProps) {
  const container = useRef<HTMLDivElement | null>(null);
  const map = useRef<maplibregl.Map | null>(null);
  // Latch the initial centre in a ref so the mount effect can read it
  // without adding `center` to the dep array (which would re-init the
  // map on every parent-map move - the second effect updates the
  // centre imperatively instead).
  const initialCenterRef = useRef(center);
  // The basemap style is fetched, so the box source only exists once
  // the map has loaded. Latch the newest bounds for the load handler so
  // a viewport change that lands first still gets drawn.
  const boundsRef = useRef(bounds);

  useEffect(() => {
    if (map.current || !container.current) return;
    map.current = new maplibregl.Map({
      container: container.current,
      style: BASEMAP_STYLE_URL,
      center: initialCenterRef.current || [0, 20],
      zoom: 0,
      interactive: false,
      attributionControl: false,
    });
    map.current.on("load", () => {
      map.current!.addSource("box", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      // HOT primary red (matches --hot-color-primary-600). Kept as
      // a literal because MapLibre paint props are evaluated
      // outside CSS and can't read custom properties.
      map.current!.addLayer({
        id: "box-line",
        type: "line",
        source: "box",
        paint: { "line-color": "#D73F3F", "line-width": 2 },
      });
      map.current!.addLayer({
        id: "box-fill",
        type: "fill",
        source: "box",
        paint: { "fill-color": "#D73F3F", "fill-opacity": 0.1 },
      });
      drawBox(map.current, boundsRef.current);
    });
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    boundsRef.current = bounds;
    if (!map.current) return;
    if (center) map.current.setCenter(center);
    drawBox(map.current, bounds);
  }, [center, bounds]);

  return (
    <div className="relative group">
      <div
        ref={container}
        className="w-32 h-32 border-2 border-white rounded shadow-lg bg-gray-100 pointer-events-none"
      />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
        <div className="w-full h-[1px] bg-black" />
        <div className="h-full w-[1px] bg-black absolute" />
      </div>
    </div>
  );
}
