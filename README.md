# All Eyes on Me

The intelligence map inside BizBox's **All Eyes on Me** module: [World Monitor](https://github.com/koala73/worldmonitor) by Elie Habib, rebranded and adapted for BizBox. This repository is the complete, corresponding source of our modified version, published under the same licence as the original: **GNU Affero General Public License v3.0** (see [LICENSE](LICENSE)).

> Built on World Monitor by Elie Habib and contributors, AGPL-3.0. Original source: <https://github.com/koala73/worldmonitor>. Source of this modified version: <https://github.com/namesrexx-design/all-eyes-on-me>.

This is a separate service. It is not mixed into BizBox's own app code, and BizBox's app talks to it only over HTTP in a frame.

## What we changed

We do not fork the upstream tree. We build on top of the unmodified upstream image and add an overlay, so the diff against the original is small and easy to read.

| Change | Where |
| --- | --- |
| Name, logo, icon, page title and descriptions: **All Eyes on Me** | `tools/patch-html.mjs`, `overlay/alleyes.js`, `overlay/logo.svg` |
| BizBox dark theme (night-blue, mint accent) | `overlay/alleyes.css` |
| Our wording for panels (for example "Digest coverage" becomes "News coverage") | `overlay/alleyes.js` |
| GitHub button, footer links, social and variant links removed from the main view | `overlay/alleyes.css`, `overlay/alleyes.js` |
| Credits, AGPL notice and source links moved into an **About** panel (a button in the header; a small button beside the name on phones) | `overlay/alleyes.js` |
| Sign in, Create account, Pro banner, upgrade prompts removed. Sign-in is the BizBox owner pass, checked by BizBox's gateway before this service sees a request | `overlay/alleyes.css`, `overlay/alleyes.js` |
| Embed and Link replaced by **Share**: a BizBox link to the same view | `overlay/alleyes.js` |
| No calls to the original site, its analytics, error reporting, sign-in, payment or newsletter hosts. Scripts are removed at build time; a guard blocks any remaining request. The one map data file it needs is served from this service | `tools/patch-html.mjs`, `overlay/alleyes.js`, `overlay/data/` |
| Saved layout is kept per BizBox user (browser storage is namespaced by a hashed user id the gateway passes in) | `overlay/alleyes.js` |
| A small, origin-checked message channel so the BizBox shell can set the map style and read the current view for Share | `overlay/alleyes.js` |
| Six map looks (Clean, Neon, Cyberpunk, GTA, Roblox, Pixar): a colour grade on the map surface | `overlay/alleyes.css` |
| First-run workspace chooser is pre-dismissed (the Mission button still works) | `overlay/alleyes.js` |

No upstream source file is edited. `Dockerfile` copies `overlay/` into the upstream image's web root and runs `tools/patch-html.mjs` over the entry pages.

## Build

```sh
# 1. Build the upstream image from the pinned commit (see UPSTREAM.md) and tag it
git clone https://github.com/koala73/worldmonitor && cd worldmonitor
git checkout 2f7d292764ce9f76db5132142c7b198f6d4d74da
docker compose build worldmonitor && docker tag worldmonitor:latest worldmonitor:upstream-2f7d292

# 2. Build All Eyes on Me on top of it
cd ../all-eyes-on-me
docker build -t all-eyes-on-me:1.0.0 --build-arg UPSTREAM_IMAGE=worldmonitor:upstream-2f7d292 .

# 3. Run it in place of the stock dashboard (upstream's own compose file plus our layer)
docker compose -f ../worldmonitor/docker-compose.yml -f docker-compose.alleyes.yml up -d --no-build worldmonitor
```

Bind the dashboard to loopback only and put a gateway in front that checks who is signing in. BizBox's gateway is in the BizBox repository; any reverse proxy that authenticates users and passes `x-bizbox-user` works. Without a gateway the overlay still runs (it just has no user to key saved layouts to).

## Test

```sh
node --test tests/patch-html.test.mjs
```

## Licence and notices

World Monitor is Copyright Elie Habib and World Monitor contributors, AGPL-3.0. This repository keeps the original licence text in [LICENSE](LICENSE) and adds our changes under the same licence. Third-party map data and fonts keep their own licences (see the upstream repository and [NOTICE.md](NOTICE.md)). "BizBox" and the All Eyes on Me logo are BizBox marks; the AGPL does not grant rights to them.
