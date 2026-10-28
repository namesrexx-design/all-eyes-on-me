# Upstream pin

- Project: koala73/worldmonitor
- Commit: `2f7d292764ce9f76db5132142c7b198f6d4d74da` ("feat(prediction): order-book liquidity for both venues and min_liquidity filters")
- Version string shown by the interface: v2.11.6
- Licence: AGPL-3.0 (unchanged, see LICENSE)

To update: rebuild the upstream image from the new commit, retag, rebuild this image, then re-run the checks in `tests/`. The overlay depends on a few upstream class names and ids (`.header-left`, `.header-right`, `#fullscreenBtn`, `button.layer-toggle[data-layer]`, `.pro-banner`, `.site-footer`, and others listed in `overlay/alleyes.css`). If an update moves one, the overlay degrades to the upstream look for that element; nothing breaks.
