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

A revamp of OpenAerialMap, originally developed back in the 2010s.

## Components

- Backend
  - [STAC API][4] deployment of eoAPI.
  - [STAC creation and extension][3] for OAM metadata requirements, data
    ingestion.
- Main frontend: the OAM Browser in `frontend/`.
- Uploader: a separate application in `backend/uploader-api/`.
- Additional catalogue viewers: STAC Browser and STAC Map.
- Legacy frontend: <https://github.com/hotosm/oam-browser>.
- Legacy API: <https://github.com/hotosm/oam-api>.

### Frontend Parts

The main OAM Browser is built specifically for OpenAerialMap.
STAC Map was evaluated as a replacement, but the team chose a dedicated
browser to better meet OAM users' needs and match other HOT tools.
See the [frontend decision](docs/decisions/0004-frontend-stack.md).

Main parts:

- Landing page linking to the browser, uploader, and other tools.
- OAM Browser for finding, previewing, filtering, and downloading imagery.
- Uploader for sharing imagery, with the shared HOT login.
- Documentation with usage and setup guides.
- STAC Browser and STAC Map as additional ways to explore the catalogue.

## Contributing 👍🎉

We would really welcome contributions for:

- Backend Python development
- Frontend TypeScript development
- Documentation writers
- UI / UX designers
- Testers!

Please take a look at our [Documentation][1] and
[contributor guidance][2] for more details!

Reach out to us if you have any questions!

## Roadmap

✅ Implemented · 🔄 In progress · 📅 Planned

Versions are original planning targets and may change.

<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
| Status | Feature | Description | Version |
|:------:|:-------|:------------|:-------:|
| ✅ | Standard imagery catalogue | Organize imagery using STAC, including records from the old catalogue. | v2.0-alpha |
| ✅ | Global coverage map | See where imagery is available and zoom in to preview it. | v2.0-alpha |
| ✅ | OAM Browser | Find, filter, preview, and download imagery in OAM's main browser. | v2.0 |
| ✅ | Additional catalogue viewers | Explore the catalogue through STAC Map and STAC Browser. | – |
| ✅ | Mapping tool support | Use OAM imagery in QGIS and OpenStreetMap editors. | v2.2 |
| ✅ | New uploader | Upload large imagery files or public file links, with HOT login and progress tracking. | v2.3 |
| ✅ | New site soft launch | Offer the new OAM site alongside the old site. | – |
| ✅ | Offline downloads | Request supported imagery as MBTiles or PMTiles for offline use. | – |
| ✅ | Provider contribution page | Help imagery providers share their data with OAM. | – |
| ✅ | Basic statistics | Show imagery totals and coverage area. | – |
| ✅ | Elevation catalogue | Provide access to Copernicus GLO-30 elevation data. | – |
| ✅ | Documentation | Provide guides for using OAM and its mapping services. | v2.0-alpha |
| 🔄 | Complete site transition | Finish moving from the old OAM site to the new platform. | – |
| 🔄 | More imagery providers | Expand the catalogue with imagery from additional providers. | v2.4 |
| 📅 | Advanced search | Add flexible date, image-detail, and cloud-cover filters. | v2.1 |
| 📅 | Contributor tools | Let contributors edit imagery details, delete uploads, and view their contributions. | v2.3 |
| 📅 | Broader catalogue discovery | Find imagery from more external catalogues in one place. | v2.2 |
| 📅 | OpenDroneMap integration | Publish imagery directly from OpenDroneMap. | v2.4 |
| 📅 | Public imagery statistics | Show coverage and growth by provider, year, and image detail. | v2.4 |
| 📅 | More imagery types | Support multispectral and other specialized imagery. | v2.5 |
| 📅 | Elevation and 3D uploads | Let contributors share elevation models and 3D point clouds. | v2.5 |
| 📅 | More accurate maps | Improve imagery outlines, preview alignment, and coverage estimates. | – |
| 📅 | Easier imagery access | Make finished uploads easier to find and large downloads easier to use. | – |
| 📅 | Shared imagery management | Let organizations manage imagery together and preserve ownership from the old site. | – |
| 📅 | Usage and contributor impact | Show how OAM and contributed imagery are used. | – |
| 📅 | New imagery alerts | Notify users when imagery becomes available in areas they follow. | – |
| 📅 | Credits and impact stories | Recognize supporters and share examples of OAM's impact. | – |
<!-- prettier-ignore-end -->
<!-- markdownlint-restore -->

[1]: https://hotosm.github.io/openaerialmap
[2]: https://github.com/hotosm/openaerialmap/blob/main/CONTRIBUTING.md
[3]: ./backend/stactools-hotosm
[4]: https://github.com/hotosm/k8s-infra/tree/main/kubernetes/helm
