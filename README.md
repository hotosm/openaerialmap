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
| Status | Feature | Release |
|:------:|:-------:|:--------|
| ✅ | Kubernetes based deployment of eoAPI for OAM STAC | - |
| ✅ | STAC extension for OAM and metadata ingested from old API | - |
| ✅ | Prototype frontend based on STAC | - |
| 🔄 | New frontend feature parity with old frontend | |
| 📅 | New metadata / user API | – |
| 📅 | New uploader API & UI | – |
<!-- prettier-ignore-end -->

[1]: https://hotosm.github.io/openaerialmap
[2]: https://github.com/hotosm/openaerialmap/blob/main/CONTRIBUTING.md
[3]: https://github.com/hotosm/stactools-hotosm
[4]: https://github.com/hotosm/k8s-infra/tree/main/kubernetes/helm
