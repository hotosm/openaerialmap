import { useEffect, useRef, useState } from "react";
import bbox from "@turf/bbox";
import type { ImageFeature } from "../utils/types";
import {
  COLLECTION_ID,
  STAC_BROWSER_URL,
  STAC_TITILER_URL,
  STAC_URL,
} from "../utils/constants";
import { formatDate, formatPlatform, toSentenceCase } from "../utils/format";
import { triggerTilepack, type TilepackFormat } from "../utils/tilepack";

interface Props {
  feature: ImageFeature;
  onSelect: (f: ImageFeature | null) => void;
  isSelected: boolean;
}

// TiTiler-PgSTAC tile URL template for iD / JOSM handoff and the "Copy
// TMS" button. Uses the exact same endpoint MapLibre consumes for the
// full-res raster overlay (see utils/tiles.ts:getTmsUrl); editors read
// the `{z}/{x}/{y}` placeholders directly, no rewriting required.
function tmsTemplate(p: ImageFeature["properties"]): string {
  if (!p.id) return "";
  return (
    `${STAC_TITILER_URL}/collections/${COLLECTION_ID}/items/${p.id}` +
    `/tiles/WebMercatorQuad/{z}/{x}/{y}@1x?assets=${p.assetName}&nodata=0`
  );
}

// STAC Browser (https://github.com/radiantearth/stac-browser) reads a
// remote catalog via `/external/<url without protocol>` and renders a
// rich metadata page for the item - useful for anything beyond the
// compact grid the sidebar can show. The OAM deployment uses history-
// mode routing (path segment, no `#/`), so the ingress rewrite handles
// the SPA route.
function stacBrowserItemUrl(itemId: string): string {
  const stacHostPath = STAC_URL.replace(/^https?:\/\//, "");
  return `${STAC_BROWSER_URL}/external/${stacHostPath}/collections/${COLLECTION_ID}/items/${itemId}`;
}

// One state machine per format. The button always presents as
// "Download <format>" - user does not need to know whether the
// archive already exists. Behind the scenes:
//   idle       -> nothing in flight; click POSTs to the packager
//   working    -> POST in flight; render spinner + "Generating..."
//   pending    -> POST returned 202 (worker still running); render
//                 spinner + "Generating..." and let the user re-click
//                 to re-check status (no background polling)
//   ready      -> URL known from a previous "ready" packager response;
//                 click just downloads without re-POSTing
//   error      -> last request failed; button offers a retry
type TilepackState =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "pending" }
  | { kind: "ready"; url: string }
  | { kind: "error"; message: string };

