import SiteHeader from "./SiteHeader";
import { UPLOADER_URL } from "./browse/utils/constants";
import { getRuntimeConfig } from "./runtimeConfig";
import { CommonsFigure, RoutesFigure, MappingFigure } from "./contribute/figures";
import "./Contribute.css";

// The issue form lives in this repo, so the default is right in production.
// Configurable because a preview build serves the page before the template
// exists at the default target, and a dead "Register a catalog" button is the
// one link on this page that must never be dead.
const INTAKE_URL = getRuntimeConfig(
  "VITE_INTAKE_URL",
  "https://github.com/hotosm/openaerialmap/issues/new?template=imagery-provider-intake.yml",
);
const CONTACT = "info@openaerialmap.org";
const DOCS_NEW_PROVIDER = "https://docs.imagery.hotosm.org/dev/ingest/new-provider/";
const DOCS_SCHEMA = "https://docs.imagery.hotosm.org/dev/ingest/schema/";

const COG_SPEC = "https://cogeo.org/";
const LICENSE_LINKS: Record<string, string> = {
  "CC-BY 4.0": "https://creativecommons.org/licenses/by/4.0/",
  "CC-BY-SA 4.0": "https://creativecommons.org/licenses/by-sa/4.0/",
  "CC-BY-NC 4.0": "https://creativecommons.org/licenses/by-nc/4.0/",
};

interface Route {
  who: string;
  have: string;
  route: string;
  // Where this route actually starts. Someone who recognises their own row
  // should be able to act on it without reading the rest of the page.
  href: string;
  effort: string;
  status?: string;
}

const ROUTES: Route[] = [
  {
    who: "Drone pilots, local organizations, researchers",
    have: "Imagery files, nowhere to publish them",
    href: UPLOADER_URL,
    route: "Upload to OAM",
    effort: "Nothing to set up",
  },
  {
    who: "Satellite operators, agencies, mapping programs",
    have: "A STAC catalog that follows the spec",
    href: INTAKE_URL,
    route: "Send the catalog URL",
    effort: "No work on your side",
  },
  {
    who: "Satellite operators, agencies, mapping programs",
    have: "A STAC catalog with its own field names",
    href: INTAKE_URL,
    route: "OAM maps the metadata",
    effort: "One exchange to agree it",
  },
  {
    who: "Anyone already publishing to public cloud storage",
    have: "A bucket of COGs, no catalog",
    href: INTAKE_URL,
    route: "OAM generates the catalog",
    effort: "Agree a metadata set",
    status: "In development",
  },
];

const CHECKS: { q: string; why: string; href?: string }[] = [
  {
    q: "Publicly accessible",
    why: "People and applications reach the files directly, without credentials.",
  },
  {
    q: "Cloud Optimized GeoTIFF",
    href: COG_SPEC,
    why: "Lets a map read the part of an image it needs rather than the whole file.",
  },
  {
    q: "Stable URLs",
    why: "URLs that keep pointing at the same file, so the index stays correct.",
  },
  {
    q: "Basic metadata per image",
    href: DOCS_SCHEMA,
    why: "Acquisition date, sensor or platform, provider and license. A STAC catalog is preferred and read as-is; other formats are mapped.",
  },
  {
    q: "Resolution fit for mapping",
    why: "Detailed enough to trace buildings and roads: drone imagery at a few centimetres per pixel, satellite imagery at 30 to 50 cm.",
  },
  {
    q: "An open license",
    why: "CC-BY 4.0, CC-BY-SA 4.0 and CC-BY-NC 4.0 work today. More below.",
  },
];

