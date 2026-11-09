import { UPLOADER_TIMEOUT_MS, UPLOADER_URL } from "./constants";

// Fields the owner may correct; one left out stays as it is.
export interface MetadataChanges {
  title?: string;
  provider?: string;
  contact?: string;
  platform?: string;
  sensor?: string;
  license?: string;
}

// The uploader is the only writer of published Items (ADR 0011). It checks
// the session cookie and the ownership itself before touching pgstac.
// Resolves to what the uploader wrote.
async function patchImagery(itemId: string, body: object): Promise<{ owner_id?: string }> {
  const res = await fetch(`${UPLOADER_URL}/api/v1/imagery/${encodeURIComponent(itemId)}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(UPLOADER_TIMEOUT_MS),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(err.detail || `The uploader answered ${res.status}.`);
  }
  return (await res.json().catch(() => ({}))) as { owner_id?: string };
}

// Resolves to the owner it wrote.
export async function transferImagery(itemId: string, ownerId: string): Promise<string> {
  const written = await patchImagery(itemId, { owner: ownerId });
  return written.owner_id || ownerId;
}

export async function updateImagery(itemId: string, changes: MetadataChanges): Promise<void> {
  await patchImagery(itemId, changes);
}
