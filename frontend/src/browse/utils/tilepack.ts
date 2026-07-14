import { PACKAGER_URL } from "./constants";

// Shape returned by the packager API for POST /tilepacks/{id}.
// Mirrors the Go handler's response struct in
// backend/tilepack-api/internal/handler/handler.go.
export type TilepackFormat = "pmtiles" | "mbtiles";

export type TilepackStatus =
  | "started"
  | "in_progress"
  | "ready"
  | "rate_limited"
  | "error";

export interface TilepackResponse {
  status: TilepackStatus;
  url?: string;
  retry_after?: number;
  message?: string;
  // HTTP status code, useful for distinguishing 200 (ready) from 202
  // (still running) since both are non-error outcomes.
  httpStatus: number;
}

// Fire (or re-check) the canonical tilepack job for an item. The
// packager endpoint is idempotent: repeat POSTs return 200 with a URL
// once the archive is ready, 202 while the worker is still running.
// We deliberately do not poll here - callers re-invoke this on user
// action (button re-click, page refresh) to check status.
export async function triggerTilepack(
  itemId: string,
  format: TilepackFormat,
): Promise<TilepackResponse> {
  const url = `${PACKAGER_URL}/tilepacks/${itemId}?format=${format}`;
  const res = await fetch(url, { method: "POST" });
  const body = (await res
    .json()
    .catch(() => ({}))) as Partial<TilepackResponse>;
  return {
    status: (body.status as TilepackStatus) ?? "error",
    url: body.url,
    retry_after: body.retry_after,
    message: body.message,
    httpStatus: res.status,
  };
}
