FROM docker.io/node:22-slim AS base
ARG VITE_PMTILES_URL
ARG VITE_DENSITY_PMTILES_URL
ARG VITE_STAC_TITILER_URL
ARG VITE_MAPBOX_TOKEN
ENV VITE_PMTILES_URL=${VITE_PMTILES_URL} \
    VITE_DENSITY_PMTILES_URL=${VITE_DENSITY_PMTILES_URL} \
    VITE_STAC_TITILER_URL=${VITE_STAC_TITILER_URL} \
    VITE_MAPBOX_TOKEN=${VITE_MAPBOX_TOKEN} \
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
LABEL org.hotosm.openaerialmap.app-name="frontend" \
      org.hotosm.openaerialmap.app-version="${APP_VERSION}" \
      org.hotosm.openaerialmap.git-commit-ref="${COMMIT_REF:-none}" \
      org.hotosm.openaerialmap.maintainer="sysadmin@hotosm.org" \
      org.hotosm.openaerialmap.pmtiles-url="${VITE_PMTILES_URL}" \
      org.hotosm.openaerialmap.density-pmtiles-url="${VITE_DENSITY_PMTILES_URL}" \
      org.hotosm.openaerialmap.stac-titiler-url="${VITE_STAC_TITILER_URL}"
WORKDIR /app
COPY --from=build /app/dist .
