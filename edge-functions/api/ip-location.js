import { createHiofdRequest } from '../../lib/hiofd-request.js';

const HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'private, no-store, max-age=0',
  'CDN-Cache-Control': 'no-store'
};

function reply(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...HEADERS, ...extraHeaders } });
}

async function md5(text) {
  const digest = await crypto.subtle.digest('MD5', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function coordinate(value, limit) {
  if (typeof value !== 'number' && (typeof value !== 'string' || value.trim() === '')) return null;
  const number = Number(value);
  return Number.isFinite(number) && Math.abs(number) <= limit ? number : null;
}

export default async function onRequest({ request }) {
  if (request.method !== 'GET') return reply({ success: false, error: 'method_not_allowed' }, 405, { Allow: 'GET' });

  // This platform-provided value cannot be replaced by a caller's query or forwarded headers.
  const ip = request.eo?.clientIp;
  if (typeof ip !== 'string' || !ip.trim()) return reply({ success: false, error: 'client_ip_unavailable' }, 503);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const query = await createHiofdRequest(ip, md5);
    const response = await fetch(query.url, {
      method: 'POST', headers: query.headers, body: JSON.stringify(query.payload),
      signal: controller.signal, redirect: 'error'
    });
    if (!response.ok) throw new Error('Upstream request failed');
    const result = await response.json();
    const latitude = coordinate(result.latitude, 90), longitude = coordinate(result.longitude, 180);
    if (result.resultCode !== 0 || latitude === null || longitude === null) throw new Error('Invalid upstream location');
    return reply({ success: true, latitude, longitude, provider: 'toola.hiofd.com' });
  } catch {
    return reply({ success: false, error: 'ip_location_unavailable' }, 503);
  } finally {
    clearTimeout(timeout);
  }
}
