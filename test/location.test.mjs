import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';
import { buildSync } from 'esbuild';

const sourceDir = fileURLToPath(new URL('../src/', import.meta.url));
const source = readFileSync(new URL('../src/script.ts', import.meta.url), 'utf8');
const bundle = buildSync({
  stdin: { contents: source + '\nglobalThis.weatherTest = { state, elements, useLocation, applyLanguage };', resolveDir: sourceDir, sourcefile: 'script.ts', loader: 'ts' },
  bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2020'
}).outputFiles[0].text;

function environment({ errorCode, errorMessage = 'Network location service unavailable', ipFails = false, proxyFails = true, proxyResponse = { success: true, latitude: 27.163578, longitude: 113.971656 }, accuracy = 18, insecure = false, unsupported = false, approximateUnavailable = false, autoLocate = true, readsAccuracyMode = true, delayedInitialIp = false, mobile = true } = {}) {
  const nodes = new Map();
  const requests = [];
  const fetchOptions = [];
  const options = [];
  let releaseInitialIp;
  const node = selector => {
    if (!nodes.has(selector)) nodes.set(selector, {
      hidden: false, open: false, disabled: false, textContent: '', value: '', dataset: {}, listeners: {},
      style: { setProperty() {} }, setAttribute() {}, getAttribute() { return 'false'; }, querySelectorAll() { return []; },
      replaceChildren() {}, append() {}, addEventListener(name, listener) { this.listeners[name] = listener; }
    });
    return nodes.get(selector);
  };
  const geolocation = {
    getCurrentPosition(success, failure, settings) {
      options.push(settings);
      const mode = readsAccuracyMode ? settings.accuracyMode : undefined;
      if (approximateUnavailable && mode !== 'precise') failure({ code: 2, message: 'Cannot generate approximate location.' });
      else if (errorCode) failure({ code: errorCode, message: errorMessage });
      else success({ coords: { latitude: 27.13, longitude: 113.96, accuracy }, timestamp: 1791345600000 });
    }
  };
  const context = {
    console, URL, URLSearchParams, Intl, Date, AbortController,
    navigator: { ...(unsupported ? {} : { geolocation }), userActivation: { isActive: true }, userAgent: mobile ? 'Mobile Edge test browser; Android 14' : 'Desktop Edge test browser' },
    window: { isSecureContext: !insecure, setTimeout: (...args) => setTimeout(...args).unref(), clearTimeout },
    localStorage: { getItem() { return null; }, setItem() {} },
    location: { search: '', href: 'https://weather.bestguo.top/', origin: 'https://weather.bestguo.top' }, history: { replaceState() {} },
    document: { querySelector: node, querySelectorAll: () => [], addEventListener() {}, documentElement: node('html'), body: node('body') },
    fetch: async (url, settings) => {
      requests.push(url);
      fetchOptions.push(settings);
      if (url === '/api/ip-location') {
        if (delayedInitialIp && !releaseInitialIp) return new Promise(resolve => {
          releaseInitialIp = () => resolve({ ok: true, json: async () => ({ success: true, latitude: 30.5928, longitude: 114.3055 }) });
        });
        if (proxyFails || ipFails) return { ok: false, status: 503 };
        return { ok: true, json: async () => proxyResponse };
      }
      if (url.startsWith('https://ipwho.is/') || url.startsWith('https://ipapi.co/')) {
        if (delayedInitialIp && !releaseInitialIp) return new Promise(resolve => {
          releaseInitialIp = () => resolve({ ok: true, json: async () => ({ success: true, latitude: 30.5928, longitude: 114.3055 }) });
        });
        if (ipFails) throw new Error('IP provider unavailable');
        return { ok: true, json: async () => ({ success: true, latitude: 30.5928, longitude: 114.3055 }) };
      }
      const params = new URL(url).searchParams;
      if (url.includes('/geo/1.0/reverse')) {
        const isWuhan = Number(params.get('lat')) > 30;
        return { ok: true, json: async () => [{ name: isWuhan ? 'Wuhan' : 'Lianhua', local_names: { zh: isWuhan ? '武汉市' : '莲花县' }, lat: Number(params.get('lat')), lon: Number(params.get('lon')), country: 'CN' }] };
      }
      if (url.includes('/geo/1.0/direct')) return { ok: true, json: async () => [] };
      if (url.includes('geocoding-api.open-meteo.com')) return { ok: true, json: async () => ({ results: [] }) };
      return { ok: true, json: async () => ({ name: 'Weather response', weather: [{ id: 800, icon: '01d', description: '晴' }], main: { temp: 22, temp_min: 20, temp_max: 24, feels_like: 22, humidity: 55 }, wind: { speed: 1 }, sys: { country: 'CN' }, dt: 1791345600, timezone: 28800 }) };
    }
  };
  vm.createContext(context);
  vm.runInContext(bundle, context);
  if (autoLocate) {
    requests.length = 0;
    context.weatherTest.useLocation({ fallbackToDefault: true });
  }
  return { context, nodes, requests, fetchOptions, options, node, app: context.weatherTest, releaseInitialIp: () => releaseInitialIp() };
}

