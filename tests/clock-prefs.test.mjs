import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { install, KEY } = createRequire(import.meta.url)('../overlay/clock-prefs.js');

// A small fake browser: storage, a synchronous XMLHttpRequest answered by `gateway`, and fetch that records PUT calls.
function browser({ gateway, stored } = {}) {
  const data = new Map(stored ? [[KEY, stored]] : []);
  const storage = { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => void data.set(k, String(v)), removeItem: (k) => void data.delete(k) };
  const calls = { get: 0, put: [] };
  class XHR {
    open(m, u, async) { assert.equal(m, 'GET'); assert.equal(u, '/worldmonitor/auth/prefs'); assert.equal(async, false); }
    send() { calls.get++; if (!gateway) throw new Error('network'); this.status = gateway.status; this.responseText = gateway.body; }
  }
  const win = { localStorage: storage, XMLHttpRequest: XHR, fetch: (u, init) => { calls.put.push({ u, init, body: JSON.parse(init.body) }); return Promise.resolve({}); } };
  return { win, data, calls };
}
const ok = (cities) => ({ status: 200, body: JSON.stringify({ worldClockCities: cities }) });

test('saved gateway cities win over browser storage and over the timezone home city (no Singapore)', () => {
  const b = browser({ gateway: ok(['new-york', 'london', 'tokyo']), stored: JSON.stringify(['singapore', 'dubai']) });
  const r = install(b.win);
  assert.equal(r.source, 'gateway');
  assert.deepEqual(JSON.parse(b.win.localStorage.getItem(KEY)), ['new-york', 'london', 'tokyo']);
  assert.equal(b.calls.get, 1);
  assert.deepEqual(b.calls.put, [], 'loading must not write back what it just read');
});

test('a fresh browser with saved cities on the gateway gets them, so the upstream panel never falls back to defaults + home city', () => {
  const b = browser({ gateway: ok(['los-angeles', 'new-york']) });
  install(b.win);
  assert.deepEqual(JSON.parse(b.data.get(KEY)), ['los-angeles', 'new-york']);
});

test('saving cities in the panel PUTs them to the gateway', () => {
  const b = browser({ gateway: { status: 200, body: '{}' } });
  install(b.win);
  b.win.localStorage.setItem(KEY, JSON.stringify(['paris', 'zurich']));
  assert.equal(b.calls.put.length, 1);
  assert.equal(b.calls.put[0].u, '/worldmonitor/auth/prefs');
  assert.equal(b.calls.put[0].init.method, 'PUT');
  assert.equal(b.calls.put[0].init.credentials, 'same-origin');
  assert.deepEqual(b.calls.put[0].body, { worldClockCities: ['paris', 'zurich'] });
  b.win.localStorage.setItem('other-key', '1');
  assert.equal(b.calls.put.length, 1, 'only the clock key is sent');
});

test('gateway empty but browser has a list: the list is sent up once', () => {
  const b = browser({ gateway: { status: 200, body: '{}' }, stored: JSON.stringify(['tokyo', 'sydney']) });
  const r = install(b.win);
  assert.equal(r.source, 'browser');
  assert.deepEqual(b.calls.put.map((c) => c.body), [{ worldClockCities: ['tokyo', 'sydney'] }]);
});

test('signed out (401), no gateway, or bad data: browser storage is left alone and nothing breaks', () => {
  for (const gateway of [{ status: 401, body: '' }, { status: 503, body: '' }, { status: 200, body: 'not json' }, { status: 200, body: JSON.stringify({ worldClockCities: ['Bad City!'] }) }, undefined]) {
    const b = browser({ gateway, stored: JSON.stringify(['dubai']) });
    install(b.win);
    assert.deepEqual(JSON.parse(b.data.get(KEY)), ['dubai']);
  }
});