export default function Contribute() {
  return (
    <div className="contribute-root">
      <SiteHeader />

      <main className="contribute-page">
        <section className="contribute-hero">
          <div className="contribute-shell">
            <p className="contribute-eyebrow">Contribute imagery</p>
            <h1 className="contribute-title">Add your imagery to OpenAerialMap</h1>
            <p className="contribute-lede">
              OpenAerialMap is an open service providing access to a commons of openly licensed
              satellite and drone imagery. Providers host their own data and maintain their own
              catalog, and OAM indexes it. Anyone can contribute, and anyone can use what is there,
              for humanitarian response, community mapping and research.
            </p>
            <div className="contribute-actions">
              <div className="contribute-action">
                <wa-button
                  variant="brand"
                  size="l"
                  onClick={() => {
                    window.location.href = UPLOADER_URL;
                  }}
                >
                  Upload imagery
                </wa-button>
                <p className="contribute-action-for">You have image files to publish</p>
              </div>
              <div className="contribute-action">
                <wa-button
                  appearance="outlined"
                  size="l"
                  class="contribute-hero-secondary"
                  onClick={() => {
                    window.location.href = INTAKE_URL;
                  }}
                >
                  Register a catalog
                </wa-button>
                <p className="contribute-action-for">You already publish to cloud storage</p>
              </div>
            </div>
          </div>
        </section>

        <section className="contribute-shell contribute-block">
          <figure className="contribute-figure">
            <div className="contribute-figure-scroll">
              <CommonsFigure />
            </div>
            <figcaption>
              Your imagery stays in your storage, under your license. OAM stores the metadata and
              links to your files. Indexing uses none of your bandwidth and gives OAM no rights over
              the imagery.
            </figcaption>
          </figure>
        </section>

        <section className="contribute-shell contribute-block">
          <h2 className="contribute-h2">Which route applies to you</h2>
          <p className="contribute-lead">
            If you cannot host imagery yourself, upload it. If you already publish to public cloud
            storage, OAM indexes it where it is.
          </p>

          <figure className="contribute-figure">
            <div className="contribute-figure-scroll">
              <RoutesFigure />
            </div>
          </figure>

          <div className="contribute-tablewrap">
            <table className="contribute-table">
              <thead>
                <tr>
                  <th>If this is you</th>
                  <th>Route</th>
                  <th>Effort</th>
                </tr>
              </thead>
              <tbody>
                {ROUTES.map((r) => (
                  <tr key={r.have}>
                    <td>
                      {r.who}
                      <span className="contribute-have">{r.have}</span>
                    </td>
                    <td>
                      <a href={r.href} target="_blank" rel="noopener noreferrer">
                        {r.route}
                      </a>
                      {r.status ? <span className="contribute-badge">{r.status}</span> : null}
                    </td>
                    <td>{r.effort}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="contribute-shell contribute-block">
          <h2 className="contribute-h2">Matching your metadata fields</h2>
          <p className="contribute-lead">
            Catalogs use different names for the same things. OAM translates them when it reads your
            catalog. Your own metadata stays as it is.
          </p>
          <figure className="contribute-figure">
            <div className="contribute-figure-scroll">
              <MappingFigure />
            </div>
          </figure>
          <p className="contribute-note">
            The required and optional fields are published in the{" "}
            <a href={DOCS_SCHEMA} target="_blank" rel="noopener noreferrer">
              OAM STAC extension
            </a>
            , and the ingestion process in the{" "}
            <a href={DOCS_NEW_PROVIDER} target="_blank" rel="noopener noreferrer">
              provider guide
            </a>
            .
          </p>
        </section>

        <section className="contribute-shell contribute-block">
          <h2 className="contribute-h2">Six checks</h2>
          <p className="contribute-lead">
            What OAM looks at before indexing a catalog. If something is missing, say so in the
            form.
          </p>
          <ul className="contribute-checks">
            {CHECKS.map((c) => (
              <li key={c.q}>
                <p className="contribute-check-q">
                  {c.href ? (
                    <a href={c.href} target="_blank" rel="noopener noreferrer">
                      {c.q}
                    </a>
                  ) : (
                    c.q
                  )}
                </p>
                <p className="contribute-check-why">{c.why}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="contribute-shell contribute-block">
          <h2 className="contribute-h2">Licenses</h2>
          <p className="contribute-lead">
            {(["CC-BY 4.0", "CC-BY-SA 4.0", "CC-BY-NC 4.0"] as const).map((name, n) => (
              <span key={name}>
                {n === 0 ? "" : n === 2 ? " and " : ", "}
                <a href={LICENSE_LINKS[name]} target="_blank" rel="noopener noreferrer">
                  {name}
                </a>
              </span>
            ))}{" "}
            are indexed today. CC0, ODbL and other standard open licenses are accepted too, but are
            not implemented yet; support for them is coming. A custom open data license can also be
            added, as long as it maps onto one of the standard ones so the catalog can filter and
            publish it consistently.
          </p>

          <h3 className="contribute-h3">Tracing into OpenStreetMap</h3>
          <p className="contribute-lead">
            Anything mapped in OpenStreetMap from your imagery becomes ODbL data, which has to stay
            commercially usable. That means a non-commercial license on its own does not allow
            tracing, though the imagery can still be indexed, viewed and analyzed.
          </p>
          <p className="contribute-lead">
            A short written permission alongside the license solves this. Some satellite imagery
            providers publish their open data as CC-BY-NC 4.0 and add written permission to trace it
            into OpenStreetMap, so volunteers can map buildings and roads during a response while
            the commercial terms hold everywhere else. Any provider can add the same permission to
            any license. It is optional and it changes nothing else about how the imagery is indexed
            or credited.
          </p>
          <p className="contribute-note">
            Every item carries your attribution, shown wherever the imagery appears. You set the
            wording for both original and derived use.
          </p>
        </section>

        <section className="contribute-cta">
          <div className="contribute-shell">
            <h2 className="contribute-cta-title">Register a catalog</h2>
            <p className="contribute-cta-body">
              The form asks everything needed to index a catalog.
            </p>
            <div className="contribute-actions">
              <a
                className="contribute-cta-button"
                href={INTAKE_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open an intake ticket
              </a>
            </div>
            <p className="contribute-cta-note">
              Contributing files rather than a catalog? The <a href={UPLOADER_URL}>uploader</a>{" "}
              needs no ticket. If a public tracker will not work for your organization, write to{" "}
              <a href={`mailto:${CONTACT}`}>{CONTACT}</a> and tell us which route applies.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
