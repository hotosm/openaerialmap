import { useEffect, useRef, useState } from "react";

import { fetchPage, searchByOwner, type PageRequest } from "./utils/stac";
import type { RawFeature } from "./utils/types";

interface Loaded {
  ownerId: string;
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

const message = (err: unknown) => (err instanceof Error ? err.message : "Request failed.");

// Items the account owns, from the STAC API. Pass null to load nothing, e.g.
// while signed out or browsing all imagery.
export function useMyImagery(ownerId: string | null): MyImagery {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const moreRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!ownerId) return;
    const controller = new AbortController();
    searchByOwner(ownerId, controller.signal).then(
      (page) =>
        setLoaded({
          ownerId,
          attempt,
          features: page.features,
          next: page.next,
          error: null,
          moreError: null,
        }),
      (err: unknown) => {
        if (controller.signal.aborted) return;
        setLoaded({
          ownerId,
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
  }, [ownerId, attempt]);

  // A result for another account, or an earlier attempt, is stale.
  const current =
    ownerId && loaded && loaded.ownerId === ownerId && loaded.attempt === attempt ? loaded : null;

  const loadMore = () => {
    if (!current?.next || moreRequest.current) return;
    const { ownerId: owner, attempt: at, next } = current;
    const controller = new AbortController();
    moreRequest.current = controller;
    setLoadingMore(true);
    const update = (patch: (prev: Loaded) => Loaded) =>
      setLoaded((prev) =>
        prev && prev.ownerId === owner && prev.attempt === at ? patch(prev) : prev,
      );
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
    loading: !!ownerId && !current,
    error: current?.error ?? null,
    hasMore: !!current?.next,
    loadingMore,
    moreError: current?.moreError ?? null,
    loadMore,
    retry: () => setAttempt((a) => a + 1),
  };
}
