import { COLLECTION_ID, COLLECTION_COUNT_PREFIX } from "./constants";
import type { DatePreset, Filters, RawTileProperties, ResolutionPreset } from "./types";

// Both client-side (matchesFilters) and MapLibre-side (buildFilter)
// implementations must agree on boundary conditions so the sidebar and
// footprint layer always show the same set. Any change here needs to
// land in both functions.

interface DateRange {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD (inclusive)
}

// Resolve a preset into a concrete date range. Anchored to `new Date()`
// each call so "past week" always means the last 7 days from the moment
// the user reads the map (not from tab open). Note this drifts up to
// ~24h out of sync with the pre-baked density bucket in the pmtiles
// archive, which is anchored to the last generator run - acceptable
// given daily regeneration.
export function datePresetRange(preset: DatePreset): DateRange | null {
  if (!preset) return null;
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const start = new Date(now);
  if (preset === "week") start.setDate(now.getDate() - 7);
  else if (preset === "month") start.setDate(now.getDate() - 30);
  else if (preset === "year") {
    start.setMonth(0);
    start.setDate(1);
  }
  return { start: start.toISOString().split("T")[0], end: today };
}

// Resolution buckets: <0.5m | [0.5, 2] | (2, 10] | >10m. Boundary
// picks match buildFilter's MapLibre expression exactly.
//
// Items with an unknown gsd are excluded when a resolution filter is
// active. Including them would defeat the filter's purpose - a user
// picking "< 0.5 m" wants imagery they know is sub-metre, not a mix
// with unknown-resolution items that could be 30 m satellite tiles -
// and it'd also make the pre-baked density counts disagree with the
// per-image sidebar (density can't bucket unknowns). If the volume of
// unknown-gsd imagery turns out to be significant, the fix belongs
// backend-side in the ingester (backfill from EXIF / provider
// metadata), not here.
function matchesResolution(gsd: number | undefined, preset: ResolutionPreset): boolean {
  if (!preset) return true;
  if (gsd == null) return false;
  if (preset === "lt05") return gsd < 0.5;
  if (preset === "05to2") return gsd >= 0.5 && gsd <= 2;
  if (preset === "2to10") return gsd > 2 && gsd <= 10;
  if (preset === "gt10") return gsd > 10;
  return true;
}

export function matchesFilters(p: RawTileProperties, f: Filters): boolean {
  // Legacy footprints predate the `collection` property; they can only be OAM.
  if (f.collection && (p.collection || COLLECTION_ID) !== f.collection) return false;
  if (f.platform) {
    const plat = (p.platform || "").toLowerCase();
    if (f.platform === "uav") {
      if (plat !== "uav" && plat !== "drone") return false;
    } else if (f.platform === "aircraft") {
      if (plat === "satellite" || plat === "uav" || plat === "drone") {
        return false;
      }
    } else if (plat !== f.platform.toLowerCase()) {
      return false;
    }
  }
  const range = datePresetRange(f.date);
  if (range && p.acquisition_end) {
    if (p.acquisition_end < range.start) return false;
    if (p.acquisition_end > range.end + "T23:59:59.999Z") return false;
  }
  if (!matchesResolution(p.gsd, f.resolution)) return false;
  if (f.license) {
    const target = f.license.replace(/[\s-]/g, "").toLowerCase();
    const actual = (p.license || "").replace(/[\s-]/g, "").toLowerCase();
    if (!actual.includes(target)) return false;
  }
  return true;
}

// Returns null when no filters are active so callers can pass null
// straight to `map.setFilter(...)`, which resets the layer filter.
export function buildFilter(f: Filters): unknown[] | null {
  const conditions: unknown[] = ["all"];
  if (f.collection) {
    conditions.push(["==", ["coalesce", ["get", "collection"], COLLECTION_ID], f.collection]);
  }
  if (f.platform) {
    if (f.platform === "uav") {
      conditions.push([
        "any",
        ["==", ["downcase", ["get", "platform"]], "uav"],
        ["==", ["downcase", ["get", "platform"]], "drone"],
      ]);
    } else if (f.platform === "aircraft") {
      conditions.push([
        "all",
        ["!=", ["downcase", ["get", "platform"]], "satellite"],
        ["!=", ["downcase", ["get", "platform"]], "uav"],
        ["!=", ["downcase", ["get", "platform"]], "drone"],
      ]);
    } else {
      conditions.push(["==", ["downcase", ["get", "platform"]], f.platform.toLowerCase()]);
    }
  }
  const range = datePresetRange(f.date);
  if (range) {
    conditions.push([">=", ["get", "acquisition_end"], range.start]);
    conditions.push(["<=", ["get", "acquisition_end"], range.end + "T23:59:59.999Z"]);
  }
  if (f.resolution) {
    // Boundaries mirror matchesResolution above. Kept identical so
    // filter-clipped map features and sidebar list can't disagree.
    //
    // Unknown-gsd items are excluded when a resolution filter is
    // active. MapLibre's numeric operators already return false for
    // missing properties, so a bare `< / >= / <= / >` on `gsd` gives
    // us the exclusion without an explicit `has` guard. See the
    // matchesResolution comment for why unknowns are dropped here.
    if (f.resolution === "lt05") {
      conditions.push(["<", ["get", "gsd"], 0.5]);
    } else if (f.resolution === "05to2") {
      conditions.push([">=", ["get", "gsd"], 0.5]);
      conditions.push(["<=", ["get", "gsd"], 2]);
    } else if (f.resolution === "2to10") {
      conditions.push([">", ["get", "gsd"], 2]);
      conditions.push(["<=", ["get", "gsd"], 10]);
    } else if (f.resolution === "gt10") {
      conditions.push([">", ["get", "gsd"], 10]);
    }
  }
  if (f.license) {
    const lic = f.license.toLowerCase();
    if (lic.includes("nc")) {
      conditions.push(["in", "nc", ["downcase", ["to-string", ["get", "license"]]]]);
    } else if (lic.includes("sa")) {
      conditions.push(["in", "sa", ["downcase", ["to-string", ["get", "license"]]]]);
    } else if (lic.includes("by")) {
      conditions.push([
        "all",
        ["in", "by", ["downcase", ["to-string", ["get", "license"]]]],
        ["!", ["in", "nc", ["downcase", ["to-string", ["get", "license"]]]]],
        ["!", ["in", "sa", ["downcase", ["to-string", ["get", "license"]]]]],
      ]);
    }
  }
  return conditions.length > 1 ? conditions : null;
}

