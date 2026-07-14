import { useEffect, useRef, useState } from "react";
import ImageCard from "./ImageCard";
import type { ImageFeature } from "../utils/types";
import { SIDEBAR_PAGE_SIZE } from "../utils/constants";

interface Props {
  features: ImageFeature[];
  onSelect: (f: ImageFeature | null) => void;
  selectedFeature: ImageFeature | null;
}

export default function Sidebar({
  features,
  onSelect,
  selectedFeature,
}: Props) {
  const [visibleCount, setVisibleCount] = useState(SIDEBAR_PAGE_SIZE);
  const listRef = useRef<HTMLDivElement | null>(null);
  // Track the previous feature-id list in state (not a ref) so React's
  // lint rules for refs-during-render stay happy. React docs endorse
  // this pattern for "reset derived state when a prop changes":
  //   https://react.dev/reference/react/useState#storing-information-from-previous-renders
  // setState-during-render short-circuits when the values equal.
  const [prevIds, setPrevIds] = useState("");

  // Reset pagination when the *set* of feature ids changes
  // (i.e. viewport moved, not just a selection made).
  const ids = features.map((f) => f.properties.id).join(",");
  if (ids !== prevIds) {
    setPrevIds(ids);
    setVisibleCount(SIDEBAR_PAGE_SIZE);
  }

  // The scroll reset is a DOM side-effect (not React state), so it
  // stays in useEffect.
  useEffect(() => {
    if (!selectedFeature && listRef.current) {
      // Only reset scroll when we've just reset pagination.
      if (visibleCount === SIDEBAR_PAGE_SIZE) {
        listRef.current.scrollTop = 0;
      }
    }
  }, [visibleCount, selectedFeature]);

  // If the selected feature is beyond the currently-visible slice,
  // extend visibleCount so its card renders. Same setState-in-render
  // pattern: guarded by a stale-check so we don't loop.
  if (selectedFeature) {
    const selIdx = features.findIndex(
      (f) => f.properties.id === selectedFeature.properties.id,
    );
    if (selIdx >= visibleCount) {
      setVisibleCount(selIdx + 5);
    }
  }

  // Empty features here means the map is below FOOTPRINT_MIN_ZOOM (see
  // Map.tsx emitVisibleFeatures) OR the viewport contains no imagery.
  // We can't distinguish those two cases from features alone, but the
  // "zoom in" copy is the right prompt either way: at low zoom the
  // PMTiles source only carries a drop-densest'd subset (see the block
  // comment on FOOTPRINT_MIN_ZOOM in utils/constants.ts), and at high
  // zoom over an empty region the fix is also to zoom / pan.
  const headerText =
    features.length === 0
      ? "Zoom in to see images"
      : `${features.length} image${features.length !== 1 ? "s" : ""} in view`;

  const visible = features.slice(0, visibleCount);

  return (
    <div
      ref={listRef}
      className="flex-1 overflow-y-auto bg-gray-50 relative scroll-smooth font-sans"
    >
      <div className="p-5 border-b border-gray-200 bg-white sticky top-0 z-20 shadow-sm">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-500" />
          {headerText}
        </p>
      </div>

      <div className="p-4 space-y-4">
        {features.length > 0 ? (
          <>
            {visible.map((feature) => (
              <ImageCard
                key={feature.properties.id}
                feature={feature}
                onSelect={onSelect}
                isSelected={
                  !!selectedFeature &&
                  selectedFeature.properties.id === feature.properties.id
                }
              />
            ))}
            {visibleCount < features.length && (
              <wa-button
                appearance="outlined"
                size="small"
                class="w-full"
                onClick={() =>
                  setVisibleCount((prev) =>
                    Math.min(prev + SIDEBAR_PAGE_SIZE, features.length),
                  )
                }
              >
                Load More ({features.length - visibleCount} remaining)
              </wa-button>
            )}
          </>
        ) : (
          <p className="text-center text-gray-500 py-8 px-6">
            Zoom in to see imagery footprints. The grid squares on the map show
            where imagery is available; individual images appear once you zoom
            in far enough.
          </p>
        )}
      </div>
    </div>
  );
}
