import { useEffect, useRef } from "react";

// Canonical top nav for every page in the OAM UI. Landing and Browse
// both previously carried their own copy of this - which drifted -
// so anything that should live in the site chrome (nav tabs, upload
// entry point, brand) belongs here now.

// Landing point for the (upcoming) imagery uploader. Currently the
// legacy site; swap this in one place when the new uploader ships.
const SHARE_IMAGERY_URL = "https://map.openaerialmap.org";

interface HeaderTab {
  label: string;
  href?: string;
  clickEvent?: () => void;
}

const HEADER_TABS: HeaderTab[] = [
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
    label: "API",
    clickEvent: () => {
      window.open("https://api.imagery.hotosm.org", "_blank");
    },
  },
  {
    label: "Docs",
    clickEvent: () => {
      window.open("https://docs.imagery.hotosm.org/", "_blank");
    },
  },
  {
    label: "Report a bug",
    clickEvent: () => {
      window.open("https://roadmap.hotosm.org/#tech-request", "_blank");
    },
  },
];

// hot-header is a web component: props like `title` and `logo` are
// attributes (declared in global.d.ts), but `tabs` is a JS property so
// it has to be assigned via ref after mount.
type HotHeaderElement = HTMLElement & { tabs: HeaderTab[] };

export default function SiteHeader() {
  const headerRef = useRef<HotHeaderElement>(null);

  useEffect(() => {
    if (headerRef.current) headerRef.current.tabs = HEADER_TABS;
  }, []);

  return (
    <hot-header
      ref={headerRef}
      title="OpenAerialMap"
      logo="/openaerialmap.svg"
      size="small"
      tabs-center-align
    >
      <wa-button
        slot="auth"
        variant="brand"
        class="share-imagery-btn"
        onClick={() => {
          window.open(SHARE_IMAGERY_URL, "_blank");
        }}
      >
        Share Imagery
      </wa-button>
    </hot-header>
  );
}
