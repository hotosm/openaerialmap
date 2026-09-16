import { lazy, Suspense } from "react";
import Landing from "./Landing";
import Contribute from "./Contribute";

// Browse pulls MapLibre + PMTiles + Turf into a ~1 MB chunk. Split it
// out so the landing page ships without the map runtime.
const Browse = lazy(() => import("./browse/Browse"));

export default function App() {
  // Strip Vite's base so routing works when the app is served from a
  // subdirectory (a preview build on GitHub Pages) as well as from the root.
  // BASE_URL is "/" in production, where this is a no-op.
  const base = import.meta.env.BASE_URL.replace(/\/+$/, "");
  const path = window.location.pathname
    .replace(new RegExp(`^${base}`), "")
    .replace(/\/+$/, "");
  if (path === "/browse" || path.startsWith("/browse/")) {
    return (
      <Suspense
        fallback={
          <div
            style={{
              height: "100dvh",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#64748b",
            }}
          >
            Loading map…
          </div>
        }
      >
        <Browse />
      </Suspense>
    );
  }
  if (path === "/contribute") {
    return <Contribute />;
  }
  return <Landing />;
}
