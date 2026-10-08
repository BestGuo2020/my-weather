import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { createIpQueryRequest, queryIp } from '../tools/hiofd-ip-query.mjs';

test('the decoded signature formula matches captured frontend requests', () => {
  const captures = [
    { k: 's5tecfvi0q7u3labggaxx7kianfak3gc', t: '91791422840659140135', r: '8x8yq87toyixpjtb22v2mafp65vtrlem', x: '38a70ff86337a0639d91a9231d79d543mehh1d81' },
    { k: '15ocqi5lsgjan6ffbrnwo14k4x9x2o66', t: '41791423228741138135', r: 'z3het318rgfoxa9v3w3n8558dq28oewp', x: '899e7f86a1fddfc7c996622619efb395dynvnkae' }
  ];
  for (const { k, t, r, x } of captures) {
    assert.equal(createHash('md5').update(t + 'IpQuery' + t + r + k).digest('hex'), x.slice(0, 32));
    assert.equal(t.slice(-6, -3), [...'5cs'].map(marker => k.slice(0, 10).indexOf(marker)).join(''));
  }
});

test('fresh requests support explicit IPv4, IPv6 and caller-IP lookup', () => {
  for (const ip of [undefined, '1.1.1.1', '2001:4860:4860::8888']) {
    const request = createIpQueryRequest(ip, { now: () => 1791423228741 });
    const { k, t, r, x, body } = request.payload;
    assert.deepEqual(body.input, ip === undefined ? {} : { ip });
    assert.equal(k.length, 32);
    assert.equal(r.length, 32);
    assert.match(x, /^[0-9a-f]{32}[0-9a-z]{8}$/);
    assert.match(t, /^\d1791423228741\d{3}135$/);
    assert.equal(t.slice(-6, -3), [...'5cs'].map(marker => k.slice(0, 10).indexOf(marker)).join(''));
    assert.equal(new URL(request.url).searchParams.get('r'), t);
    assert.equal(x.slice(0, 32), createHash('md5').update(t + 'IpQuery' + t + r + k).digest('hex'));
  }
  assert.throws(() => createIpQueryRequest('localhost'), /valid IPv4 or IPv6/);
});

test('queryIp sends the generated POST and accepts a successful response', async () => {
  let captured;
  const result = { resultCode: 0, ip: '1.1.1.1', latitude: '0', longitude: '0' };
  const response = await queryIp('1.1.1.1', { fetchImpl: async (url, options) => {
    captured = { url, options };
    return { ok: true, json: async () => result };
  } });
  assert.equal(response, result);
  assert.equal(captured.options.method, 'POST');
  assert.equal(JSON.parse(captured.options.body).body.input.ip, '1.1.1.1');
  assert.equal(captured.options.headers['Content-Type'], 'application/json; charset=utf-8');
  assert.equal(captured.options.signal.aborted, false);
});

test('HTTP and service errors are reported instead of accepted as location data', async () => {
  await assert.rejects(queryIp('1.1.1.1', { fetchImpl: async () => ({ ok: false, status: 503 }) }), /HTTP 503/);
  await assert.rejects(queryIp('1.1.1.1', { fetchImpl: async () => ({ ok: true, json: async () => ({ resultCode: 1, resultMessage: 'Invalid request' }) }) }), /Invalid request/);
});
