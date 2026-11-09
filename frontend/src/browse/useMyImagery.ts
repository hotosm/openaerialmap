import { useEffect, useRef, useState } from "react";

import { fetchPage, searchByOwners, type PageRequest } from "./utils/stac";
import type { RawFeature } from "./utils/types";

interface Loaded {
  owners: string;
  attempt: number;
  features: RawFeature[];
  next: PageRequest | null;
  error: string | null;
  moreError: string | null;
}

export interface MyImagery {
  features: RawFeature[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadingMore: boolean;
  moreError: string | null;
  loadMore: () => void;
  retry: () => void;
}

// Stable, so memoised consumers do not recompute on every render.
const NONE: RawFeature[] = [];

function message(err: unknown): string {
  return err instanceof Error ? err.message : "Request failed.";
}

// Items any of `ownerIds` own, from the STAC API. Pass null to load nothing,
// e.g. while signed out or browsing all imagery.
export function useMyImagery(ownerIds: string[] | null): MyImagery {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const moreRequest = useRef<AbortController | null>(null);
  // A string, so a new array with the same ids does not search again.
  const owners = ownerIds?.length ? ownerIds.join(",") : null;

  useEffect(() => {
    if (!owners) return;
    const controller = new AbortController();
    searchByOwners(owners.split(","), controller.signal).then(
      (page) =>
        setLoaded({
          owners,
          attempt,
          features: page.features,
          next: page.next,
          error: null,
          moreError: null,
        }),
      (err: unknown) => {
        if (controller.signal.aborted) return;
        setLoaded({
          owners,
          attempt,
          features: [],
          next: null,
          error: message(err),
          moreError: null,
        });
      },
    );
    return () => {
      controller.abort();
      moreRequest.current?.abort();
    };
  }, [owners, attempt]);

  // A result for other owners, or an earlier attempt, is stale.
  const current =
    owners && loaded && loaded.owners === owners && loaded.attempt === attempt ? loaded : null;

  const loadMore = () => {
    if (!current?.next || moreRequest.current) return;
    const { owners: of, attempt: at, next } = current;
    const controller = new AbortController();
    moreRequest.current = controller;
    setLoadingMore(true);
    const update = (patch: (prev: Loaded) => Loaded) =>
      setLoaded((prev) => (prev && prev.owners === of && prev.attempt === at ? patch(prev) : prev));
    fetchPage(next, controller.signal)
      .then(
        (page) =>
          update((prev) => {
            // An upload landing between pages can shift one Item into the next page.
            const seen = new Set(prev.features.map((f) => f.properties._id));
            const added = page.features.filter((f) => !seen.has(f.properties._id));
            return {
              ...prev,
              features: [...prev.features, ...added],
              next: page.next,
              moreError: null,
            };
          }),
        (err: unknown) => {
          if (controller.signal.aborted) return;
          update((prev) => ({ ...prev, moreError: message(err) }));
        },
      )
      .finally(() => {
        if (moreRequest.current === controller) moreRequest.current = null;
        setLoadingMore(false);
      });
  };

  return {
    features: current?.features ?? NONE,
    loading: !!owners && !current,
    error: current?.error ?? null,
    hasMore: !!current?.next,
    loadingMore,
    moreError: current?.moreError ?? null,
    loadMore,
    retry: () => setAttempt((a) => a + 1),
  };
}