// ---------------------------------------------------------------------
// Density (pre-baked count buckets)
// ---------------------------------------------------------------------
//
// The density PMTiles carries per-cell counts as `count` (total) plus
// optional breakdown keys emitted by the generator - see
// backend/global-mosaic/scripts/gen_coverage_vector.py::_image_buckets.
// Each active filter dimension maps to exactly one bucket key.
//
// For multi-filter selections we don't have a pre-baked intersection
// count, so we take the min across per-dimension buckets. That's an
// upper bound on the true intersection, not the intersection itself:
// cells where any dimension has 0 correctly disappear, but a cell can
// still report a count higher than the true overlap between
// dimensions, since each bucket is an independent per-dimension total.
// See isDensityCountApproximate below, which flags this case so
// callers can label the number as "up to N" instead of an exact count.

function platformBucketKey(platform: string): string | null {
  if (platform === "uav") return "count_uav";
  if (platform === "satellite") return "count_satellite";
  if (platform === "aircraft") return "count_aircraft";
  return null;
}

function licenseBucketKey(license: string): string | null {
  const norm = license.replace(/[\s-]/g, "").toLowerCase();
  if (norm.includes("nc")) return "count_lic_by_nc";
  if (norm.includes("sa")) return "count_lic_by_sa";
  if (norm.includes("by")) return "count_lic_by";
  return null;
}

function dateBucketKey(preset: DatePreset): string | null {
  if (preset === "week") return "count_last_7d";
  if (preset === "month") return "count_last_30d";
  if (preset === "year") return `count_year_${new Date().getFullYear()}`;
  return null;
}

function resolutionBucketKey(preset: ResolutionPreset): string | null {
  if (preset === "lt05") return "count_gsd_lt_05";
  if (preset === "05to2") return "count_gsd_05_2";
  if (preset === "2to10") return "count_gsd_2_10";
  if (preset === "gt10") return "count_gsd_gt_10";
  return null;
}

// Bucket keys for each filter dimension currently active. Shared by
// densityCountExpr (which reads the buckets) and
// isDensityCountApproximate (which flags when more than one bucket is
// combined, since a single bucket is always an exact per-dimension
// count).
function activeDensityBucketKeys(f: Filters): string[] {
  const keys: string[] = [];
  if (f.collection) {
    keys.push(`${COLLECTION_COUNT_PREFIX}${f.collection}`);
  }
  if (f.platform) {
    const k = platformBucketKey(f.platform);
    if (k) keys.push(k);
  }
  if (f.license) {
    const k = licenseBucketKey(f.license);
    if (k) keys.push(k);
  }
  if (f.resolution) {
    const k = resolutionBucketKey(f.resolution);
    if (k) keys.push(k);
  }
  if (f.date) {
    const k = dateBucketKey(f.date);
    if (k) keys.push(k);
  }
  return keys;
}

// True when the active filters combine two or more bucket dimensions,
// so densityCountExpr falls back to a min() upper bound instead of an
// exact pre-baked count. Callers use this to label the displayed
// number as approximate.
export function isDensityCountApproximate(f: Filters): boolean {
  return activeDensityBucketKeys(f).length > 1;
}

// MapLibre expression that evaluates to the count each cell should
// display given the active filters. Callers wire this into
// `fill-color`, `text-field`, and layer `filter` on the density
// layers - see Map.tsx section 4.
//
// Resolution is symmetric with the other buckets: images with an
// unknown gsd are excluded from a resolution-filtered view on both
// surfaces (see matchesResolution / buildFilter above), so the
// world-zoom count and the zoomed-in sidebar count agree.
export function densityCountExpr(f: Filters): unknown {
  const keys = activeDensityBucketKeys(f);
  if (keys.length === 0) return ["get", "count"];
  if (keys.length === 1) return ["coalesce", ["get", keys[0]], 0];
  return ["min", ...keys.map((k) => ["coalesce", ["get", k], 0])];
}
