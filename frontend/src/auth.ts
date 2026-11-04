import { useSyncExternalStore } from "react";

import { getOptionalRuntimeConfig } from "./runtimeConfig";

// HOT Login (Hanko). Unset disables sign-in, as the uploader does when its
// auth is disabled, so a local stack without Hanko renders as before.
export const HANKO_URL = getOptionalRuntimeConfig("VITE_HANKO_URL");

// What hotosm-auth sends in `hanko-login`. `id` is the Hanko user id; the
// uploader stores it as `hotosm|<id>`.
export interface AuthUser {
  id: string;
  email: string | null;
  username: string | null;
  emailVerified: boolean;
  avatarUrl?: string;
}

// hotosm-auth reads this key to skip its spinner on load, but leaves writing
// it to the host app. It is a UI hint only: the uploader validates the JWT for
// anything that needs authorisation.
const CACHE_KEY = "hotosm-auth-user";

function readCache(): AuthUser | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    return cached ? (JSON.parse(cached) as AuthUser) : null;
  } catch {
    return null;
  }
}

let currentUser: AuthUser | null = HANKO_URL ? readCache() : null;
const listeners = new Set<() => void>();

function setUser(user: AuthUser | null) {
  currentUser = user;
  try {
    if (user) localStorage.setItem(CACHE_KEY, JSON.stringify(user));
    else localStorage.removeItem(CACHE_KEY);
  } catch {
    // Storage can be blocked; the session itself lives in the hanko cookie.
  }
  listeners.forEach((notify) => notify());
}

// Both events bubble out of hotosm-auth (composed), so listening on the
// document works wherever SiteHeader renders it.
if (HANKO_URL && typeof document !== "undefined") {
  document.addEventListener("hanko-login", (e) => {
    setUser((e as CustomEvent<{ user: AuthUser | null }>).detail?.user ?? null);
  });
  document.addEventListener("logout", () => setUser(null));
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

// The signed-in HOT Login user, or null when signed out or auth is disabled.
export function useAuthUser(): AuthUser | null {
  return useSyncExternalStore(subscribe, () => currentUser);
}
