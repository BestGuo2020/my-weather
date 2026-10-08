import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { pathToFileURL } from 'node:url';
import { createHiofdRequest } from '../lib/hiofd-request.js';

export function createIpQueryRequest(ip, { now = Date.now, random = Math.random } = {}) {
  if (ip !== undefined && isIP(ip) === 0) throw new TypeError('Provide a valid IPv4 or IPv6 address.');

  return createHiofdRequest(ip, text => createHash('md5').update(text, 'utf8').digest('hex'), { now, random });
}

export async function queryIp(ip, { fetchImpl = fetch, timeout = 8000, signal } = {}) {
  const request = createIpQueryRequest(ip);
  const timeoutSignal = AbortSignal.timeout(timeout);
  const response = await fetchImpl(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify(request.payload),
    signal: signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal
  });
  if (!response.ok) throw new Error(`IP query failed: HTTP ${response.status}.`);
  const result = await response.json();
  if (result.resultCode !== 0) throw new Error(`IP query failed: ${result.resultMessage || result.resultCode}.`);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const ip = process.argv[2];
    const result = await queryIp(ip);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } catch (error) {
    process.stderr.write(error.message + '\n');
    process.exitCode = 1;
  }
}
