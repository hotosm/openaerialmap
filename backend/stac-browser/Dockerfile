# STAC Browser with OAM editor links on item pages (#323).
#
# Upstream generates runtime-config.js from SB_* environment variables in
# /docker-entrypoint.d/40-stac-browser-entrypoint.sh. Functions cannot be
# passed through the environment, so this script runs right after it and
# appends a preprocessSTAC hook that adds Open in iD, Open in JOSM and XYZ
# tile links to every raster item. Nothing else about the image changes.
ARG STAC_BROWSER_VERSION=5.1.0
FROM ghcr.io/radiantearth/stac-browser:${STAC_BROWSER_VERSION}

COPY --chown=nginx:nginx oam-links.js /usr/share/nginx/html/oam-links.js
COPY --chmod=755 50-oam-links.sh /docker-entrypoint.d/50-oam-links.sh
