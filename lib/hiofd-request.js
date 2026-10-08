const ENDPOINT = 'https://toola.hiofd.com/router/rest';
const SERVICE_ID = 'IpQuery';
const MARKERS = '5cs';

function randomText(length, random) {
  let text = '';
  while (text.length < length) text += random().toString(36).substring(2);
  return text.substring(0, length);
}

// The digest callback can be synchronous (Node.js) or asynchronous (EdgeOne Web Crypto).
export function createHiofdRequest(ip, md5, { now = Date.now, random = Math.random } = {}) {
  const characters = randomText(7, random).split('');
  for (const marker of MARKERS) characters.splice(Math.floor(random() * characters.length), 0, marker);
  const positions = [...MARKERS].map(marker => characters.indexOf(marker)).join('');
  const k = characters.join('') + randomText(22, random);
  const timestamp = now();
  let digits = '';
  while (digits.length < 7) digits += Math.floor(random() * 10);
  const t = digits.substring(0, 1) + String(timestamp) + positions + '135';
  const r = randomText(32, random);
  const digest = md5(t + SERVICE_ID + t + r + k);
  const suffix = randomText(8, random);
  // HiOFD publishes key11/pwd11 in window.COMMON_JS_VARS for anonymous visitors:
  // https://tool.hiofd.com/ip/
  const finish = hash => ({
    url: `${ENDPOINT}?method=${SERVICE_ID}&r=${t}`,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    payload: { body: { input: ip === undefined ? {} : { ip } }, serviceId: SERVICE_ID, key: 'key11', pwd: 'pwd11', k, t, x: hash + suffix, r }
  });
  return typeof digest === 'string' ? finish(digest) : digest.then(finish);
}
