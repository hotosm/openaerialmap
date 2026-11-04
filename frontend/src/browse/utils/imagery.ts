import { UPLOADER_TIMEOUT_MS, UPLOADER_URL } from "./constants";

// The uploader is the only writer of published Items (ADR 0011). It checks
// the session cookie and the ownership itself before touching pgstac.
export async function transferImagery(itemId: string, ownerId: string): Promise<void> {
  const res = await fetch(`${UPLOADER_URL}/api/v1/imagery/${encodeURIComponent(itemId)}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ owner: ownerId }),
    signal: AbortSignal.timeout(UPLOADER_TIMEOUT_MS),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(err.detail || `The uploader answered ${res.status}.`);
  }
}
