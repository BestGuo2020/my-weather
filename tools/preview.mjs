import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import lczRaster from '../edge-functions/api/lcz-raster.js';
import ipLocation from '../edge-functions/api/ip-location.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
const portFlag = process.argv.indexOf('--port');
const port = portFlag >= 0 ? Number(process.argv[portFlag + 1]) : 4173;
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid preview port');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8' };
const server = createServer(async (incoming, outgoing) => {
  try {
    const url = new URL(incoming.url, `http://127.0.0.1:${port}`);
    const handler = { '/api/lcz-raster': lczRaster, '/api/ip-location': ipLocation }[url.pathname];
    if (handler) {
      const response = await handler({ request: new Request(url, { method: incoming.method, headers: incoming.headers }) });
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      if (response.body) Readable.fromWeb(response.body).pipe(outgoing);
      else outgoing.end();
      return;
    }
    if (!['GET', 'HEAD'].includes(incoming.method)) { outgoing.writeHead(405); outgoing.end(); return; }
    const path = resolve(root, `.${decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)}`);
    if (!path.startsWith(root + sep)) { outgoing.writeHead(403); outgoing.end(); return; }
    const info = await stat(path);
    if (!info.isFile()) { outgoing.writeHead(404); outgoing.end(); return; }
    outgoing.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    if (incoming.method === 'HEAD') outgoing.end();
    else createReadStream(path).pipe(outgoing);
  } catch { outgoing.writeHead(404); outgoing.end('Not found'); }
});
server.listen(port, '127.0.0.1', () => console.log(`Weather preview: http://127.0.0.1:${port}/`));
