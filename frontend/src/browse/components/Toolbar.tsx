import { useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { BBox } from "../utils/geo";
import { MAPBOX_TOKEN } from "../utils/constants";

export type Basemap = "carto" | "hot" | "satellite";

interface Props {
  className?: string;
  mapInstance: MapLibreMap | null;
  onLocationSelect: (bbox: BBox) => void;
  basemap: Basemap;
  setBasemap: (b: Basemap) => void;
}

const btnClass =
  "w-9 h-9 bg-white border border-gray-200 text-gray-600 hover:text-cyan-600 hover:bg-gray-50 flex items-center justify-center transition-colors shadow-sm relative z-20 cursor-pointer";

export default function Toolbar({
  className,
  mapInstance,
  onLocationSelect,
  basemap,
  setBasemap,
}: Props) {
  const [activeTool, setActiveTool] = useState<"search" | "layers" | null>(
    null,
  );
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const toggleTool = (tool: "search" | "layers") =>
    setActiveTool(activeTool === tool ? null : tool);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;
    setIsSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`,
      );
      const data = (await res.json()) as Array<{ boundingbox: string[] }>;
      if (data && data.length > 0) {
        const r = data[0];
        const bbox: BBox = [
          parseFloat(r.boundingbox[2]),
          parseFloat(r.boundingbox[0]),
          parseFloat(r.boundingbox[3]),
          parseFloat(r.boundingbox[1]),
        ];
        onLocationSelect(bbox);
        setActiveTool(null);
        setQuery("");
      } else {
        alert("Location not found");
      }
    } catch (err) {
      console.error(err);
    }
    setIsSearching(false);
  };

  const basemapOptions: Array<{ id: Basemap; label: string }> = [
    { id: "carto", label: "Carto Light" },
    { id: "hot", label: "Humanitarian OSM" },
  ];
  if (MAPBOX_TOKEN) {
    basemapOptions.push({ id: "satellite", label: "Mapbox Satellite" });
  }

  return (
    <div
      className={`flex flex-col font-sans shadow-lg rounded-md ${className}`}
    >
      <div className="relative">
        <button
          type="button"
          onClick={() => toggleTool("search")}
          className={`${btnClass} rounded-t-md ${
            activeTool === "search" ? "text-cyan-600 bg-cyan-50" : ""
          }`}
          title="Search Location"
          aria-label="Search location"
        >
          <wa-icon name="magnifying-glass" variant="solid" />
        </button>
        {activeTool === "search" && (
          <div className="absolute left-10 top-0 bg-white p-2 rounded shadow-xl border border-gray-200 w-64 flex gap-1 items-center z-50">
            <form onSubmit={handleSearch} className="flex gap-1 w-full">
              <wa-input
                autoFocus
                size="small"
                value={query}
                placeholder="City, Country..."
                class="flex-1"
                onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
              />
              <wa-button
                type="submit"
                size="small"
                variant="brand"
                disabled={isSearching}
              >
                {isSearching ? "…" : "Go"}
              </wa-button>
            </form>
          </div>
        )}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => toggleTool("layers")}
          className={`${btnClass} border-t-0 ${
            activeTool === "layers" ? "text-cyan-600 bg-cyan-50" : ""
          }`}
          title="Change Basemap"
          aria-label="Change basemap"
        >
          <wa-icon name="layer-group" variant="solid" />
        </button>
        {activeTool === "layers" && (
          <div className="absolute left-10 top-0 bg-white rounded shadow-xl border border-gray-200 overflow-hidden w-48 z-50">
            <div className="text-[10px] uppercase font-bold text-gray-400 px-3 py-2 bg-gray-50 border-b border-gray-100">
              Basemap
            </div>
            {basemapOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setBasemap(opt.id);
                  setActiveTool(null);
                }}
                className={`block w-full text-left px-4 py-2 text-xs font-medium hover:bg-gray-50 border-b border-gray-50 last:border-0 cursor-pointer ${
                  basemap === opt.id
                    ? "text-cyan-600 bg-cyan-50"
                    : "text-gray-700"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => mapInstance?.zoomIn()}
        className={`${btnClass} border-t-0`}
        title="Zoom In"
        aria-label="Zoom in"
      >
        <wa-icon name="plus" variant="solid" />
      </button>
      <button
        type="button"
        onClick={() => mapInstance?.zoomOut()}
        className={`${btnClass} border-t-0 rounded-b-md`}
        title="Zoom Out"
        aria-label="Zoom out"
      >
        <wa-icon name="minus" variant="solid" />
      </button>
    </div>
  );
}