async function settle() {
  for (let count = 0; count < 12; count++) await new Promise(resolve => setImmediate(resolve));
}

test('browser success keeps the correct coordinates and accuracy, without IP fallback', async () => {
  const env = environment();
  await settle();
  assert.equal(env.node('#city').textContent, '莲花县, CN');
  assert.match(env.node('#location-message').textContent, /已使用浏览器定位/);
  assert.match(env.node('#location-debug').textContent, /113\.96000, 27\.13000/);
  assert.match(env.node('#location-debug').textContent, /±18 米/);
  assert.ok(!env.requests.some(url => url.includes('ipwho.is')));
  assert.equal(env.options[0].enableHighAccuracy, true);
  assert.equal(env.options[0].maximumAge, 0);
  assert.equal(env.options[0].timeout, 30000);
  assert.equal(env.options[0].accuracyMode, 'precise');
  for (const url of env.requests) {
    assert.ok(!new URL(url).searchParams.has('accuracy'));
    assert.ok(!new URL(url).searchParams.has('timestamp'));
  }
});

test('opening the page uses a labelled IP estimate without requesting device permission', async () => {
  const env = environment({ autoLocate: false });
  await settle();
  assert.equal(env.options.length, 0);
  assert.match(env.node('#location-message').textContent, /IP 估算/);
  assert.match(env.node('#location-message').textContent, /点击/);
  assert.doesNotMatch(env.node('#location-message').textContent, /浏览器定位失败/);
  assert.doesNotMatch(env.node('#location-debug').textContent, /enableHighAccuracy/);
});

test('mobile startup uses the same-origin EdgeOne location before third-party IP providers', async () => {
  const env = environment({ autoLocate: false, proxyFails: false });
  await settle();
  assert.equal(env.options.length, 0);
  assert.equal(env.node('#city').textContent, '莲花县, CN');
  assert.match(env.node('#location-message').textContent, /IP 估算/);
  assert.match(env.node('#location-debug').textContent, /113\.97166, 27\.16358/);
  assert.match(env.node('#location-debug').textContent, /toola\.hiofd\.com \(EdgeOne\)/);
  assert.equal(env.requests[0], '/api/ip-location');
  assert.equal(env.fetchOptions[0].cache, 'no-store');
  assert.ok(!env.requests.some(url => url.includes('ipwho.is') || url.includes('ipapi.co')));
});

test('an unavailable EdgeOne endpoint falls back to the existing IP provider', async () => {
  const env = environment({ autoLocate: false });
  await settle();
  assert.equal(env.requests[0], '/api/ip-location');
  assert.equal(env.requests[1], 'https://ipwho.is/');
  assert.equal(env.node('#city').textContent, '武汉市, CN');
  assert.match(env.node('#location-debug').textContent, /ipwho\.is/);
});

test('empty proxy coordinates are rejected instead of locating the user at zero', async () => {
  const env = environment({ autoLocate: false, proxyFails: false, proxyResponse: { success: true, latitude: '', longitude: 113.97 } });
  await settle();
  assert.equal(env.node('#city').textContent, '武汉市, CN');
  assert.match(env.node('#location-debug').textContent, /ipwho\.is/);
});

test('EdgeOne fallback retains the original browser error', async () => {
  const env = environment({ errorCode: 2, proxyFails: false });
  await settle();
  assert.equal(env.node('#city').textContent, '莲花县, CN');
  assert.match(env.node('#location-debug').textContent, /错误码: 2/);
  assert.match(env.node('#location-debug').textContent, /toola\.hiofd\.com \(EdgeOne\)/);
});

