# Builds https://github.com/developmentseed/stac-map at a pinned tag and
# serves the static bundle under /map/ via nginx. Mirrors how the
# eoapi chart deploys stac-browser (ghcr.io/developmentseed/eoapi-k8s-stac-browser):
# a tiny nginx image, all Vite envs baked in at build time.

# Compile ngx_brotli against the exact nginx version used in prod so the
# resulting .so files are ABI-compatible (--with-compat).
FROM docker.io/nginx:1.31-alpine AS brotli-builder
RUN apk add --no-cache git gcc libc-dev make pcre-dev zlib-dev openssl-dev linux-headers cmake
WORKDIR /src
RUN NGINX_VERSION="$(nginx -v 2>&1 | sed 's|^.*/||')" && \
    wget -O nginx.tar.gz "https://nginx.org/download/nginx-${NGINX_VERSION}.tar.gz" && \
    tar -xzf nginx.tar.gz && \
    mv "nginx-${NGINX_VERSION}" nginx-src && \
    git clone --depth 1 --recursive https://github.com/google/ngx_brotli.git && \
    cd nginx-src && \
    ./configure --with-compat --add-dynamic-module=/src/ngx_brotli && \
    make modules && \
    mkdir -p /out && \
    cp objs/ngx_http_brotli_filter_module.so objs/ngx_http_brotli_static_module.so /out/

FROM docker.io/node:22-alpine AS build
RUN apk add --no-cache git
ARG STAC_MAP_REF=v2.1.0
ARG VITE_BASE_PATH=/map/
ARG VITE_DEFAULT_HREF=https://api.imagery.hotosm.org/stac
ARG VITE_STAC_BROWSER_URL=https://api.imagery.hotosm.org/browser/#/external/
ENV VITE_BASE_PATH=${VITE_BASE_PATH} \
    VITE_DEFAULT_HREF=${VITE_DEFAULT_HREF} \
    VITE_STAC_BROWSER_URL=${VITE_STAC_BROWSER_URL}
WORKDIR /src
RUN git clone --depth 1 --branch "${STAC_MAP_REF}" \
    https://github.com/developmentseed/stac-map.git .
RUN yarn install --frozen-lockfile
RUN yarn build


FROM docker.io/nginx:1.31-alpine AS prod
ARG APP_VERSION
ARG COMMIT_REF
ARG STAC_MAP_REF=v2.1.0
LABEL org.hotosm.openaerialmap.app-name="stac-map" \
      org.hotosm.openaerialmap.app-version="${APP_VERSION}" \
      org.hotosm.openaerialmap.git-commit-ref="${COMMIT_REF:-none}" \
      org.hotosm.openaerialmap.upstream-ref="${STAC_MAP_REF}" \
      org.hotosm.openaerialmap.maintainer="sysadmin@hotosm.org"
COPY --from=brotli-builder \
     /out/ngx_http_brotli_filter_module.so \
     /out/ngx_http_brotli_static_module.so \
     /etc/nginx/modules/
# load_module must live in the main context, so prepend it to the top-level
# nginx.conf. The conf.d/default.conf we ship is already in the http context.
RUN { \
        echo 'load_module /etc/nginx/modules/ngx_http_brotli_filter_module.so;'; \
        echo 'load_module /etc/nginx/modules/ngx_http_brotli_static_module.so;'; \
        cat /etc/nginx/nginx.conf; \
    } > /tmp/nginx.conf && mv /tmp/nginx.conf /etc/nginx/nginx.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/dist /usr/share/nginx/html/map/
