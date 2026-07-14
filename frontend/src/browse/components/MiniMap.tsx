import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { BBox } from "../utils/geo";

interface MiniMapProps {
  center: [number, number] | null;
  bounds: BBox | null;
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

  useEffect(() => {
    if (map.current || !container.current) return;
    map.current = new maplibregl.Map({
      container: container.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: [
              "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
            ],
            tileSize: 256,
            attribution: "",
          },
          box: {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          },
        },
        layers: [
          { id: "osm", type: "raster", source: "osm", minzoom: 0, maxzoom: 22 },
          // HOT primary red (matches --hot-color-primary-600). Kept as
          // a literal because MapLibre paint props are evaluated
          // outside CSS and can't read custom properties.
          {
            id: "box-line",
            type: "line",
            source: "box",
            paint: { "line-color": "#D73F3F", "line-width": 2 },
          },
          {
            id: "box-fill",
            type: "fill",
            source: "box",
            paint: { "fill-color": "#D73F3F", "fill-opacity": 0.1 },
          },
        ],
      },
      center: initialCenterRef.current || [0, 20],
      zoom: 0,
      interactive: false,
      attributionControl: false,
    });
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (!map.current) return;
    if (center) map.current.setCenter(center);
    if (bounds) {
      const [w, s, e, n] = bounds;
      const source = map.current.getSource("box") as
        | maplibregl.GeoJSONSource
        | undefined;
      if (source) {
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
    }
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
