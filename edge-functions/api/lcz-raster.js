// Fixed, versioned source. This endpoint only forwards bounded HTTP byte ranges;
// it cannot fetch arbitrary URLs or accidentally download the 1.7 GB dataset.
export const LCZ_RASTER_URL = 'https://lcz-generator.rub.de/cogs/lcz_filter_v3_cog.tif';
export const MAX_RANGE_BYTES = 2 * 1024 * 1024;

function error(message, status) {
  return new Response(JSON.stringify({ error: message }), {
    status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

export default async function onRequest({ request }) {
  if (request.method !== 'GET') {
    const response = error('method_not_allowed', 405);
    response.headers.set('Allow', 'GET');
    return response;
  }
  const match = /^bytes=(\d+)-(\d+)$/.exec(request.headers.get('Range') || '');
  if (!match) return error('single_bounded_range_required', 400);
  const start = Number(match[1]), end = Number(match[2]);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || end - start + 1 > MAX_RANGE_BYTES) {
    return error('invalid_range', 416);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const upstream = await fetch(LCZ_RASTER_URL, {
      headers: { Range: `bytes=${start}-${end}` }, signal: controller.signal, redirect: 'follow'
    });
    const contentRange = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(upstream.headers.get('Content-Range') || '');
    if (upstream.status !== 206 || !contentRange || Number(contentRange[1]) !== start
      || Number(contentRange[2]) > end || Number(contentRange[2]) < start
      || Number(contentRange[3]) <= Number(contentRange[2])) {
      await upstream.body?.cancel();
      return error('invalid_raster_response', 502);
    }
    // Stop reading at the declared range length even if the upstream body is
    // malformed. The timeout covers body transfer as well as response headers.
    const expected = Number(contentRange[2]) - start + 1;
    if (!upstream.body) return error('invalid_raster_length', 502);
    const reader = upstream.body.getReader();
    const bytes = new Uint8Array(expected);
    let received = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (received + value.byteLength > expected) {
        await reader.cancel();
        return error('invalid_raster_length', 502);
      }
      bytes.set(value, received);
      received += value.byteLength;
    }
    if (received !== expected) return error('invalid_raster_length', 502);
    return new Response(bytes, { status: 206, headers: {
      'Content-Type': 'image/tiff', 'Content-Range': upstream.headers.get('Content-Range'),
      'Content-Length': String(bytes.byteLength), 'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=3600', 'Vary': 'Range'
    } });
  } catch {
    return error('lcz_raster_unavailable', 503);
  } finally {
    clearTimeout(timeout);
  }
}
