import test from 'node:test';
import assert from 'node:assert/strict';
import { patch } from '../tools/patch-html.mjs';

const sample = `<!DOCTYPE html><html><head><meta charset="UTF-8" />
<title>World Monitor - Real-Time Global Intelligence Dashboard</title>
<meta name="description" content="World Monitor is a dashboard" />
<meta name="application-name" content="World Monitor" />
<meta property="og:url" content="https://www.worldmonitor.app/dashboard" />
<link rel="canonical" href="https://www.worldmonitor.app/dashboard" />
<link rel="preconnect" href="https://api.worldmonitor.app" crossorigin="use-credentials">
<link rel="icon" href="/favico/favicon.ico">
<script type="application/ld+json" nonce="wm-static-bootstrap">{"@id":"https://www.worldmonitor.app/#software"}</script>
<script defer src="https://abacus.worldmonitor.app/script.js" data-website-id="x"></script>
<script defer src="/_vercel/insights/script.js"></script>
<script type="module" crossorigin src="/assets/main-1.js" nonce="wm-static-bootstrap"></script>
</head><body><h1 class="app-heading">World Monitor dashboard</h1>
<section class="app-seo-summary"><p>World Monitor is great</p></section>
<script>var keep = "World Monitor stays inside scripts";</script>
</body></html>`;

test('overlay first, tracking and original-site references gone, name replaced, scripts untouched', () => {
  const out = patch(sample, '9.9.9');
  assert.ok(out.indexOf('/alleyes/alleyes.js?v=9.9.9') < out.indexOf('/assets/main-1.js'));
  assert.match(out, /<meta charset="UTF-8" \/><!--alleyes-config--><script nonce="wm-static-bootstrap" src="\/alleyes\/alleyes\.js/);
  assert.doesNotMatch(out, /abacus|_vercel|ld\+json|canonical|og:url|preconnect|app-seo-summary/);
  assert.match(out, /<title>All Eyes on Me - BizBox<\/title>/);
  assert.match(out, /name="application-name" content="All Eyes on Me"/);
  assert.match(out, /<h1 class="app-heading">All Eyes on Me dashboard<\/h1>/);
  assert.match(out, /var keep = "World Monitor stays inside scripts"/);
  assert.equal((out.match(/rel="icon"/g) || []).length, 1);
  assert.match(out, /href="\/alleyes\/favicon\.svg"/);
});
