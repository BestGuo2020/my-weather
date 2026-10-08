import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';
import { buildSync } from 'esbuild';
import { getMoonPosition, getPosition } from 'suncalc';

const bundle = buildSync({
  stdin: { contents: `import * as moon from './moon-phase'; globalThis.moon = moon;`,
    resolveDir: fileURLToPath(new URL('../src/', import.meta.url)), loader: 'ts' },
  bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2020'
}).outputFiles[0].text;
const context = vm.createContext({});
vm.runInContext(bundle, context);
const { moonProfile, moonLitPath, moonDiscMarkup, renderMoonPhase } = context.moon;

// Independent reference: USNO primary phases (Universal Time), October 2026.
// https://aa.usno.navy.mil/api/moon/phases/date?date=2026-10-01&nump=5
test('calculated phases agree with published USNO primary phase times', () => {
  const cases = [
    ['2026-10-03T13:25:00Z', .75, .5, 'last-quarter'],
    ['2026-10-10T15:50:00Z', 0, 0, 'new'],
    ['2026-10-18T16:12:00Z', .25, .5, 'first-quarter'],
    ['2026-10-26T04:12:00Z', .5, 1, 'full'],
    ['2026-11-01T20:28:00Z', .75, .5, 'last-quarter']
  ];
  for (const [date, phase, fraction, name] of cases) {
    const actual = moonProfile(new Date(date));
    const distance = Math.abs(actual.phase - phase);
    assert.ok(Math.min(distance, 1 - distance) < .001, `${date}: phase ${actual.phase}`);
    // Lunar latitude keeps non-eclipse new/full moons slightly away from 0/1.
    assert.ok(Math.abs(actual.fraction - fraction) < .003, `${date}: fraction ${actual.fraction}`);
    assert.equal(actual.name, name);
  }
});

test('same instant has the same illumination across time zones and locations', () => {
  const utc = moonProfile(new Date('2026-10-08T12:00:00Z'), { lat: 51.5, lon: -.1 });
  const local = moonProfile(new Date('2026-10-08T20:00:00+08:00'), { lat: -33.87, lon: 151.21 });
  assert.equal(utc.fraction, local.fraction);
  assert.equal(utc.phase, local.phase);
  assert.equal(utc.name, 'waning-crescent');
  assert.notEqual(utc.rotation, local.rotation);
  for (const profile of [utc, local]) assert.ok(profile.rotation >= -180 && profile.rotation < 180);
});

test('rotated bright limb points toward the Sun in the local sky', () => {
  for (const [stamp, lat, lon] of [
    ['2026-10-18T18:00:00Z', 51.5, -.1],
    ['2026-10-08T12:00:00Z', -33.87, 151.21]
  ]) {
    const date = new Date(stamp), rad = Math.PI / 180;
    const sun = getPosition(date, lat, lon), moon = getMoonPosition(date, lat, lon);
    // Project the Sun onto the Moon's local horizontal/vertical tangent plane.
    const azimuth = (sun.azimuth - moon.azimuth) * rad;
    const right = Math.cos(sun.altitude * rad) * Math.sin(azimuth);
    const up = Math.sin(sun.altitude * rad) * Math.cos(moon.altitude * rad)
      - Math.cos(sun.altitude * rad) * Math.sin(moon.altitude * rad) * Math.cos(azimuth);
    const expected = Math.atan2(-up, right) / rad;
    const actual = moonProfile(date, { lat, lon }).rotation;
    const difference = Math.abs(actual - expected);
    // Small differences are expected from topocentric position and refraction.
    assert.ok(Math.min(difference, 360 - difference) < 1, `${stamp}: bright limb faces away from Sun`);
  }
});

test('waxing and waning face opposite sides when a location is unavailable', () => {
  const waxing = moonProfile(new Date('2026-10-14T12:00:00Z'));
  const waning = moonProfile(new Date('2026-10-08T12:00:00Z'));
  assert.equal(waxing.waxing, true);
  assert.equal(waxing.rotation, 0);
  assert.equal(waning.waxing, false);
  assert.equal(waning.rotation, -180);
  for (const coordinates of [{ lat: NaN, lon: 0 }, { lat: 91, lon: 0 }, { lat: 0, lon: 181 }]) {
    assert.equal(moonProfile(new Date('2026-10-08T12:00:00Z'), coordinates).rotation, -180);
  }
  assert.throws(() => moonProfile(new Date(NaN)), /Invalid moon date/);
});

// Measure the area enclosed by the actual SVG arc commands, independently of
// the illumination algorithm. Both crescent and gibbous arcs must cover the
// requested fraction of a disk; this catches flipped sweep flags/terminators.
function illuminatedArea(path) {
  if (!path) return 0;
  const match = path.match(/^M50 2A48 48 0 0 1 50 98(L50 2|A([\d.]+) 48 0 0 ([01]) 50 2)Z$/);
  assert.ok(match, `unsupported lunar path: ${path}`);
  const points = [];
  for (let i = 0; i <= 500; i++) {
    const theta = Math.PI * i / 500;
    points.push([50 + 48 * Math.sin(theta), 50 - 48 * Math.cos(theta)]);
  }
  if (match[2]) {
    const radius = Number(match[2]), direction = match[3] === '1' ? -1 : 1;
    for (let i = 0; i <= 500; i++) {
      const theta = Math.PI * i / 500;
      points.push([50 + direction * radius * Math.sin(theta), 50 + 48 * Math.cos(theta)]);
    }
  }
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const [x, y] = points[i], [nx, ny] = points[(i + 1) % points.length];
    area += x * ny - nx * y;
  }
  return Math.abs(area) / 2 / (Math.PI * 48 * 48);
}

test('SVG bright area matches illumination from new through quarter to full', () => {
  for (const fraction of [0, .01, .125, .25, .4999, .5, .5001, .75, .875, .99, 1]) {
    assert.ok(Math.abs(illuminatedArea(moonLitPath(fraction)) - fraction) < .00003, `illumination ${fraction}`);
  }
  assert.equal(moonLitPath(0), '');
  assert.match(moonLitPath(.5), /L50 2Z$/);
  assert.throws(() => moonLitPath(NaN), /Invalid moon illumination/);
});

test('moon rendering retains its markup and updates with illumination', () => {
  const containers = [{ dataset: {}, innerHTML: '' }, { dataset: {}, innerHTML: '' }];
  const crescent = moonProfile(new Date('2026-10-08T12:00:00Z'), { lat: 30.59, lon: 114.3 });
  renderMoonPhase(containers, crescent);
  assert.equal(containers[0].innerHTML, containers[1].innerHTML);
  assert.equal(containers[0].dataset.moonPhase, 'waning-crescent');
  assert.match(containers[0].innerHTML, /aria-hidden="true"/);
  containers[0].innerHTML = 'retained moon';
  renderMoonPhase(containers, crescent);
  assert.equal(containers[0].innerHTML, 'retained moon');
  const full = moonProfile(new Date('2026-10-26T04:12:00Z'), { lat: 30.59, lon: 114.3 });
  renderMoonPhase(containers, full);
  assert.equal(containers[0].dataset.moonPhase, 'full');
  assert.equal(containers[0].innerHTML, moonDiscMarkup(full));
  assert.equal(containers[0].innerHTML, containers[1].innerHTML);
});
