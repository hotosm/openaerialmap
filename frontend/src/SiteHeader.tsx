import { useEffect, useRef } from "react";

import { ANNOUNCEMENT_URL, API_URL, UPLOADER_URL } from "./browse/utils/constants";

// Keep these tabs aligned with backend/uploader-api/app/templates/layout.html.

interface HeaderTab {
  label: string;
  href?: string;
  clickEvent?: () => void;
}

const HEADER_TABS: HeaderTab[] = [
  { label: "Home", href: "/", clickEvent: () => (window.location.href = "/") },
  {
    label: "Browse",
    href: "/browse",
    clickEvent: () => (window.location.href = "/browse"),
  },
  {
    label: "API",
    clickEvent: () => window.open(API_URL, "_blank"),
  },
  {
    label: "Docs",
    clickEvent: () => window.open("https://docs.imagery.hotosm.org/", "_blank"),
  },
  { label: "Upload", clickEvent: () => (window.location.href = UPLOADER_URL) },
  {
    label: "Report a bug",
    clickEvent: () => window.open("https://roadmap.hotosm.org/#tech-request", "_blank"),
  },
];

// hot-header is a web component: `title`/`logo` are attributes (see
// global.d.ts), but `tabs` is a JS property assigned via ref after mount.
type HotHeaderElement = HTMLElement & { tabs: HeaderTab[] };

export default function SiteHeader() {
  const headerRef = useRef<HotHeaderElement>(null);

  useEffect(() => {
    if (headerRef.current) headerRef.current.tabs = HEADER_TABS;
  }, []);

  return (
    <>
      {/* Renders nothing when there is no active announcement. */}
      <hot-announcement src={ANNOUNCEMENT_URL} storage-key="oam-announcement" />

      <hot-header
        ref={headerRef}
        title="OpenAerialMap"
        logo="/openaerialmap.svg"
        size="s"
        tabs-center-align
      >
        <div slot="auth" className="oam-header-controls">
          <wa-dropdown class="oam-locale">
            <wa-button slot="trigger" appearance="plain" size="s" with-caret>
              EN
            </wa-button>
            <div className="oam-locale-menu">
              <button type="button" className="oam-locale-option oam-locale-option--active">
                English
              </button>
            </div>
          </wa-dropdown>
          <hotosm-tool-menu></hotosm-tool-menu>
        </div>
      </hot-header>
    </>
  );
}
