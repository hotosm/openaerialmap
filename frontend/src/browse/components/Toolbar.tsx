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
  "w-9 h-9 bg-white border border-gray-200 text-gray-600 hover:text-cyan-600 hover:bg-gray-50 flex items-center justify-center transition-colors shadow-sm relative z-20";

// Icons kept inline as small JSX rather than lucide-react to avoid adding
// a whole icon library for four glyphs.
const IconPlus = () => (
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
  />
);
const IconMinus = () => (
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    d="M20 12H4"
  />
);
const IconSearch = () => (
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
  />
);
const IconLayers = () => (
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.447-.894L15 7m0 13V7"
  />
);

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
          onClick={() => toggleTool("search")}
          className={`${btnClass} rounded-t-md ${
            activeTool === "search" ? "text-cyan-600 bg-cyan-50" : ""
          }`}
          title="Search Location"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <IconSearch />
          </svg>
        </button>
        {activeTool === "search" && (
          <div className="absolute left-10 top-0 bg-white p-2 rounded shadow-xl border border-gray-200 w-64 flex gap-1 h-9 items-center z-50">
            <form onSubmit={handleSearch} className="flex gap-1 w-full">
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="City, Country..."
                className="flex-1 text-xs border border-gray-300 rounded px-2 py-1 outline-none focus:border-cyan-500"
              />
              <button
                type="submit"
                disabled={isSearching}
                className="bg-cyan-500 text-white px-2 py-1 rounded text-xs font-bold hover:bg-cyan-600"
              >
                {isSearching ? ".." : "Go"}
              </button>
            </form>
          </div>
        )}
      </div>

      <div className="relative">
        <button
          onClick={() => toggleTool("layers")}
          className={`${btnClass} border-t-0 ${
            activeTool === "layers" ? "text-cyan-600 bg-cyan-50" : ""
          }`}
          title="Change Basemap"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <IconLayers />
          </svg>
        </button>
        {activeTool === "layers" && (
          <div className="absolute left-10 top-0 bg-white rounded shadow-xl border border-gray-200 overflow-hidden w-48 z-50">
            <div className="text-[10px] uppercase font-bold text-gray-400 px-3 py-2 bg-gray-50 border-b border-gray-100">
              Basemap
            </div>
            {basemapOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => {
                  setBasemap(opt.id);
                  setActiveTool(null);
                }}
                className={`block w-full text-left px-4 py-2 text-xs font-medium hover:bg-gray-50 border-b border-gray-50 last:border-0 ${
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
        onClick={() => mapInstance?.zoomIn()}
        className={`${btnClass} border-t-0`}
        title="Zoom In"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <IconPlus />
        </svg>
      </button>
      <button
        onClick={() => mapInstance?.zoomOut()}
        className={`${btnClass} border-t-0 rounded-b-md`}
        title="Zoom Out"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <IconMinus />
        </svg>
      </button>
    </div>
  );
}
