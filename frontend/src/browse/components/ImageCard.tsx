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
  // Guards the tilepack POST callback: cards unmount when the sidebar
  // pages or the user pans away, so a resolving fetch can otherwise
  // call setState on a dead component.
  const unmountedRef = useRef(false);
  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
    };
  }, []);
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
      if (unmountedRef.current) return;
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
      if (unmountedRef.current) return;
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
        // Prominent deselect affordance. When an image is selected the
        // map fades non-selected footprints, so the user needs an
        // obvious way back to the unfiltered view. Dark circle with a
        // white glyph reads clearly against both the white card and
        // the image thumbnail below it. Also see Browse.tsx for the
        // Escape-key shortcut.
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(null);
          }}
          className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center bg-gray-900 text-white hover:bg-cyan-600 rounded-full z-10 cursor-pointer shadow-md transition-colors ring-2 ring-white"
          title="Deselect image (Esc)"
          aria-label="Deselect image"
        >
          <wa-icon name="xmark" variant="solid" auto-width />
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
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded((v) => !v);
            }}
            className="flex-1 text-xs font-semibold text-gray-500 hover:text-cyan-600 flex items-center justify-center gap-1 py-1.5 transition-colors cursor-pointer"
          >
            {isExpanded ? "Hide Details" : "Show Details"}
            <wa-icon
              name={isExpanded ? "chevron-up" : "chevron-down"}
              variant="solid"
              auto-width
              class="text-[10px]"
            />
          </button>
          {p.uuid && (
            <wa-button
              size="small"
              variant="brand"
              appearance="filled"
              class="flex-1"
              onClick={(e) => {
                e.stopPropagation();
                window.open(p.uuid!, "_blank", "noopener,noreferrer");
              }}
            >
              Download GeoTIFF
            </wa-button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="bg-gray-50 px-4 py-4 text-xs border-t border-gray-100 text-gray-600">
          <div className="mb-4 pb-3 border-b border-gray-200 space-y-2">
            <div className="flex gap-2">
              <wa-button
                size="small"
                appearance="outlined"
                class="flex-1"
                onClick={(e) => handleCopy(e, tmsTemplate(p), "tms")}
              >
                {copyFeedback === "tms" ? "Copied!" : "Copy TMS"}
              </wa-button>
              <wa-button
                size="small"
                appearance="outlined"
                class="flex-1"
                onClick={handleOpenId}
              >
                Open iD
              </wa-button>
              <wa-button
                size="small"
                appearance="outlined"
                class="flex-1"
                onClick={handleOpenJosm}
              >
                Open JOSM
              </wa-button>
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
              <wa-callout
                variant="danger"
                size="small"
                class="text-[11px] leading-snug"
              >
                PMTiles: {pmtilesState.message}
              </wa-callout>
            )}
            {mbtilesState.kind === "error" && (
              <wa-callout
                variant="danger"
                size="small"
                class="text-[11px] leading-snug"
              >
                MBTiles: {mbtilesState.message}
              </wa-callout>
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

  // Ready: we already have a URL (either from an earlier "ready"
  // response in this session, or the packager returned 200 on the
  // triggering click). Open in a new tab so the browser handles
  // download semantics.
  if (state.kind === "ready") {
    return (
      <wa-button
        size="small"
        variant="brand"
        appearance="filled"
        class="flex-1"
        onClick={(e) => {
          e.stopPropagation();
          window.open(state.url, "_blank", "noopener,noreferrer");
        }}
      >
        Download {label}
      </wa-button>
    );
  }

  // Working (POST in flight) or pending (server returned 202) both
  // show the spinner. Pending is still clickable so the user can
  // re-check without waiting on background polling.
  if (state.kind === "working" || state.kind === "pending") {
    const disabled = state.kind === "working";
    return (
      <wa-button
        size="small"
        variant="warning"
        appearance="outlined"
        class="flex-1"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) onGenerate();
        }}
        title={
          state.kind === "pending"
            ? "Still generating - click to check status"
            : undefined
        }
      >
        <wa-spinner slot="start" style={{ fontSize: "0.875rem" }} />
        Generating…
      </wa-button>
    );
  }

  // Idle or error. Error surfaces a danger-variant button; the
  // accompanying message is rendered by the parent below the button
  // row.
  const errored = state.kind === "error";
  return (
    <wa-button
      size="small"
      variant={errored ? "danger" : "neutral"}
      appearance="outlined"
      class="flex-1"
      onClick={(e) => {
        e.stopPropagation();
        onGenerate();
      }}
    >
      Download {label}
    </wa-button>
  );
}
