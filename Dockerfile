# All Eyes on Me: World Monitor (AGPL-3.0) with the BizBox overlay. Modified source, see README.md.
# Build the upstream image first (pinned commit in UPSTREAM.md), tag it, then:
#   docker build -t all-eyes-on-me:1.0.0 --build-arg UPSTREAM_IMAGE=worldmonitor:upstream-2f7d292 .
ARG UPSTREAM_IMAGE=worldmonitor:upstream-2f7d292
FROM ${UPSTREAM_IMAGE}
USER root
ARG OVERLAY_VERSION=1.0.0
COPY overlay/ /usr/share/nginx/html/alleyes/
COPY LICENSE /usr/share/nginx/html/alleyes/LICENSE.txt
COPY tools/patch-html.mjs /tmp/patch-html.mjs
RUN node /tmp/patch-html.mjs /usr/share/nginx/html ${OVERLAY_VERSION} && rm /tmp/patch-html.mjs \
 && chmod -R a+rX /usr/share/nginx/html/alleyes
LABEL org.opencontainers.image.title="All Eyes on Me" \
      org.opencontainers.image.source="https://github.com/namesrexx-design/all-eyes-on-me" \
      org.opencontainers.image.licenses="AGPL-3.0-only" \
      org.opencontainers.image.base.name="World Monitor (koala73/worldmonitor)"
USER appuser
