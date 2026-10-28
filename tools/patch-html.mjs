// Build-time patch for the World Monitor HTML entry pages (AGPL-3.0, see LICENSE).
// Usage: node patch-html.mjs <html dir> [overlay version]
// - loads the All Eyes on Me overlay first in <head>
// - removes upstream analytics, structured data that names the original site, and canonical/social URLs
// - sets the name, description and icon
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const NAME = 'All Eyes on Me';
const DESCRIPTION = 'All Eyes on Me: the BizBox live world view. Intelligence map, public cameras and live layers on one screen.';
const NONCE = 'wm-static-bootstrap'; // the upstream page policy already trusts this static bootstrap nonce

export function patch(html, version = '1.0.0') {
  const injected = `<!--alleyes-config--><script nonce="${NONCE}" src="/alleyes/alleyes.js?v=${version}"></script><link rel="stylesheet" href="/alleyes/alleyes.css?v=${version}">`;
  let out = html;
  // 1. analytics and tracking scripts
  out = out.replace(/<script\b[^>]*\bsrc="[^"]*(abacus\.worldmonitor\.app|_vercel\/insights|vercel-scripts\.com|sentry)[^"]*"[^>]*>\s*<\/script>/gi, '');
  // 2. structured data naming the original site
  out = out.replace(/<script\b[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/gi, '');
  // 3. canonical, alternate and social URLs/images that point at the original site
  out = out.replace(/<link\b[^>]*rel="(canonical|alternate)"[^>]*>/gi, '');
  out = out.replace(/<meta\b[^>]*(property|name)="(og:url|og:image[^"]*|twitter:url|twitter:image[^"]*|twitter:site|twitter:creator|author)"[^>]*>/gi, '');
  // 3b. connections the browser would open to the original site before any script runs
  out = out.replace(/<link\b[^>]*rel="(preconnect|dns-prefetch|prefetch)"[^>]*worldmonitor\.app[^>]*>/gi, '');
  out = out.replace(/<li>\s*<a\b[^>]*href="https:\/\/github\.com\/koala73[^"]*"[^>]*>[\s\S]*?<\/a>\s*<\/li>/gi, '');
  out = out.replace(/<section class="app-seo-summary">[\s\S]*?<\/section>/i, '');
  out = out.replace(/<noscript>\s*<main id="dashboard-noscript"[\s\S]*?<\/main>\s*<\/noscript>/i, '<noscript><main id="dashboard-noscript"><h2>All Eyes on Me needs JavaScript for the live map.</h2></main></noscript>');
  // 3c. static (pre-JavaScript) text uses our name; scripts and styles are left byte for byte
  out = out.split(/(<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>)/i)
    .map((part, i) => (i % 2 ? part : part.replace(/WORLD\s?MONITOR/g, 'ALL EYES ON ME').replace(/World\s?Monitor/g, NAME)))
    .join('');
  // 4. name, description, icons
  out = out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${NAME} - BizBox</title>`);
  out = out.replace(/(<meta\b[^>]*(?:name="description"|property="og:description"|name="twitter:description")[^>]*content=")[^"]*(")/gi, `$1${DESCRIPTION}$2`);
  out = out.replace(/(<meta\b[^>]*(?:property="og:title"|name="twitter:title")[^>]*content=")[^"]*(")/gi, `$1${NAME} - BizBox$2`);
  out = out.replace(/(<meta\b[^>]*property="og:site_name"[^>]*content=")[^"]*(")/gi, `$1${NAME}$2`);
  out = out.replace(/(<meta\b[^>]*name="(?:title|application-name|apple-mobile-web-app-title)"[^>]*content=")[^"]*(")/gi, `$1${NAME}$2`);
  out = out.replace(/<link\b[^>]*rel="(icon|shortcut icon|apple-touch-icon)"[^>]*>/gi, '');
  // 5. the overlay goes in first (after the charset meta so the encoding stays within the first bytes)
  const icon = '<link rel="icon" type="image/svg+xml" href="/alleyes/favicon.svg"><link rel="apple-touch-icon" href="/alleyes/favicon.svg">';
  const charset = /<meta\b[^>]*charset[^>]*>/i.exec(out);
  if (charset) out = out.slice(0, charset.index + charset[0].length) + injected + icon + out.slice(charset.index + charset[0].length);
  else out = out.replace(/<head[^>]*>/i, (m) => m + injected + icon);
  return out;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const dir = process.argv[2];
  const version = process.argv[3] || '1.0.0';
  if (!dir) throw new Error('usage: patch-html.mjs <html dir> [version]');
  const files = (await readdir(dir)).filter((f) => /^dashboard(-[a-z]+)?\.html$/.test(f));
  if (!files.includes('dashboard.html')) throw new Error('dashboard.html not found in ' + dir);
  for (const f of files) {
    const path = join(dir, f);
    const before = await readFile(path, 'utf8');
    const after = patch(before, version);
    if (!after.includes('/alleyes/alleyes.js')) throw new Error('overlay was not injected into ' + f);
    if (/abacus\.worldmonitor\.app|_vercel\/insights/.test(after)) throw new Error('tracking script still present in ' + f);
    await writeFile(path, after);
    console.log('patched', f, before.length, '->', after.length);
  }
}