test('desktop startup still obtains device location automatically', async () => {
  const env = environment({ mobile: false, autoLocate: false });
  await settle();
  assert.equal(env.node('#city').textContent, '莲花县, CN');
  assert.equal(env.options.length, 1);
  assert.match(env.node('#location-debug').textContent, /打开页面时的设备定位/);
  assert.ok(!env.requests.some(url => url.includes('ipwho.is')));
});

test('the location button requests device location and records the browser context', async () => {
  const env = environment({ autoLocate: false });
  await settle();
  env.requests.length = 0;
  await env.node('#location-button').listeners.click();
  assert.equal(env.node('#city').textContent, '莲花县, CN');
  assert.match(env.node('#location-debug').textContent, /用户点击激活: true/);
  assert.match(env.node('#location-debug').textContent, /精确模式选项: true/);
  assert.match(env.node('#location-debug').textContent, /Mobile Edge test browser/);
  assert.ok(!env.requests.some(url => url.includes('ipwho.is')));
});

test('older browsers can ignore accuracyMode and still return a device position', async () => {
  const env = environment({ readsAccuracyMode: false });
  await settle();
  assert.equal(env.node('#city').textContent, '莲花县, CN');
  assert.match(env.node('#location-debug').textContent, /精确模式选项: false/);
});

test('a slow initial IP response cannot overwrite a successful device-location click', async () => {
  const env = environment({ autoLocate: false, delayedInitialIp: true });
  assert.equal(env.node('#location-button').disabled, false);
  await env.node('#location-button').listeners.click();
  assert.equal(env.node('#city').textContent, '莲花县, CN');
  env.releaseInitialIp();
  await settle();
  assert.equal(env.node('#city').textContent, '莲花县, CN');
  assert.match(env.node('#location-message').textContent, /已使用浏览器定位/);
});

