/*
 * All Eyes on Me - saved World Clock cities (BizBox overlay, AGPL-3.0, same licence as the rest of this repo).
 *
 * Problem: the upstream World Clock keeps its cities only in browser storage. A new browser, cleared site data or a VPN
 * timezone then shows the six default cities plus a "home city" taken from the browser timezone (e.g. Singapore).
 *
 * Fix, in the order it runs (this file loads right after alleyes.js, before the upstream app reads anything):
 *  1. On load it reads GET /worldmonitor/auth/prefs (the BizBox gateway, per owner) BEFORE browser storage. If the owner has
 *     saved cities, they are written into browser storage, so the upstream panel finds a saved list and never falls back to
 *     the defaults or to the browser-timezone home city.
 *  2. Whenever the panel saves its cities (a localStorage write of the clock key) it also PUTs the list to the gateway.
 *  3. If the gateway has nothing yet but this browser already has a list, that list is sent up once (so it is not lost).
 * Any failure (signed out, gateway without WM_PREFS_DIR, offline) leaves the upstream behaviour exactly as it was.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else if (root && root.document) api.install(root);
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  var KEY = 'worldmonitor-world-clock-cities';
  var DEFAULT_URL = '/worldmonitor/auth/prefs';

  function clean(list) {
    if (!Array.isArray(list) || list.length === 0 || list.length > 40) return null;
    for (var i = 0; i < list.length; i++) if (typeof list[i] !== 'string' || !/^[a-z0-9-]{1,40}$/.test(list[i])) return null;
    return list.filter(function (c, i) { return list.indexOf(c) === i; });
  }
  function parse(raw) { try { return clean(JSON.parse(raw)); } catch (e) { return null; } }

  function install(win, opts) {
    opts = opts || {};
    var url = opts.url || DEFAULT_URL;
    var result = { loaded: false, source: 'browser' };
    var store;
    try { store = win.localStorage; if (!store) return result; } catch (e) { return result; }

    function put(ids) {
      try {
        win.fetch(url, { method: 'PUT', credentials: 'same-origin', keepalive: true, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ worldClockCities: ids }) }).catch(function () {});
      } catch (e) { /* best effort */ }
    }

    // 1. saved cities from the gateway come first. A synchronous read is deliberate: it must finish before the app starts.
    var saved = null;
    try {
      var xhr = new win.XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.withCredentials = true;
      xhr.send();
      if (xhr.status === 200) { var body = JSON.parse(xhr.responseText || '{}'); saved = clean(body && body.worldClockCities); }
    } catch (e) { saved = null; }

    if (saved) {
      try { store.setItem(KEY, JSON.stringify(saved)); result.loaded = true; result.source = 'gateway'; } catch (e) { /* storage unusable */ }
    } else {
      // 3. nothing on the gateway yet: keep this browser's list and send it up once.
      var local = null;
      try { local = parse(store.getItem(KEY)); } catch (e) { local = null; }
      if (local) put(local);
    }

    // 2. every later save of the clock key is sent to the gateway too.
    try {
      var current = win.localStorage;
      var wrapped = new Proxy(current, {
        get: function (target, prop) {
          if (prop === 'setItem') return function (k, v) { target.setItem(k, v); if (k === KEY) { var ids = parse(v); if (ids) put(ids); } };
          var value = target[prop];
          return typeof value === 'function' ? value.bind(target) : value;
        },
        set: function (target, prop, v) { target[prop] = v; if (prop === KEY) { var ids = parse(String(v)); if (ids) put(ids); } return true; }
      });
      Object.defineProperty(win, 'localStorage', { configurable: true, get: function () { return wrapped; } });
    } catch (e) { /* the clock still works from browser storage */ }
    return result;
  }
  return { install: install, KEY: KEY, clean: clean };
});
