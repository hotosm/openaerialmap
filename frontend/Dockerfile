FROM docker.io/node:22-slim AS base
ARG VITE_STAC_API_URL
ARG VITE_STAC_API_PATHNAME
ARG VITE_STAC_TILER_PATHNAME
ARG VITE_STAC_ITEMS_LIMIT
ARG VITE_HANKO_URL
ENV VITE_STAC_API_URL=${VITE_STAC_API_URL} \
    VITE_STAC_API_PATHNAME=${VITE_STAC_API_PATHNAME} \
    VITE_STAC_TILER_PATHNAME=${VITE_STAC_TILER_PATHNAME} \
    VITE_STAC_ITEMS_LIMIT=${VITE_STAC_ITEMS_LIMIT} \
    VITE_HANKO_URL=${VITE_HANKO_URL} \
    PNPM_HOME="/pnpm" \
    PATH="$PATH:/pnpm"
WORKDIR /app


FROM base AS development
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && corepack install
RUN pnpm install
COPY . .
CMD ["pnpm", "run", "serve", "--host", "0.0.0.0"]


FROM base AS build
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && corepack install
RUN pnpm install
COPY . .
RUN pnpm run build


FROM docker.io/rclone/rclone:1 AS prod
ARG APP_VERSION
ARG COMMIT_REF
ARG VITE_STAC_API_URL
ARG VITE_STAC_API_PATHNAME
ARG VITE_STAC_TILER_PATHNAME
ARG VITE_STAC_ITEMS_LIMIT
ARG VITE_HANKO_URL
LABEL org.hotosm.openaerialmap.app-name="frontend" \
      org.hotosm.openaerialmap.app-version="${APP_VERSION}" \
      org.hotosm.openaerialmap.git-commit-ref="${COMMIT_REF:-none}" \
      org.hotosm.openaerialmap.maintainer="sysadmin@hotosm.org" \
      org.hotosm.openaerialmap.stac-api-url="${VITE_STAC_API_URL}" \
      org.hotosm.openaerialmap.stac-api-pathname="${VITE_STAC_API_PATHNAME}" \
      org.hotosm.openaerialmap.stac-tiler-pathname="${VITE_STAC_TILER_PATHNAME}" \
      org.hotosm.openaerialmap.stac-items-limit="${VITE_STAC_ITEMS_LIMIT}" \
      org.hotosm.openaerialmap.hanko-url="${VITE_HANKO_URL}"
WORKDIR /app
COPY --from=build /app/dist .
