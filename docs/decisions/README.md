# Architectural Decisions

Markdown Architectural Decision Records documenting the technical decisions
taken in this project.

This process was started 15/08/2025, so does not necessarily capture all decisions
from the projects inception.

## Decisions

- [0000 - HOTOSM Context and Alignment](./0000-hotosm.md)
- [0001 - STAC to catalogue all imagery assets](./0001-stac.md)
- [0002 - Global mosaic as PMTiles from STAC](./0002-global-mosaic.md)
- [0003 - Global TMS service (chiitiler + PMTiles + TiTiler)](./0003-global-tms.md)
- [0004 - Frontend stack (Vite + React + UnoCSS + hotosm/ui + Web Awesome)](./0004-frontend-stack.md)
- [0005 - Composable services over a monolith](./0005-composable-architecture.md)
- [0006 - Tilepack API for MBTiles / PMTiles downloads](./0006-tilepack-api.md)
- [0007 - Uploader stack (Litestar + HTMX + Kubernetes)](./0007-uploader-stack.md)
- [0008 - Lossy WEBP COGs for visual imagery](./0008-lossy-visual-cogs.md)
- [0009 - Browse more than one STAC collection, behind an allowlist](./0009-multi-collection-browse.md)