export default function ImageCard({ feature, onSelect, isSelected }: Props) {
  const [isExpanded, setIsExpanded] = useState(isSelected);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [pmtilesState, setPmtilesState] = useState<TilepackState>({
    kind: "idle",
  });
  const [mbtilesState, setMbtilesState] = useState<TilepackState>({
    kind: "idle",
  });
  const cardRef = useRef<HTMLDivElement | null>(null);
  // Track previous selection in state (not a ref - see
  // react-hooks/refs) so we can reset local expansion when the prop
  // flips. Users can still toggle "Show/Hide Details" mid-selection.
  const [prevSelected, setPrevSelected] = useState(isSelected);

  if (isSelected !== prevSelected) {
    setPrevSelected(isSelected);
    setIsExpanded(isSelected);
  }

  // Scroll-into-view is a DOM side effect, so it stays in useEffect.
  useEffect(() => {
    if (!isSelected) return;
    const t = setTimeout(() => {
      cardRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 100);
    return () => clearTimeout(t);
  }, [isSelected]);

  const p = feature.properties;

  // Fire (or re-check) a canonical tilepack build. When the packager
  // reports ready we open the archive URL so the user's click behaves
  // like a real download - no extra "click again to download" step.
  const runTilepack = async (format: TilepackFormat) => {
    if (!p.id) return;
    const setState = format === "pmtiles" ? setPmtilesState : setMbtilesState;
    setState({ kind: "working" });
    try {
      const res = await triggerTilepack(p.id, format);
      if (res.status === "ready" && res.url) {
        setState({ kind: "ready", url: res.url });
        window.open(res.url, "_blank", "noopener,noreferrer");
      } else if (res.status === "started" || res.status === "in_progress") {
        setState({ kind: "pending" });
      } else if (res.status === "rate_limited") {
        setState({
          kind: "error",
          message: `Rate limited. Try again in ${res.retry_after ?? 30}s.`,
        });
      } else {
        setState({
          kind: "error",
          message: res.message || `Request failed (${res.httpStatus}).`,
        });
      }
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Request failed.",
      });
    }
  };

  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const handleCopy = (
    e: React.MouseEvent,
    text: string,
    feedbackId: string,
  ) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopyFeedback(feedbackId);
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  const handleOpenJosm = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = tmsTemplate(p);
    const title = `OAM - ${p.title || p.id}`;
    const tmsUrl = `tms[22]:${url}`;
    const josmUrl = `http://127.0.0.1:8111/imagery?title=${encodeURIComponent(
      title,
    )}&type=tms&url=${encodeURIComponent(tmsUrl)}`;
    try {
      await fetch(josmUrl);
    } catch {
      alert(
        "Could not connect to JOSM. Make sure JOSM is running and 'Remote Control' is enabled.",
      );
    }
  };

  const handleOpenId = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = tmsTemplate(p);
    const featureBbox = bbox(feature);
    const centerX = (featureBbox[0] + featureBbox[2]) / 2;
    const centerY = (featureBbox[1] + featureBbox[3]) / 2;
    const zoom = 16;
    const backgroundParam = `custom:${url}`;
    const idUrl = `https://www.openstreetmap.org/edit?editor=id#map=${zoom}/${centerY}/${centerX}&background=${encodeURIComponent(
      backgroundParam,
    )}`;
    window.open(idUrl, "_blank");
  };

  return (
    <div
      ref={cardRef}
      onClick={() => onSelect(feature)}
      className={`group border-b transition-all duration-200 relative ${
        isSelected
          ? "bg-white border-l-4 border-l-cyan-500 shadow-md my-2 rounded-r-md"
          : "border-gray-100 bg-white hover:bg-gray-50 border-l-4 border-l-transparent"
      }`}
    >
      {isSelected && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelect(null);
          }}
          className="absolute top-2 right-2 text-gray-400 hover:text-cyan-600 p-1 hover:bg-gray-100 rounded-full z-10"
          title="Deselect"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      )}

      <div className="p-4">
        <div className="aspect-video bg-gray-100 rounded-md mb-3 overflow-hidden relative border border-gray-200 shadow-inner">
          {p.thumbnail ? (
            <img
              src={p.thumbnail}
              alt="Preview"
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-xs">
              No Preview
            </div>
          )}
        </div>

        <div className="flex justify-between items-start gap-2 pr-6">
          <h3
            className={`font-bold text-sm leading-tight ${
              isSelected ? "text-cyan-700" : "text-gray-800"
            }`}
          >
            {p.title}
          </h3>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
          <span className="font-medium text-gray-700">
            {formatDate(p.date)}
          </span>
          <span className="text-gray-300">•</span>
          <span className="truncate max-w-[150px]" title={p.provider}>
            {p.provider}
          </span>
        </div>

        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded((v) => !v);
            }}
            className="flex-1 text-xs font-semibold text-gray-500 hover:text-cyan-600 flex items-center justify-center gap-1 py-1.5 transition-colors"
          >
            {isExpanded ? "Hide Details" : "Show Details"}
            <span
              className="text-[9px] transform transition-transform duration-200"
              style={{
                transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
              }}
            >
              ▼
            </span>
          </button>
          {p.uuid && (
            <a
              href={p.uuid}
              target="_blank"
              rel="noreferrer"
              download
              onClick={stop}
              className="flex-1 text-xs font-semibold text-cyan-600 bg-cyan-50 hover:bg-cyan-100 py-1.5 rounded text-center transition-colors"
            >
              Download GeoTIFF
            </a>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="bg-gray-50 px-4 py-4 text-xs border-t border-gray-100 text-gray-600">
          <div className="mb-4 pb-3 border-b border-gray-200 space-y-2">
            <div className="flex gap-2">
              <button
                onClick={(e) => handleCopy(e, tmsTemplate(p), "tms")}
                className="flex-1 bg-white border border-gray-300 text-gray-600 py-1.5 rounded hover:bg-gray-100 hover:border-gray-400 transition-all shadow-sm"
              >
                {copyFeedback === "tms" ? (
                  <span className="text-green-600 font-bold">Copied!</span>
                ) : (
                  "Copy TMS"
                )}
              </button>
              <button
                onClick={handleOpenId}
                className="flex-1 bg-white border border-gray-300 text-gray-600 py-1.5 rounded hover:bg-gray-100 hover:border-gray-400 transition-all shadow-sm"
              >
                Open iD
              </button>
              <button
                onClick={handleOpenJosm}
                className="flex-1 bg-white border border-gray-300 text-gray-600 py-1.5 rounded hover:bg-gray-100 hover:border-gray-400 transition-all shadow-sm"
              >
                Open JOSM
              </button>
            </div>
            <div className="flex gap-2">
              <TilepackButton
                format="pmtiles"
                state={pmtilesState}
                onGenerate={() => runTilepack("pmtiles")}
              />
              <TilepackButton
                format="mbtiles"
                state={mbtilesState}
                onGenerate={() => runTilepack("mbtiles")}
              />
            </div>
            {(pmtilesState.kind === "pending" ||
              mbtilesState.kind === "pending") && (
              <p className="text-[11px] leading-snug text-gray-500">
                This can take a few minutes for large images. Click the button
                again to check status; no need to wait on this page.
              </p>
            )}
            {pmtilesState.kind === "error" && (
              <p className="text-[11px] leading-snug text-red-600">
                PMTiles: {pmtilesState.message}
              </p>
            )}
            {mbtilesState.kind === "error" && (
              <p className="text-[11px] leading-snug text-red-600">
                MBTiles: {mbtilesState.message}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-y-3 gap-x-4">
            <div>
              <span className="block text-[10px] uppercase text-gray-400 font-bold">
                Platform Type
              </span>
              {formatPlatform(p.platform)}
            </div>
            <div>
              <span className="block text-[10px] uppercase text-gray-400 font-bold">
                Sensor
              </span>
              {toSentenceCase(p.sensor)}
            </div>
            <div>
              <span className="block text-[10px] uppercase text-gray-400 font-bold">
                GSD (Resolution)
              </span>
              {p.gsd}
            </div>
            <div>
              <span className="block text-[10px] uppercase text-gray-400 font-bold">
                File Size
              </span>
              {p.file_size || "Unknown"}
            </div>
            <div>
              <span className="block text-[10px] uppercase text-gray-400 font-bold">
                License
              </span>
              <a
                href="https://creativecommons.org/licenses/"
                target="_blank"
                rel="noreferrer"
                className="hover:underline hover:text-cyan-600 truncate block"
                title={p.license}
              >
                {p.license}
              </a>
            </div>
            <div className="min-w-0">
              <span className="block text-[10px] uppercase text-gray-400 font-bold">
                ID
              </span>
              <span
                className="font-mono text-[10px] text-gray-500 block truncate select-all cursor-text bg-gray-100 px-1 rounded"
                title={p.id}
              >
                {p.id}
              </span>
            </div>
          </div>
          {p.id && (
            <div className="mt-4 pt-3 border-t border-gray-200 text-right">
              <a
                href={stacBrowserItemUrl(p.id)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={stop}
                className="text-[11px] font-semibold text-cyan-700 hover:text-cyan-800 hover:underline inline-flex items-center gap-1"
              >
                Open in STAC Browser
                <span aria-hidden="true">→</span>
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface TilepackButtonProps {
  format: TilepackFormat;
  state: TilepackState;
  onGenerate: () => void;
}

function TilepackButton({ format, state, onGenerate }: TilepackButtonProps) {
  const label = format === "pmtiles" ? "PMTiles" : "MBTiles";
  const baseClass =
    "flex-1 py-1.5 rounded transition-all shadow-sm text-center border flex items-center justify-center gap-2";

  // Ready: we already have a URL (either from an earlier "ready"
  // response in this session, or the packager returned 200 on the
  // triggering click). Rendered as an anchor so the browser handles
  // download semantics.
  if (state.kind === "ready") {
    return (
      <a
        href={state.url}
        target="_blank"
        rel="noreferrer"
        download
        onClick={(e) => e.stopPropagation()}
        className={`${baseClass} font-semibold text-cyan-700 bg-cyan-50 border-cyan-200 hover:bg-cyan-100`}
      >
        Download {label}
      </a>
    );
  }

  // Working (POST in flight) or pending (server returned 202) both
  // show the spinner. Pending is still clickable so the user can
  // re-check without waiting on background polling.
  if (state.kind === "working" || state.kind === "pending") {
    const disabled = state.kind === "working";
    return (
      <button
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) onGenerate();
        }}
        className={`${baseClass} bg-amber-50 border-amber-200 text-amber-800 ${
          disabled ? "cursor-wait" : "hover:bg-amber-100"
        }`}
        title={
          state.kind === "pending"
            ? "Still generating - click to check status"
            : undefined
        }
      >
        <Spinner />
        Generating…
      </button>
    );
  }

  // Idle or error. Error surfaces a red border; the accompanying
  // message is rendered by the parent below the button row.
  const errored = state.kind === "error";
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onGenerate();
      }}
      className={`${baseClass} ${
        errored
          ? "bg-white border-red-300 text-red-600 hover:bg-red-50"
          : "bg-white border-gray-300 text-gray-600 hover:bg-gray-100 hover:border-gray-400"
      }`}
    >
      Download {label}
    </button>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-3.5 w-3.5"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}
