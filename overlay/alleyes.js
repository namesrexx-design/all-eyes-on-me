/*
 * All Eyes on Me - BizBox overlay for World Monitor.
 *
 * Built on World Monitor by Elie Habib (https://github.com/koala73/worldmonitor), AGPL-3.0.
 * This file is part of the modified version published at
 * https://github.com/namesrexx-design/all-eyes-on-me and is licensed under the same AGPL-3.0.
 *
 * What it does, in order:
 *  1. Reads the gateway-provided config (<meta name="alleyes-config">).
 *  2. Network guard: nothing leaves for the original site, its analytics, error reporting,
 *     sign-in or payment providers. Static map data it needs is served from this service.
 *  3. Keeps each BizBox member's saved layout separate (the browser storage is namespaced by user).
 *  4. Rebrands the interface and removes accounts, upgrade prompts, Embed/Link and the footer.
 *  5. Adds Share (a BizBox link), About (credits + source link) and the map-style switch.
 *  6. Talks to the BizBox shell around it through a small, origin-checked postMessage API.
 */
(function () {
  'use strict';
  var NAME = 'All Eyes on Me';
  var SOURCE_URL = 'https://github.com/namesrexx-design/all-eyes-on-me';
  var UPSTREAM_URL = 'https://github.com/koala73/worldmonitor';
  var DEFAULTS = {
    user: '',
    parents: ['https://biz-box.io', 'https://www.biz-box.io'],
    shareBase: 'https://biz-box.io/alleyes',
    version: '1.0.0',
    upstream: 'World Monitor v2.11.6 (2f7d292)'
  };
  var CFG = DEFAULTS;
  try {
    var meta = document.querySelector('meta[name="alleyes-config"]');
    if (meta) CFG = Object.assign({}, DEFAULTS, JSON.parse(meta.getAttribute('content')));
  } catch (e) { CFG = DEFAULTS; }

  /* ---------- 2. network guard ---------- */
  var BLOCKED_HOST = /(^|\.)(worldmonitor\.app|sentry\.io|sentry-cdn\.com|sentry\.dev|vercel-scripts\.com|vercel\.live|vercel\.com|clerk\.accounts\.dev|clerk\.com|clerk\.dev|dodopayments\.com|stripe\.com|stripe\.network|convex\.cloud|convex\.site|beehiiv\.com|plausible\.io|posthog\.com|umami\.is|googletagmanager\.com|google-analytics.com|debugbear.com|datadoghq.com)$/i;
  var LOCAL_COPIES = {
    'https://maps.worldmonitor.app/country-boundary-overrides.geojson': '/alleyes/data/country-boundary-overrides.geojson'
  };
  function hostOf(u) {
    try { return new URL(String(u), location.href).host; } catch (e) { return ''; }
  }
  function absolute(u) {
    try { return new URL(String(u), location.href).href; } catch (e) { return String(u); }
  }
  function blocked(u) {
    var h = hostOf(u);
    return !!h && h !== location.host && BLOCKED_HOST.test(h.replace(/:\d+$/, ''));
  }
  function localCopy(u) {
    var a = absolute(u).split('#')[0].split('?')[0];
    return LOCAL_COPIES[a] || '';
  }
  var blockedCount = 0;
  try {
    var nativeFetch = window.fetch;
    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var copy = localCopy(url);
      if (copy) return nativeFetch.call(window, copy, init);
      if (blocked(url)) { blockedCount++; return Promise.resolve(new Response('{}', { status: 410, headers: { 'content-type': 'application/json' } })); }
      return nativeFetch.apply(window, arguments);
    };
    var nativeOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
      var args = Array.prototype.slice.call(arguments);
      var copy = localCopy(url);
      if (copy) args[1] = copy;
      else if (blocked(url)) { blockedCount++; args[1] = 'data:application/json,%7B%7D'; }
      return nativeOpen.apply(this, args);
    };
    if (navigator.sendBeacon) {
      var nativeBeacon = navigator.sendBeacon.bind(navigator);
      navigator.sendBeacon = function (url, data) { if (blocked(url)) { blockedCount++; return true; } return nativeBeacon(url, data); };
    }
    var NativeWS = window.WebSocket;
    if (NativeWS) {
      window.WebSocket = function (url, protocols) {
        if (blocked(url)) { blockedCount++; throw new DOMException('Blocked by All Eyes on Me', 'SecurityError'); }
        return protocols === undefined ? new NativeWS(url) : new NativeWS(url, protocols);
      };
      window.WebSocket.prototype = NativeWS.prototype;
      ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'].forEach(function (k) { window.WebSocket[k] = NativeWS[k]; });
    }
    // Scripts/images/iframes added by code: neutralise anything pointing at a blocked host.
    var nativeSetAttr = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (name, value) {
      if ((name === 'src' || name === 'href') && /^(SCRIPT|IMG|IFRAME|LINK|EMBED|SOURCE)$/.test(this.tagName) && blocked(value)) { blockedCount++; return; }
      return nativeSetAttr.call(this, name, value);
    };
    ['HTMLScriptElement', 'HTMLImageElement', 'HTMLIFrameElement'].forEach(function (cls) {
      var proto = window[cls] && window[cls].prototype;
      var desc = proto && Object.getOwnPropertyDescriptor(proto, 'src');
      if (desc && desc.set) Object.defineProperty(proto, 'src', { configurable: true, enumerable: desc.enumerable, get: desc.get, set: function (v) { if (blocked(v)) { blockedCount++; return; } desc.set.call(this, v); } });
    });
  } catch (e) { /* the guard is best effort; the gateway CSP is the second wall */ }
  window.__allEyesGuard = function () { return { blocked: blockedCount }; };

  /* ---------- 3. per-user storage ---------- */
  if (CFG.user) {
    try {
      var real = window.localStorage;
      var prefix = 'bb:' + CFG.user + ':';
      var own = function () {
        var out = [];
        for (var i = 0; i < real.length; i++) { var k = real.key(i); if (k && k.indexOf(prefix) === 0) out.push(k.slice(prefix.length)); }
        return out;
      };
      var api = {
        getItem: function (k) { return real.getItem(prefix + k); },
        setItem: function (k, v) { real.setItem(prefix + k, v); },
        removeItem: function (k) { real.removeItem(prefix + k); },
        clear: function () { own().forEach(function (k) { real.removeItem(prefix + k); }); },
        key: function (i) { var list = own(); return i >= 0 && i < list.length ? list[i] : null; }
      };
      var scoped = new Proxy({}, {
        get: function (_t, p) {
          if (p === 'length') return own().length;
          if (typeof p === 'string' && Object.prototype.hasOwnProperty.call(api, p)) return api[p];
          if (typeof p === 'string') { var v = real.getItem(prefix + p); return v === null ? undefined : v; }
          return undefined;
        },
        set: function (_t, p, v) { if (typeof p === 'string') real.setItem(prefix + p, String(v)); return true; },
        deleteProperty: function (_t, p) { if (typeof p === 'string') real.removeItem(prefix + p); return true; },
        has: function (_t, p) { return typeof p === 'string' && (p in api || real.getItem(prefix + p) !== null); },
        ownKeys: function () { return own(); },
        getOwnPropertyDescriptor: function (_t, p) { return typeof p === 'string' && real.getItem(prefix + p) !== null ? { enumerable: true, configurable: true, value: real.getItem(prefix + p) } : undefined; }
      });
      Object.defineProperty(window, 'localStorage', { configurable: true, get: function () { return scoped; } });
    } catch (e) { /* storage stays shared in this browser; nothing breaks */ }
  }

  /* ---------- 4. brand, removals ---------- */
  var REPLACEMENTS = [
    [/WORLD\s?MONITOR/g, 'ALL EYES ON ME'],
    [/World\s?Monitor/gi, NAME],
    [/Digest coverage/g, 'News coverage'],
    [/\bDIGEST\b/g, 'BRIEFING'],
    [/\bdigest(s)?\b/g, 'briefing$1'],
    [/\bDigest(s)?\b/g, 'Briefing$1']
  ];
  function rebrand(text) {
    var out = text;
    for (var i = 0; i < REPLACEMENTS.length; i++) out = out.replace(REPLACEMENTS[i][0], REPLACEMENTS[i][1]);
    return out;
  }
  var SKIP = /^(SCRIPT|STYLE|TEXTAREA|INPUT|CODE|PRE|NOSCRIPT)$/;
  function fixNode(node) {
    if (!node) return;
    if (node.nodeType === 3) {
      var p = node.parentNode;
      if (p && (SKIP.test(p.nodeName) || (p.closest && p.closest('[data-ae-keep]')))) return;
      if (/world\s?monitor|digest/i.test(node.nodeValue)) {
        var next = rebrand(node.nodeValue);
        if (next !== node.nodeValue) node.nodeValue = next;
      }
      return;
    }
    if (node.nodeType !== 1 || SKIP.test(node.nodeName) || (node.closest && node.closest('[data-ae-keep]'))) return;
    var attrs = ['title', 'aria-label', 'alt', 'placeholder'];
    for (var a = 0; a < attrs.length; a++) {
      var v = node.getAttribute(attrs[a]);
      if (v && /world\s?monitor|digest|github/i.test(v)) node.setAttribute(attrs[a], rebrand(v).replace(/View on GitHub/i, 'About'));
    }
    var walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    var t;
    while ((t = walker.nextNode())) fixNode(t);
    var withAttrs = node.querySelectorAll ? node.querySelectorAll('[title],[aria-label],[alt],[placeholder]') : [];
    for (var i = 0; i < withAttrs.length; i++) {
      for (var j = 0; j < attrs.length; j++) {
        var av = withAttrs[i].getAttribute(attrs[j]);
        if (av && /world\s?monitor|digest/i.test(av)) withAttrs[i].setAttribute(attrs[j], rebrand(av));
      }
    }
  }
  function fixTitle() {
    var wanted = NAME + ' - BizBox';
    if (document.title !== wanted) document.title = wanted;
  }

  var REMOVE = [
    '.pro-banner-slot', '.pro-banner', '#proBannerSlot', '.auth-header-widget', '#authWidgetMount', '.auth-signin-btn',
    '.auth-signup-link', '#mobileAuthFallback', '.mobile-auth-fallback', '.site-footer', '.github-link', '.credit-link',
    '.variant-switcher', '#copyLinkBtn', '#embedLinkBtn', '.export-locked-state', '.widget-pro-badge', '.mobile-panel-nav-chip-pro',
    '.ai-widget-block-pro'
  ].join(',');
  var MOBILE_REMOVE_TEXT = /^(@eliehabib|sign in|create account|upgrade to pro|github|download app|pricing|status|blog|docs)$/i;
  function removals(root) {
    var scope = root && root.querySelectorAll ? root : document;
    var list = scope.querySelectorAll(REMOVE);
    for (var i = 0; i < list.length; i++) if (list[i].parentNode) list[i].parentNode.removeChild(list[i]);
    var items = scope.querySelectorAll('.mobile-menu-item, .mobile-menu a, .mobile-menu button');
    for (var k = 0; k < items.length; k++) {
      var label = (items[k].textContent || '').replace(/\s+/g, ' ').trim();
      if (MOBILE_REMOVE_TEXT.test(label) && items[k].parentNode) items[k].parentNode.removeChild(items[k]);
    }
    if (document.documentElement.classList.contains('wm-pro-banner-reserved')) document.documentElement.classList.remove('wm-pro-banner-reserved');
  }

  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'class') n.className = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }

  /* ---------- 5. share, about, map style ---------- */
  var toastTimer;
  function toast(message) {
    var t = document.getElementById('aeToast');
    if (!t) { t = el('div', { id: 'aeToast', role: 'status', 'data-ae-keep': '1' }); document.body.appendChild(t); }
    t.textContent = message;
    t.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('is-on'); }, 2600);
  }
  function shareUrl() {
    var q = location.search.replace(/^\?/, '');
    return CFG.shareBase + (q ? '?v=' + encodeURIComponent(q) : '');
  }
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = el('textarea', { 'data-ae-keep': '1', style: 'position:fixed;opacity:0;left:-999px' });
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy') ? resolve() : reject(new Error('copy')); } catch (e) { reject(e); } finally { ta.remove(); }
    });
  }
  function doShare() {
    var url = shareUrl();
    copyText(url).then(function () { toast('Link copied. It opens this view in All Eyes on Me for BizBox members.'); },
      function () { window.prompt('Copy this BizBox link', url); });
    send('share', { url: url });
  }

  function openAbout() {
    if (document.getElementById('aeAbout')) return;
    var close = el('button', { class: 'ae-x', type: 'button', 'aria-label': 'Close', text: '×' });
    var body = el('div', { class: 'ae-about-card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'aeAboutTitle', 'data-ae-keep': '1' }, [
      close,
      el('img', { src: '/alleyes/logo.svg', alt: '', width: '44', height: '44' }),
      el('h2', { id: 'aeAboutTitle', text: 'About ' + NAME }),
      el('p', { text: NAME + ' is BizBox\'s live world view: the intelligence map, public cameras and live layers on one screen.' }),
      el('h3', { text: 'Credits' }),
      el('p', { text: 'The intelligence map is built on World Monitor by Elie Habib and contributors, free software under the GNU Affero General Public License v3.0 (AGPL-3.0). Copyright © Elie Habib and World Monitor contributors.' }),
      el('p', { text: 'BizBox changed it: new name and look, BizBox sign-in and sharing, and no accounts, newsletters or tracking calls to the original site. The complete source of this modified version is public.' }),
      el('div', { class: 'ae-links' }, [
        el('a', { href: SOURCE_URL, target: '_blank', rel: 'noopener', text: 'Source code of this version' }),
        el('a', { href: UPSTREAM_URL, target: '_blank', rel: 'noopener', text: 'Original World Monitor' }),
        el('a', { href: '/alleyes/LICENSE.txt', target: '_blank', rel: 'noopener', text: 'AGPL-3.0 licence' })
      ]),
      el('p', { class: 'ae-fine', text: NAME + ' ' + CFG.version + ' on ' + CFG.upstream + '.' })
    ]);
    var wrap = el('div', { id: 'aeAbout', 'data-ae-keep': '1' }, [body]);
    function shut() { wrap.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(e) { if (e.key === 'Escape') shut(); }
    close.addEventListener('click', shut);
    wrap.addEventListener('click', function (e) { if (e.target === wrap) shut(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(wrap);
    close.focus();
  }

  var STYLES = ['clean', 'neon', 'cyberpunk', 'gta', 'roblox', 'pixar'];
  function setStyle(id) {
    if (STYLES.indexOf(id) < 0) id = 'clean';
    document.documentElement.setAttribute('data-ae-style', id);
    try { localStorage.setItem('alleyes-style', id); } catch (e) { /* ok */ }
  }

  function mountChrome() {
    var left = document.querySelector('.header-left');
    var right = document.querySelector('.header-right');
    if (left && !document.getElementById('aeBrand')) {
      var brand = el('a', { id: 'aeBrand', href: location.pathname + location.search, 'data-ae-keep': '1', 'aria-label': NAME }, [
        el('img', { src: '/alleyes/logo.svg', alt: '', width: '26', height: '26' }),
        el('b', { text: 'ALL EYES ON ME' })
      ]);
      brand.addEventListener('click', function (e) { e.preventDefault(); });
      left.insertBefore(brand, left.firstChild);
    }
    if (left && !document.getElementById('aeAboutMini')) {
      var mini = el('button', { id: 'aeAboutMini', type: 'button', title: 'About, credits and source', 'aria-label': 'About ' + NAME, 'data-ae-keep': '1', text: 'ⓘ' });
      mini.addEventListener('click', openAbout);
      left.appendChild(mini);
    }
    if (right && !document.getElementById('aeShare')) {
      var share = el('button', { id: 'aeShare', class: 'copy-link-btn ae-btn', type: 'button', title: 'Share this view as a BizBox link', 'data-ae-keep': '1', text: 'Share' });
      share.addEventListener('click', doShare);
      var about = el('button', { id: 'aeAboutBtn', class: 'copy-link-btn ae-btn', type: 'button', title: 'About, credits and source', 'aria-label': 'About ' + NAME, 'data-ae-keep': '1', text: 'About' });
      about.addEventListener('click', openAbout);
      var anchor = document.getElementById('fullscreenBtn');
      right.insertBefore(share, anchor || right.firstChild);
      right.insertBefore(about, anchor || right.firstChild);
    }
  }

  var queued = false, pending = [];
  function flush() {
    queued = false;
    var nodes = pending; pending = [];
    removals(document);
    mountChrome();
    fixTitle();
    for (var i = 0; i < nodes.length; i++) fixNode(nodes[i]);
  }
  function schedule(node) {
    if (node) pending.push(node);
    if (!queued) { queued = true; (window.requestAnimationFrame || setTimeout)(flush, 16); }
  }

  /* ---------- 6. shell bridge ---------- */
  var parentWin = null, parentOrigin = '';
  function send(type, payload) {
    if (!parentWin) return;
    try { parentWin.postMessage(Object.assign({ source: 'alleyes-map', type: type }, payload || {}), parentOrigin); } catch (e) { /* closed */ }
  }
  function activeLayers() {
    return Array.prototype.map.call(document.querySelectorAll('button.layer-toggle.active'), function (b) { return b.getAttribute('data-layer'); });
  }
  function allLayers() {
    return Array.prototype.map.call(document.querySelectorAll('button.layer-toggle'), function (b) { return { id: b.getAttribute('data-layer'), label: (b.textContent || '').replace(/\s+/g, ' ').trim(), on: b.classList.contains('active') }; });
  }
  function toggleLayer(id, on) {
    var b = document.querySelector('button.layer-toggle[data-layer="' + String(id).replace(/[^A-Za-z0-9_-]/g, '') + '"]');
    if (b && b.classList.contains('active') !== !!on) b.click();
  }
  window.addEventListener('message', function (e) {
    if (CFG.parents.indexOf(e.origin) < 0 || !e.data || e.data.source !== 'alleyes-shell') return;
    var d = e.data;
    if (d.type === 'hello') { parentWin = e.source; parentOrigin = e.origin; send('ready', { version: CFG.version, style: document.documentElement.getAttribute('data-ae-style'), layers: allLayers(), search: location.search }); }
    else if (d.type === 'style') { setStyle(d.id); }
    else if (d.type === 'layer') { toggleLayer(d.id, d.on); }
  });
  var lastSearch = '', lastLayers = '';
  setInterval(function () {
    if (!parentWin) return;
    if (location.search !== lastSearch) { lastSearch = location.search; send('view', { search: lastSearch }); }
    var layers = JSON.stringify(allLayers());
    if (layers !== lastLayers) { lastLayers = layers; send('layers', { layers: allLayers() }); }
  }, 1200);

  /* ---------- boot ---------- */
  // Inside the BizBox shell the shell itself carries the name, Share and About, so the service shows only the map controls.
  if (window.top !== window) document.documentElement.classList.add('ae-embedded');
  // The first-run workspace chooser would cover the map every time a new member opens the module; the Mission button stays.
  try { if (!localStorage.getItem('worldmonitor-mission-preset-dismissed-v1')) localStorage.setItem('worldmonitor-mission-preset-dismissed-v1', '1'); } catch (e) { /* ok */ }
  var saved = 'clean';
  try { saved = localStorage.getItem('alleyes-style') || 'clean'; } catch (e) { /* ok */ }
  setStyle(saved);
  function start() {
    removals(document); mountChrome(); fixTitle(); fixNode(document.body);
    new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (m.type === 'characterData') schedule(m.target);
        else for (var j = 0; j < m.addedNodes.length; j++) schedule(m.addedNodes[j]);
      }
    }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    var titleEl = document.querySelector('title');
    if (titleEl) new MutationObserver(fixTitle).observe(titleEl, { childList: true, characterData: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
