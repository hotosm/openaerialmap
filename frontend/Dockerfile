FROM docker.io/node:22-slim AS base
ARG VITE_PMTILES_URL
ARG VITE_DENSITY_PMTILES_URL
ARG VITE_STAC_TITILER_URL
ARG VITE_STAC_URL
ARG VITE_STAC_BROWSER_URL
ARG VITE_PACKAGER_URL
ARG VITE_MAPBOX_TOKEN
ARG VITE_UPLOADER_URL
ENV VITE_PMTILES_URL=${VITE_PMTILES_URL} \
    VITE_DENSITY_PMTILES_URL=${VITE_DENSITY_PMTILES_URL} \
    VITE_STAC_TITILER_URL=${VITE_STAC_TITILER_URL} \
    VITE_STAC_URL=${VITE_STAC_URL} \
    VITE_STAC_BROWSER_URL=${VITE_STAC_BROWSER_URL} \
    VITE_PACKAGER_URL=${VITE_PACKAGER_URL} \
    VITE_MAPBOX_TOKEN=${VITE_MAPBOX_TOKEN} \
    VITE_UPLOADER_URL=${VITE_UPLOADER_URL} \
    PNPM_HOME="/pnpm" \
    PATH="$PATH:/pnpm"
WORKDIR /app


FROM base AS build
COPY package.json pnpm-lock.yaml ./
# Keep version in sync with `packageManager` field in package.json
RUN npm install -g pnpm@10.33.2
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build


FROM docker.io/rclone/rclone:1 AS prod
ARG APP_VERSION
ARG COMMIT_REF
ARG VITE_PMTILES_URL
ARG VITE_DENSITY_PMTILES_URL
ARG VITE_STAC_TITILER_URL
ARG VITE_STAC_URL
ARG VITE_STAC_BROWSER_URL
ARG VITE_PACKAGER_URL
LABEL org.hotosm.openaerialmap.app-name="frontend" \
      org.hotosm.openaerialmap.app-version="${APP_VERSION}" \
      org.hotosm.openaerialmap.git-commit-ref="${COMMIT_REF:-none}" \
      org.hotosm.openaerialmap.maintainer="sysadmin@hotosm.org" \
      org.hotosm.openaerialmap.pmtiles-url="${VITE_PMTILES_URL}" \
      org.hotosm.openaerialmap.density-pmtiles-url="${VITE_DENSITY_PMTILES_URL}" \
      org.hotosm.openaerialmap.stac-titiler-url="${VITE_STAC_TITILER_URL}" \
      org.hotosm.openaerialmap.stac-url="${VITE_STAC_URL}" \
      org.hotosm.openaerialmap.stac-browser-url="${VITE_STAC_BROWSER_URL}" \
      org.hotosm.openaerialmap.packager-url="${VITE_PACKAGER_URL}"
WORKDIR /app
COPY gen-config.sh /gen-config.sh
RUN chmod +x /gen-config.sh
COPY --from=build /app/dist .


# Serves the SPA in-cluster. The `prod` stage above is rclone, for the S3 sync.
FROM docker.io/nginx:1.31-alpine AS serve
ARG APP_VERSION
ARG COMMIT_REF
LABEL org.hotosm.openaerialmap.app-name="frontend" \
      org.hotosm.openaerialmap.app-version="${APP_VERSION}" \
      org.hotosm.openaerialmap.git-commit-ref="${COMMIT_REF:-none}" \
      org.hotosm.openaerialmap.maintainer="sysadmin@hotosm.org"
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY gen-config.sh /gen-config.sh
COPY docker-entrypoint.sh /docker-entrypoint.sh
COPY --from=build /app/dist /usr/share/nginx/html
# Make config.js and nginx runtime paths writable by uid 101.
RUN chmod +x /gen-config.sh /docker-entrypoint.sh \
    && sed -i 's|^pid .*|pid /tmp/nginx.pid;|' /etc/nginx/nginx.conf \
    && chown -R 101:101 /usr/share/nginx/html /var/cache/nginx
USER 101
EXPOSE 8080
ENTRYPOINT ["/docker-entrypoint.sh"]
