<!-- markdownlint-disable -->
<p align="center">
    <!-- github-banner-start -->
    <img src="https://raw.githubusercontent.com/hotosm/openaerialmap/main/docs/images/hot_logo.png" alt="HOTOSM Logo" width="25%" height="auto" />
    <!-- github-banner-end -->
</p>

<div align="center">
    <h1>OpenAerialMap</h1>
    <p>OpenAerialMap is an open service to provide access to a commons of openly licensed imagery and map layer services.</p>
    <a href="https://github.com/hotosm/openaerialmap/releases">
        <img src="https://img.shields.io/github/v/release/hotosm/openaerialmap?logo=github" alt="Release Version" />
    </a>
</div>

</br>

<!-- prettier-ignore-start -->
<div align="center">

| **CI/CD** | | [![Deploy](https://github.com/hotosm/openaerialmap/actions/workflows/deploy.yml/badge.svg?branch=main)](https://github.com/hotosm/openaerialmap/actions/workflows/deploy.yml?query=branch%3Amain) |
| :--- | :--- | :--- |
| **Tech Stack** | | ![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB) ![Postgres](https://img.shields.io/badge/postgres-%23316192.svg?style=for-the-badge&logo=postgresql&logoColor=white) ![Kubernetes](https://img.shields.io/badge/kubernetes-%23326ce5.svg?style=for-the-badge&logo=kubernetes&logoColor=white) ![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white) |
| **Code Style** | | [![Backend Style](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/astral-sh/ruff/main/assets/badge/format.json&labelColor=202235)](https://github.com/astral-sh/ruff) [![Frontend Style](https://img.shields.io/badge/code%20style-prettier-F7B93E?logo=Prettier)](https://github.com/prettier/prettier) [![pre-commit.ci status](https://results.pre-commit.ci/badge/github/hotosm/openaerialmap/main.svg)](https://results.pre-commit.ci/latest/github/hotosm/openaerialmap/main) |
| **Community** | | [![Slack](https://img.shields.io/badge/Slack-Join%20the%20community!-d63f3f?style=for-the-badge&logo=slack&logoColor=d63f3f)](https://slack.hotosm.org) [![All Contributors](https://img.shields.io/github/contributors/hotosm/openaerialmap?logo=github)](#contributors-) |
| **Other Info** | | [![docs](https://github.com/hotosm/openaerialmap/blob/main/docs/images/docs_badge.svg?raw=true)](https://docs.imagery.hotosm.org/) [![license-code](https://img.shields.io/github/license/hotosm/openaerialmap.svg)](https://github.com/hotosm/openaerialmap/blob/main/LICENSE.md) |

</div>

---

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

A revamp of OpenAerialMap, originally developed back in the 2010's.

## Components

- Backend
  - [STAC API][4] deployment of eoAPI.
  - [STAC Extension][3] for OAM metadata requirements, data ingestion.
- New Frontend: Hosted in this repo.
- Old Frontend: <https://github.com/hotosm/oam-browser> (currently used as
  frontend + uploader)
- Old API: <https://github.com/hotosm/oam-api> (currently used for login / upload)

### Frontend Parts

The frontend prototype was developed as part of the revamp deliverables.

The idea has since morphed into [stac-map](https://github.com/developmentseed/stac-map).
We should probably migrate to that and consolidate efforts within the community.

Main parts:

- Main OpenAerialMap landing page, with links to different parts and docs / info.
- Documentation site with tutorials etc.
- The uploader site. This should be HOT themed, with shared auth and consistent
  look / style.
- `stac-browser` for a catalog search from the backend STAC.
- `stac-map` to display the global coverage pmtiles layer (giving indication of
  where imagery is currently present), plus map-based search of the STAC once
  the user zooms into their area of interest (+ filtering based on various
  criteria).

## Contributing 👍🎉

We would really welcome contributions for:

- Backend Python development
- Frontend Typescript development
- Documentation writers
- UI / UX designers
- Testers!

Please take a look at our [Documentation][1] and
[contributor guidance][2] for more details!

Reach out to us if any questions!

## Roadmap

<!-- prettier-ignore-start -->
| Status | Feature | Description | Version | Effort (person-months) |
|:------:|:-------|:------------|:-------:|:----------------------:|
| ✅ | New OAM backend based on STAC | Core backend using pgSTAC, FastAPI STAC endpoints, and TiTiler integration. | v2.0-alpha | 1.5 |
| ✅ | Kubernetes-based deployment of eoAPI for OAM STAC | A scalable, open-source infrastructure to support the growing volume of imagery hosted and indexed in OAM. | v2.0-alpha | 1.0 |
| ✅ | STAC extension for OAM and metadata ingested from old API | STAC is the industry standard to describe geospatial information - including imagery - so it can be more easily indexed, discovered, and worked with. This extension aligns legacy OAM metadata with STAC. | v2.0-alpha | 1.5 |
| ✅ | Revamped global mosaic | The global tiled mosaic of OAM imagery (previously available from Kontur) has been redesigned to use a combined approach: visualize footprints at lower zoom levels, and dynamically switch to full-resolution imagery at higher zoom levels. | v2.0-alpha | 0.5 |
| ✅ | Prototype frontend based on STAC | This initial prototype lays the foundation for the new frontend, enabling rich interactions with available imagery, dynamic filtering, advanced search, and an overall modern user experience on the OAM platform. | v2.0-alpha | 1.0 |
| ✅ | Documentation site | Public docs with setup, endpoints, and usage guides for API, mosaic/TMS, and frontend. | v2.0-alpha | 0.5 |
| 🔄 | New frontend feature parity with old frontend | Features from the old Node.js frontend are being implemented in the new OAM Browser to ensure continuity in user experience and functionality. | v2.0 | 2.0 |
| 📅 | Improvements to the STAC catalog search | Allow users to search across the full STAC metadata, beyond the basic set of elements currently supported in OAM. | v2.1 | 1.5 |
| 📅 | Preset + advanced filtering | Improve user experience and efficiency by creating preset filters (e.g. all imagery for the selected AOI collected in the last week) and advanced filtering to find specific imagery. | v2.1 | 1.5 |
| 📅 | Migrate frontend to stac-map | Move the UI to the community stac-map component (OAM theme) to reduce maintenance while keeping feature parity. | v2.1 | 1.5 |
| 📅 | Cross-catalog search and display | Develop automations to harvest external STAC catalog metadata and cache previews, enabling faster, seamless display of available imagery in a unified OAM Browser interface. | v2.2 | 1.0 |
| 📅 | Better visualization of imagery | Improve how imagery distribution and density are visualized in the OAM Browser, so users can quickly see what is available and what the imagery looks like before downloading. | v2.2 | 0.5 |
| 📅 | Dynamic tile creation | Provide dynamic Tile Map Service (TMS) generated on the fly using TiTiler, so imagery can be easily used in JOSM/iD and other mapping software. | v2.2 | 2.0 |
| 📅 | New user management and API | Create a system for user accounts, allowing drone pilots and satellite providers to log in (via OSM OAuth and Google), manage the imagery they have uploaded (delete, rename, etc.), and see contribution statistics. | v2.3 | 4.0 |
| 📅 | New uploader API & UI | Develop an efficient web application that allows users to upload very large imagery files from their computer or from cloud services like Google Drive or Dropbox. This is critical to remove contribution barriers, since many imagery files are too big for the current uploader. | v2.3 | 4.0 |
| 📅 | Catalog expansion | Add additional STAC catalog ingestion workflows by engaging more providers, and create ingestion processes to “map” publicly available STACs to the OAM metadata schema. This will significantly expand the amount of imagery available through OAM’s unified discovery interface. | v2.4 | 2.0 |
| 📅 | Integration with ODM | Develop a plugin for OpenDroneMap to allow drone pilots to publish imagery directly to OAM (without having to download the GeoTIFF and manually upload it). | v2.4 | 2.0 |
| 📅 | Imagery and user statistics | Provide rich user and data statistics to foster the open imagery community and more clearly visualize growth and usage over time. | v2.4 | 2.0 |
| 📅 | Support for multispectral and non-optical imagery | Allow users to upload more advanced imagery formats and non-optical data that can be rendered and visualized alongside common RGB imagery. | v2.5 | 2.0 |
| 📅 | Support for DEMs | Add capabilities to upload Digital Elevation Models (DEMs) and 3D point clouds - common byproducts of drone mapping - that can be used for risk modeling and humanitarian mapping (e.g. DTMs for flood modeling). | v2.5 | 2.0 |
<!-- prettier-ignore-end -->

[1]: https://hotosm.github.io/openaerialmap
[2]: https://github.com/hotosm/openaerialmap/blob/main/CONTRIBUTING.md
[3]: https://github.com/hotosm/stactools-hotosm
[4]: https://github.com/hotosm/k8s-infra/tree/main/kubernetes/helm
