#!/bin/sh
# Append the OAM preprocessSTAC hook to the runtime config that
# 40-stac-browser-entrypoint.sh has just written. OAM_TITILER_URL overrides
# the tile endpoint; by default it is derived from the catalog URL by
# swapping the /stac suffix for /raster (the eoAPI layout).
set -e
runtime_config=/usr/share/nginx/html/runtime-config.js
{
  printf 'window.STAC_BROWSER_CONFIG.oamTitilerUrl = %s;\n' \
    "$(jq -cn --arg v "${OAM_TITILER_URL:-}" '$v')"
  cat /usr/share/nginx/html/oam-links.js
} >> "$runtime_config"
