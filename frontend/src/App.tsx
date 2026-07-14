import { lazy, Suspense } from "react";
import Landing from "./Landing";

// Browse pulls MapLibre + PMTiles + Turf into a ~1 MB chunk. Split it
// out so the landing page ships without the map runtime.
const Browse = lazy(() => import("./browse/Browse"));

export default function App() {
  const path = window.location.pathname.replace(/\/+$/, "");
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
              fontFamily: "var(--hot-font-sans-variant), system-ui, sans-serif",
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
  return <Landing />;
}
