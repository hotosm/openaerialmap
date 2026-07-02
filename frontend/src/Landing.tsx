import { useEffect, useRef, useState } from "react";
import "./Landing.css";

type HotHeaderElement = HTMLElement & {
  tabs: Array<{ label: string; href?: string; clickEvent?: () => void }>;
};

const HEADER_TABS = [
  {
    label: "Home",
    href: "/",
    clickEvent: () => {
      window.location.href = "/";
    },
  },
  {
    label: "Browse",
    href: "/browse",
    clickEvent: () => {
      window.location.href = "/browse";
    },
  },
  {
    label: "Upload",
    clickEvent: () => {
      window.open("https://map.openaerialmap.org", "_blank");
    },
  },
];

const COMPONENTS = [
  {
    title: "Interactive Browser",
    tag: "Explore",
    description:
      "The map-first UI for browsing OAM's STAC catalog. Search by area, date, and provider, then preview and download imagery.",
    href: "/browse",
    icon: "map",
    primary: true,
  },
  {
    title: "Experimental UI",
    tag: "Preview",
    description:
      "An alternative browsing experience being explored for OAM. Try it and share feedback.",
    href: "https://cgiovando.github.io/oam-vibe/?lat=20.0000&lon=0.0000&zoom=2.0",
    icon: "flask",
  },
  {
    title: "Global TMS",
    tag: "Basemap",
    description:
      "A single global tile service: a density heat-grid at low zooms and image footprints at mid zooms show where imagery is available, then real OAM imagery from zoom 16+. Drop into QGIS, Leaflet, or MapLibre.",
    href: "https://global.imagery.hotosm.org/",
    icon: "layer-group",
  },
  {
    title: "TiTiler API",
    tag: "Raster tiles",
    description:
      "Serve dynamic tiles, statistics, and previews from any COG in the catalog. For developers building custom tools.",
    href: "https://api.imagery.hotosm.org/raster/api.html",
    icon: "code",
  },
  {
    title: "STAC Catalog",
    tag: "API",
    description:
      "The STAC-compliant API that powers everything. Query items programmatically with any STAC client.",
    href: "https://api.imagery.hotosm.org/stac",
    icon: "database",
  },
  {
    title: "STAC Browser",
    tag: "Catalog",
    description:
      "Walk the raw STAC catalog: collections, items, assets. Useful for inspecting metadata and asset URLs directly.",
    href: "https://api.imagery.hotosm.org/browser/?.language=en",
    icon: "folder-tree",
  },
  {
    title: "PMTiles Packager",
    tag: "Offline",
    description:
      "Package OAM imagery into PMTiles or MBTiles archives for offline use in the field or in third-party tools.",
    href: "https://packager.imagery.hotosm.org/",
    icon: "box-archive",
  },
];

const CASE_STUDIES = [
  {
    title: "Disaster response mapping",
    body: "After earthquakes, floods, and hurricanes, responders use OAM to publish freshly captured drone and satellite imagery within hours - enabling volunteers to trace damaged infrastructure into OpenStreetMap.",
  },
  {
    title: "Community-led drone mapping",
    body: "Local mapping organizations share high-resolution UAV surveys of informal settlements, agricultural plots, and community assets so planners and residents can build on the same base data.",
  },
  {
    title: "Basemap for humanitarian tools",
    body: "OAM's global TMS and STAC API feed basemaps into HOT Tasking Manager, Field-TM, and other humanitarian tools - replacing paid commercial imagery with open, community-contributed sources.",
  },
];

const RESOURCES = [
  {
    type: "Blog post",
    title: "OpenAerialMap v2",
    description:
      "Why we rebuilt OAM around STAC - and what it means for humanitarian mapping teams.",
    href: "https://www.hotosm.org/en/news/openaerialmap-v2-faster-better-imagery-access-for-humanitarian-mapping/",
  },
  {
    type: "Documentation",
    title: "Technical docs",
    description:
      "Architecture, deployment, and integration guides for the OAM v2 stack.",
    href: "https://docs.imagery.hotosm.org/",
  },
  {
    type: "Source",
    title: "GitHub repository",
    description:
      "OAM is open source under the HOTOSM organization. Contributions welcome.",
    href: "https://github.com/hotosm/openaerialmap",
  },
];

