import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';
import { buildSync } from 'esbuild';

const bundle = buildSync({
  stdin: {
    contents: "import handler from './edge-functions/api/ip-location.js'; globalThis.edgeHandler = handler;",
    resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'js'
  },
  bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2020'
}).outputFiles[0].text;

function environment({ result = { resultCode: 0, latitude: '27.163578', longitude: '113.971656' }, upstreamStatus = 200, pending = false } = {}) {
  const requests = [], timers = [], cleared = [];
  const context = vm.createContext({
    Response, AbortController, TextEncoder,
    crypto: { subtle: { digest: async (algorithm, data) => {
      assert.equal(algorithm, 'MD5');
      const bytes = createHash('md5').update(data).digest();
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    } } },
    setTimeout(callback, delay) { const timer = { callback, delay }; timers.push(timer); return timer; },
    clearTimeout(timer) { cleared.push(timer); },
    fetch: async (url, options) => {
      requests.push({ url, options });
      if (pending) return new Promise((resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(new Error('Request aborted')), { once: true });
      });
      return { ok: upstreamStatus === 200, status: upstreamStatus, json: async () => result };
    }
  });
  vm.runInContext(bundle, context);
  const request = (ip = '1.1.1.1', method = 'GET') => ({
    request: {
      method, url: 'https://weather.bestguo.top/api/ip-location?ip=8.8.8.8',
      headers: new Headers({ 'EO-Connecting-IP': '8.8.8.8', 'X-Forwarded-For': '8.8.8.8' }),
      eo: ip === null ? undefined : { clientIp: ip }
    }
  });
  return { handler: context.edgeHandler, request, requests, timers, cleared };
}

test('the edge proxy signs the trusted client IP and returns only normalized location fields', async () => {
  const env = environment();
  const response = await env.handler(env.request());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, latitude: 27.163578, longitude: 113.971656, provider: 'toola.hiofd.com' });
  const { url, options } = env.requests[0];
  const payload = JSON.parse(options.body);
  assert.equal(new URL(url).hostname, 'toola.hiofd.com');
  assert.equal(options.method, 'POST');
  assert.equal(payload.body.input.ip, '1.1.1.1');
  assert.equal(payload.x.slice(0, 32), createHash('md5').update(payload.t + 'IpQuery' + payload.t + payload.r + payload.k).digest('hex'));
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store, max-age=0');
  assert.equal(response.headers.get('CDN-Cache-Control'), 'no-store');
  assert.equal(env.cleared.length, 1);
});

test('missing platform IP metadata never queries the edge node or trusts spoofed forwarded headers', async () => {
  const env = environment();
  const response = await env.handler(env.request(null));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, 'client_ip_unavailable');
  assert.equal(env.requests.length, 0);
});

test('unsupported methods are rejected without an upstream query', async () => {
  const env = environment();
  const response = await env.handler(env.request('1.1.1.1', 'POST'));
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('Allow'), 'GET');
  assert.equal(env.requests.length, 0);
});

test('upstream errors and invalid coordinates become a fallback-compatible 503 response', async () => {
  const cases = [
    { upstreamStatus: 500 },
    { result: { resultCode: 1, resultMessage: 'Invalid request' } },
    { result: { resultCode: 0, latitude: '', longitude: 113.97 } },
    { result: { resultCode: 0, latitude: null, longitude: 113.97 } },
    { result: { resultCode: 0, latitude: false, longitude: 113.97 } },
    { result: { resultCode: 0, latitude: 91, longitude: 113.97 } }
  ];
  for (const settings of cases) {
    const env = environment(settings);
    const response = await env.handler(env.request());
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { success: false, error: 'ip_location_unavailable' });
    assert.match(response.headers.get('Cache-Control'), /no-store/);
    assert.equal(env.cleared.length, 1);
  }
});

test('valid zero coordinates and IPv6 client metadata are supported', async () => {
  const env = environment({ result: { resultCode: 0, latitude: 0, longitude: '0' } });
  const response = await env.handler(env.request('2001:4860:4860::8888'));
  assert.equal(response.status, 200);
  assert.equal(JSON.parse(env.requests[0].options.body).body.input.ip, '2001:4860:4860::8888');
  assert.equal((await response.json()).latitude, 0);
});

test('slow upstream queries are aborted before the browser fallback timeout', async () => {
  const env = environment({ pending: true });
  const pendingResponse = env.handler(env.request());
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(env.timers[0].delay, 4000);
  env.timers[0].callback();
  const response = await pendingResponse;
  assert.equal(response.status, 503);
  assert.equal(env.requests[0].options.signal.aborted, true);
  assert.equal(env.cleared.length, 1);
});