function comparisonPage() {
  const html = readFileSync(new URL('../src/location-test.html', import.meta.url), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const nodes = new Map(['#reference-test', '#precise-test', '#test-status', '#test-result'].map(key => [key, {
    textContent: '', disabled: false, listeners: {}, addEventListener(name, listener) { this.listeners[name] = listener; }
  }]));
  const calls = [];
  const context = {
    Date, JSON, Object,
    document: { querySelector: key => nodes.get(key), querySelectorAll: () => [nodes.get('#reference-test'), nodes.get('#precise-test')] },
    location: { origin: 'https://weather.bestguo.top' }, window: { isSecureContext: true },
    navigator: { userAgent: 'Mobile Edge test browser', userActivation: { isActive: true }, geolocation: {
      getCurrentPosition(success, failure, options) {
        calls.push({ enableHighAccuracy: options.enableHighAccuracy, maximumAge: options.maximumAge,
          timeout: options.timeout, accuracyMode: options.accuracyMode });
        failure({ code: 2, message: 'Cannot generate approximate location.' });
      }
    } },
    fetch: () => { throw new Error('The comparison page must not request IP or weather data'); }
  };
  vm.createContext(context);
  vm.runInContext(script, context);
  return { nodes, calls };
}

test('the direct comparison waits for a click and matches the GeoQux options exactly', () => {
  const page = comparisonPage();
  assert.equal(page.calls.length, 0);
  page.nodes.get('#reference-test').listeners.click({ isTrusted: true });
  assert.deepEqual(page.calls[0], { enableHighAccuracy: true, maximumAge: 0, timeout: 10000, accuracyMode: undefined });
  const result = JSON.parse(page.nodes.get('#test-result').textContent);
  assert.equal(result.errorMessage, 'Cannot generate approximate location.');
  assert.equal(result.trustedClick, true);
});

test('the precise comparison records accuracyMode consumption and the original browser failure', () => {
  const page = comparisonPage();
  page.nodes.get('#precise-test').listeners.click({ isTrusted: true });
  assert.equal(page.calls[0].accuracyMode, 'precise');
  const result = JSON.parse(page.nodes.get('#test-result').textContent);
  assert.equal(result.browserReadAccuracyMode, true);
  assert.equal(result.errorCode, 2);
  assert.match(page.nodes.get('#test-status').textContent, /没有使用 IP 回退/);
});

test('a browser that rejects approximate requests receives a precise request and does not fall back to IP', async () => {
  const env = environment({ approximateUnavailable: true });
  await settle();
  assert.equal(env.node('#city').textContent, '莲花县, CN');
  assert.match(env.node('#location-message').textContent, /已使用浏览器定位/);
  assert.match(env.node('#location-debug').textContent, /enableHighAccuracy=true/);
  assert.ok(!env.requests.some(url => url.includes('ipwho.is') || url.includes('ipapi.co')));
});

test('the reported Android approximate-location error is retained if the browser still returns it', async () => {
  const env = environment({ errorCode: 2, errorMessage: 'Cannot generate approximate location.' });
  await settle();
  assert.match(env.node('#location-debug').textContent, /错误码: 2/);
  assert.match(env.node('#location-debug').textContent, /Cannot generate approximate location\./);
  assert.match(env.node('#location-message').textContent, /IP 估算/);
});

for (const [code, description] of [[1, '定位权限被拒绝'], [2, '无法获取位置'], [3, '请求超时']]) {
  test(`browser error ${code} remains visible after IP weather has rendered`, async () => {
    const env = environment({ errorCode: code });
    await settle();
    assert.equal(env.node('#city').textContent, '武汉市, CN');
    assert.equal(env.node('#status').textContent, '');
    assert.match(env.node('#location-message').textContent, new RegExp(description));
    assert.match(env.node('#location-message').textContent, /IP 估算/);
    assert.match(env.node('#location-debug').textContent, new RegExp(`错误码: ${code}`));
    assert.match(env.node('#location-debug').textContent, /Network location service unavailable/);
    assert.match(env.node('#location-debug').textContent, /ipwho\.is/);
    assert.equal(env.node('#location-details').open, true);
  });
}

test('both IP failures retain browser error and explain the default-place fallback', async () => {
  const env = environment({ errorCode: 2, ipFails: true });
  await settle();
  assert.match(env.node('#location-message').textContent, /无法获取位置/);
  assert.match(env.node('#location-message').textContent, /IP 定位也失败/);
  assert.match(env.node('#location-message').textContent, /默认地点/);
  assert.match(env.node('#location-debug').textContent, /错误码: 2/);
  assert.ok(env.requests.some(url => url.includes('ipapi.co')));
});

test('successful retry removes the old browser failure and IP source', async () => {
  const env = environment({ errorCode: 2 });
  await settle();
  env.context.navigator.geolocation.getCurrentPosition = success => success({ coords: { latitude: 27.13, longitude: 113.96, accuracy: 12 }, timestamp: Date.now() });
  await env.app.useLocation();
  assert.match(env.node('#location-message').textContent, /已使用浏览器定位/);
  assert.doesNotMatch(env.node('#location-debug').textContent, /错误码|ipwho/);
  assert.equal(env.node('#location-details').open, false);
  assert.equal(env.node('#location-feedback').dataset.warning, 'false');
});

test('changing language keeps the original error and translates its explanation', async () => {
  const env = environment({ errorCode: 2 });
  await settle();
  for (const language of ['en', 'es', 'fr', 'ja']) {
    env.app.state.lang = language;
    env.app.applyLanguage();
    assert.doesNotMatch(env.node('#location-message').textContent, /undefined/);
    assert.match(env.node('#location-debug').textContent, /Network location service unavailable/);
  }
  assert.match(env.node('#location-message').textContent, /IP/);
});

test('manual search hides the previous location diagnostics', async () => {
  const env = environment({ errorCode: 2 });
  await settle();
  env.node('#city-search').value = 'Lianhua,CN';
  env.node('.search-form').listeners.submit({ preventDefault() {} });
  await settle();
  assert.equal(env.node('#location-feedback').hidden, true);
});

test('insecure context is distinguished from browser permission errors', async () => {
  const env = environment({ insecure: true });
  await settle();
  assert.match(env.node('#location-message').textContent, /需要安全连接/);
  assert.match(env.node('#location-debug').textContent, /secure context/);
});

test('missing browser geolocation is distinguished from position unavailable', async () => {
  const env = environment({ unsupported: true });
  await settle();
  assert.match(env.node('#location-message').textContent, /浏览器不支持定位/);
});
