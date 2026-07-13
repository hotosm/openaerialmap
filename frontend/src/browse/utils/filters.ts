import type { DatePreset, Filters, RawTileProperties } from "./types";

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

export function matchesFilters(p: RawTileProperties, f: Filters): boolean {
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
      conditions.push([
        "==",
        ["downcase", ["get", "platform"]],
        f.platform.toLowerCase(),
      ]);
    }
  }
  const range = datePresetRange(f.date);
  if (range) {
    conditions.push([">=", ["get", "acquisition_end"], range.start]);
    conditions.push([
      "<=",
      ["get", "acquisition_end"],
      range.end + "T23:59:59.999Z",
    ]);
  }
  if (f.license) {
    const lic = f.license.toLowerCase();
    if (lic.includes("nc")) {
      conditions.push([
        "in",
        "nc",
        ["downcase", ["to-string", ["get", "license"]]],
      ]);
    } else if (lic.includes("sa")) {
      conditions.push([
        "in",
        "sa",
        ["downcase", ["to-string", ["get", "license"]]],
      ]);
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
// upper bound on the true intersection: cells where any dimension has
// 0 correctly disappear, and cells where all dimensions have >0 show
// a count no larger than the truth. Documented as "up to N" in the UI.

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

// MapLibre expression that evaluates to the count each cell should
// display given the active filters. Callers wire this into
// `fill-color`, `text-field`, and layer `filter` on the density
// layers - see Map.tsx section 4.
export function densityCountExpr(f: Filters): unknown {
  const keys: string[] = [];
  if (f.platform) {
    const k = platformBucketKey(f.platform);
    if (k) keys.push(k);
  }
  if (f.license) {
    const k = licenseBucketKey(f.license);
    if (k) keys.push(k);
  }
  if (f.date) {
    const k = dateBucketKey(f.date);
    if (k) keys.push(k);
  }
  if (keys.length === 0) return ["get", "count"];
  if (keys.length === 1) return ["coalesce", ["get", keys[0]], 0];
  return ["min", ...keys.map((k) => ["coalesce", ["get", k], 0])];
}
