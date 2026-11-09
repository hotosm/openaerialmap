import { useEffect, useState } from "react";

import { HANKO_URL, type AuthUser } from "../auth";

// An `oam:owner_id` whose imagery the signed-in user can see: their own
// `hotosm|<sub>` and `hotosm-org|<id>` for each organisation they belong to
// (ADR 0011). Any member sees an organisation's imagery, as in Portal.
export interface Owner {
  id: string;
  name: string;
  // Whether the user may change imagery with this owner: their own, or an
  // organisation they manage. Members only see.
  canEdit: boolean;
}

export interface Owners {
  // Null while loading, when signed out, or when Login could not be reached.
  owners: Owner[] | null;
  // The same owners' ids, stable across renders for effect dependencies.
  ownerIds: string[] | null;
  loading: boolean;
  error: string | null;
  // The user's own imagery still lists when only the organisations fail.
  orgsError: string | null;
  retry: () => void;
}

interface Loaded {
  key: string;
  owners: Owner[] | null;
  ownerIds: string[] | null;
  error: string | null;
  orgsError: string | null;
}

interface Group {
  id: string;
  name: string;
  type: string;
  status: string;
  role: string;
}

// Login roles that may change an organisation's imagery, as in Portal.
const EDITOR_ROLES = ["owner", "manager"];

// Login answers from cache in well under a second; past this the list is
// better off showing an error than a spinner.
const LOGIN_TIMEOUT_MS = 10_000;

function message(err: unknown): string {
  if (err instanceof DOMException && err.name === "TimeoutError") {
    return "HOT Login did not answer in time.";
  }
  if (err instanceof TypeError) return "HOT Login could not be reached.";
  return err instanceof Error ? err.message : "Request failed.";
}

async function fromLogin<T>(path: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(`${HANKO_URL}${path}`, { credentials: "include", signal });
  if (res.status === 401) throw new Error("Your session has expired. Sign in again.");
  if (!res.ok) throw new Error(`HOT Login answered ${res.status}.`);
  return (await res.json()) as T;
}

// Organisations only, and only approved ones: the uploader accepts the same.
function organisations(groups: Group[]): Owner[] {
  return groups
    .filter((g) => g.type === "organization" && g.status === "approved")
    .map((g) => ({
      id: `hotosm-org|${g.id}`,
      name: g.name,
      canEdit: EDITOR_ROLES.includes(g.role),
    }));
}

// The owners to list in My imagery. The user's id comes from Login's `/me`,
// which answers with the JWT `sub` the uploader stores; the `hanko-login`
// event can carry the Hanko user id instead.
export function useOwners(user: AuthUser | null): Owners {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const key = user && HANKO_URL ? `${user.id}#${attempt}` : null;

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(LOGIN_TIMEOUT_MS)]);
    // Organisations are optional: without them the user's own imagery still lists.
    const orgs = fromLogin<{ groups?: Group[] }>("/api/groups?type=organization", signal).then(
      (res) => ({ list: organisations(res.groups ?? []), error: null }),
      (err: unknown) => ({ list: [] as Owner[], error: message(err) }),
    );
    Promise.all([fromLogin<{ user_id: string }>("/me", signal), orgs]).then(
      ([me, { list, error }]) => {
        const owners = [{ id: `hotosm|${me.user_id}`, name: "You", canEdit: true }, ...list];
        setLoaded({
          key,
          owners,
          ownerIds: owners.map((o) => o.id),
          error: null,
          orgsError: error,
        });
      },
      (err: unknown) => {
        // Unmounted or signed out meanwhile; a timeout still reports.
        if (controller.signal.aborted) return;
        setLoaded({ key, owners: null, ownerIds: null, error: message(err), orgsError: null });
      },
    );
    return () => controller.abort();
  }, [key]);

  // A result for another account, or an earlier attempt, is stale.
  const current = key && loaded?.key === key ? loaded : null;
  return {
    owners: current?.owners ?? null,
    ownerIds: current?.ownerIds ?? null,
    loading: !!key && !current,
    error: current?.error ?? null,
    orgsError: current?.orgsError ?? null,
    retry: () => setAttempt((a) => a + 1),
  };
}
