# HiOFD IP query protocol

The public IP query page calls `doConvert('/router/rest', 'IpQuery', input, callback)`. Its common frontend script assembles the changing fields. This implementation was checked against that script and live requests on 2026-10-08.

Sources:

- https://tool.hiofd.com/ip/
- https://tool.hiofd.com/js/common-main.07015f24ed42.hybrid.min.js

The `key11` / `pwd11` values are published in the page's `window.COMMON_JS_VARS` for all anonymous visitors. A fresh unauthenticated HTTP GET to the public page was verified to return these same values; they are shared public frontend protocol values.

## Request fields

| Field | Generation |
| --- | --- |
| `body.input` | `{ ip: '1.1.1.1' }` for a specified IP, or `{}` for the request's network exit IP |
| `serviceId` | `IpQuery` |
| `key`, `pwd` | Public frontend values `key11`, `pwd11` |
| `k` | Start with seven base-36 random characters; insert `5`, `c`, `s` sequentially at random indices; append 22 random characters |
| `t` | One random digit + milliseconds timestamp + the three first-occurrence indices of `5`, `c`, `s` in the first ten characters of `k` + `135` |
| `r` | 32 base-36 random characters |
| `x` | Lowercase hexadecimal `MD5(t + serviceId + t + r + k)` + eight random base-36 characters |

Send JSON using POST to `https://toola.hiofd.com/router/rest?method=IpQuery&r=<t>`. The URL's `r` is the payload's `t`, not the payload's `r`.

These fields are regenerated for each request. This is a reproduction of the current frontend protocol, not a published stable API contract.

## Node.js usage

Use Node.js 20.3 or newer. The helper has no third-party dependencies.

```sh
node tools/hiofd-ip-query.mjs 1.1.1.1
```

Without an IP argument, the query returns the network exit of the machine running the command. Backend integration should explicitly pass the user's public IP, obtained from the connection or trusted proxy configuration.

```js
import { queryIp } from './tools/hiofd-ip-query.mjs';

const result = await queryIp(clientIp);
const latitude = Number(result.latitude);
const longitude = Number(result.longitude);
```

## Browser integration constraint

Live POST tests with `Origin: https://tool.hiofd.com` returned `Access-Control-Allow-Origin: https://tool.hiofd.com`. With `Origin: https://weather.bestguo.top`, the same endpoint returned a successful JSON body but no `Access-Control-Allow-Origin`; its OPTIONS preflight from the weather origin returned HTTP 404.

The browser now requests the same-origin `/api/ip-location` endpoint. `edge-functions/api/ip-location.js` uses EdgeOne's trusted `request.eo.clientIp` metadata and Web Crypto MD5 to query HiOFD with an explicit IP. The signature generator is shared with the CLI helper in `lib/hiofd-request.js`.

The proxy returns only normalized location coordinates and a provider name, disables browser/CDN caching, and aborts upstream requests after four seconds. It does not accept caller-selected IPs or trust forwarded headers. If EdgeOne metadata or the upstream service is unavailable, it returns HTTP 503 so the browser can continue with the existing IP providers.

## EdgeOne Pages Git deployment

`edgeone.json` configures `npm run build` and the `dist` output directory. EdgeOne discovers the repository-root `edge-functions` directory automatically when deploying the Git-connected project; keep it in the repository alongside `lib` rather than placing it inside `src` or uploading only the static output. No additional environment variables or local Node.js server are required in production.

After pushing the deployment branch, verify `https://weather.bestguo.top/api/ip-location`: it should return JSON with `success: true`, `latitude`, `longitude`, and `provider`. The response represents the network exit of the device making this verification request. Location diagnostics are hidden during normal visits. Open `https://weather.bestguo.top/?debug=location` to inspect them; the provider should report `toola.hiofd.com (EdgeOne)` when this provider is used. Browser geolocation has a ten-second timeout before falling back to the IP providers.

On a static local server or another hosting provider without EdgeOne functions, the endpoint may be unavailable; the browser continues to the existing IP providers. EdgeOne's local dev runtime does not necessarily provide production client-IP metadata.

Official runtime references:

- https://pages.edgeone.ai/zh/document/edge-functions
- https://edgeone.ai/document/52690
- https://edgeone.ai/document/52693

Returned latitude and longitude are an IP estimate. Their decimal precision does not specify the actual location accuracy. The response does not identify its IP database vendor or coordinate reference system.
