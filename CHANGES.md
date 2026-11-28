# Changes from upstream

Dated notices of modification (AGPL-3.0 section 5a).

- 2026-10-27, BizBox: first release (1.0.0). Rebrand to All Eyes on Me, BizBox theme, removal of accounts, upgrade prompts, Embed/Link and the footer, About panel with credits and source links, BizBox Share, outside-call guard, per-user saved layout, shell message channel, map-style looks. See README.md for the table.
- 2026-11-25, BizBox: saved World Clock cities. New overlay/clock-prefs.js reads the owner's saved cities from the gateway (GET /worldmonitor/auth/prefs) before browser storage, sends every save back (PUT), so a new browser or VPN timezone no longer swaps in the default cities plus a timezone home city. Loaded by tools/patch-html.mjs right after alleyes.js.