// Snapshot values used for first paint. Refined by a single fetch of
// stats.json (published daily by the global-mosaic cron alongside the
// coverage PMTiles). See backend/global-mosaic/scripts/gen_coverage_vector.py.
const STATIC_STATS = {
  items: 21000,
  areaKm2: 800000,
  collections: 3,
};

const STATS_URL = "https://s3.amazonaws.com/oin-hotosm-temp/stats.json";

type LiveStats = {
  items: number;
  areaKm2: number;
  collections: number;
};

async function fetchLiveStats(): Promise<LiveStats | null> {
  const res = await fetch(STATS_URL, { cache: "force-cache" });
  if (!res.ok) return null;
  const data = await res.json();
  const items = data?.items;
  const areaKm2 = data?.area_km2;
  const collections = data?.catalog?.collections;
  if (
    typeof items !== "number" ||
    typeof areaKm2 !== "number" ||
    typeof collections !== "number"
  ) {
    return null;
  }
  return { items, areaKm2, collections };
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

function formatAreaKm2(km2: number): string {
  if (km2 >= 1_000_000) {
    return `${(km2 / 1_000_000).toFixed(1)}M`;
  }
  if (km2 >= 10_000) {
    return `${Math.round(km2 / 1_000)}k`;
  }
  return formatNumber(Math.round(km2));
}

export default function Landing() {
  const headerRef = useRef<HotHeaderElement>(null);
  const [items, setItems] = useState<number>(STATIC_STATS.items);
  const [areaKm2, setAreaKm2] = useState<number>(STATIC_STATS.areaKm2);
  const [collections, setCollections] = useState<number>(
    STATIC_STATS.collections,
  );

  useEffect(() => {
    if (headerRef.current) headerRef.current.tabs = HEADER_TABS;
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchLiveStats()
      .then((s) => {
        if (cancelled || !s) return;
        setItems(s.items);
        setAreaKm2(s.areaKm2);
        setCollections(s.collections);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="landing-root">
      <hot-header
        ref={headerRef}
        title="OpenAerialMap"
        logo="/favicon.ico"
        size="small"
        tabs-center-align
      />

      <main className="landing-page">
        <section className="landing-hero">
          <div className="landing-shell landing-hero-content">
            <p className="landing-eyebrow">
              The open collection of aerial imagery
            </p>
            <h1 className="landing-title">OpenAerialMap</h1>
            <p className="landing-subtitle">
              A catalog of openly licensed satellite and drone imagery, plus the
              tools to search, tile, and package it - built for humanitarian
              responders, community mappers, and researchers.
            </p>
            <div className="landing-hero-actions">
              <wa-button
                variant="brand"
                size="large"
                onClick={() => {
                  window.location.href = "/browse";
                }}
              >
                Browse imagery
              </wa-button>
              <wa-button
                appearance="outlined"
                size="large"
                class="landing-hero-upload"
                onClick={() => {
                  window.open("https://map.openaerialmap.org", "_blank");
                }}
              >
                Upload imagery
              </wa-button>
            </div>
            <p className="landing-hero-note">
              Uploading currently happens on the legacy site - sign in at the
              top right of{" "}
              <a
                href="https://map.openaerialmap.org"
                target="_blank"
                rel="noopener noreferrer"
              >
                map.openaerialmap.org
              </a>{" "}
              and use the Upload button. A new uploader is coming in the next
              few months.
            </p>
          </div>
        </section>

        <section
          className="landing-shell landing-metrics-shell"
          aria-live="polite"
        >
          <div className="landing-metrics-grid">
            <wa-card class="landing-metric-card">
              <div className="landing-metric-inner">
                <p className="landing-metric-value">{formatNumber(items)}</p>
                <p className="landing-metric-label">OAM images</p>
              </div>
            </wa-card>
            <wa-card class="landing-metric-card">
              <div className="landing-metric-inner">
                <p className="landing-metric-value">{formatAreaKm2(areaKm2)}</p>
                <p className="landing-metric-label">km² of imagery</p>
              </div>
            </wa-card>
            <wa-card class="landing-metric-card">
              <div className="landing-metric-inner">
                <p className="landing-metric-value">{collections}</p>
                <p className="landing-metric-label">Imagery collections</p>
              </div>
            </wa-card>
            <wa-card class="landing-metric-card">
              <div className="landing-metric-inner">
                <p className="landing-metric-value">CC-BY</p>
                <p className="landing-metric-label">Openly licensed</p>
              </div>
            </wa-card>
          </div>
        </section>

        <section className="landing-shell landing-about">
          <div>
            <h2 className="landing-section-title">What is OpenAerialMap?</h2>
            <p>
              OpenAerialMap (OAM) is a set of tools for searching, sharing, and
              using openly licensed satellite and unmanned aerial vehicle (UAV)
              imagery. Anyone can contribute imagery, and anyone can use it -
              for disaster response, community mapping, research, or teaching.
            </p>
            <p>
              OAM v2 rebuilt the platform on the{" "}
              <a
                href="https://stacspec.org/"
                target="_blank"
                rel="noopener noreferrer"
              >
                SpatioTemporal Asset Catalog (STAC)
              </a>{" "}
              standard. That means every item has consistent metadata, works
              with any STAC-aware client, and can be tiled on the fly instead of
              pre-processed. Read more in the{" "}
              <a
                href="https://www.hotosm.org/en/news/openaerialmap-v2-faster-better-imagery-access-for-humanitarian-mapping/"
                target="_blank"
                rel="noopener noreferrer"
              >
                v2 announcement
              </a>
              .
            </p>
          </div>
          <aside className="landing-about-highlights">
            <div className="landing-highlight">
              <h3>STAC-native</h3>
              <p>
                A standards-based catalog that plays nicely with QGIS,
                stackstac, pystac, and any tool that speaks STAC.
              </p>
            </div>
            <div className="landing-highlight">
              <h3>Dynamic tiling</h3>
              <p>
                COGs served through TiTiler. Request custom rescales, band
                combinations, and formats without pre-baking tiles.
              </p>
            </div>
            <div className="landing-highlight">
              <h3>Open & community-driven</h3>
              <p>
                Imagery is contributed by drone pilots, NGOs, and satellite
                providers. All open-source, all CC-BY compatible.
              </p>
            </div>
          </aside>
        </section>

        <section className="landing-shell landing-components">
          <h2 className="landing-section-title">Explore the platform</h2>
          <p className="landing-section-lead">
            OAM is more than a single site - it's a stack of composable
            services. Pick the entry point that matches your workflow.
          </p>
          <div className="landing-components-grid">
            {COMPONENTS.map((c) => (
              <a
                key={c.title}
                className={`landing-component-card${c.primary ? " landing-component-card--primary" : ""}`}
                href={c.href}
                target={c.href.startsWith("/") ? "_self" : "_blank"}
                rel={c.href.startsWith("/") ? undefined : "noopener noreferrer"}
              >
                <div className="landing-component-header">
                  <wa-icon
                    name={c.icon}
                    variant="regular"
                    class="landing-component-icon"
                  />
                  <span className="landing-component-tag">{c.tag}</span>
                </div>
                <h3 className="landing-component-title">{c.title}</h3>
                <p className="landing-component-desc">{c.description}</p>
                <span className="landing-component-link">
                  Open
                  <wa-icon name="arrow-right" variant="regular" />
                </span>
              </a>
            ))}
          </div>
        </section>

        <section className="landing-shell landing-cases">
          <h2 className="landing-section-title">How OAM is used</h2>
          <div className="landing-cases-grid">
            {CASE_STUDIES.map((cs) => (
              <article key={cs.title} className="landing-case-card">
                <h3>{cs.title}</h3>
                <p>{cs.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-shell landing-resources">
          <h2 className="landing-section-title">Learn more</h2>
          <div className="landing-resources-grid">
            {RESOURCES.map((r) => (
              <a
                key={r.title}
                className="landing-resource-card"
                href={r.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                <p className="landing-resource-type">{r.type}</p>
                <p className="landing-resource-title">{r.title}</p>
                <p className="landing-resource-desc">{r.description}</p>
              </a>
            ))}
          </div>
        </section>

        <footer className="landing-footer">
          <div className="landing-shell">
            <div className="landing-footer-bottom">
              <div className="landing-footer-help">
                Need help or have a request?{" "}
                <a
                  href="https://roadmap.hotosm.org/#tech-request"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Submit a tech request
                </a>
              </div>
              <div className="landing-footer-social">
                <a
                  href="https://github.com/hotosm/openaerialmap"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  GitHub
                </a>
                <a
                  href="https://www.hotosm.org"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  HOTOSM
                </a>
                <a
                  href="https://bsky.app/profile/hotosm.org"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Bluesky
                </a>
                <a
                  href="https://www.linkedin.com/company/humanitarian-openstreetmap-team"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  LinkedIn
                </a>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
