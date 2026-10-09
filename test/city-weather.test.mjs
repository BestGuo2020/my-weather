import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';
import { buildSync } from 'esbuild';

const bundle = buildSync({ stdin: { contents: `import * as weather from './city-weather'; globalThis.weather = weather;`,
  resolveDir: fileURLToPath(new URL('../src/', import.meta.url)), loader: 'ts' },
  bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2020'
}).outputFiles[0].text;
const context = vm.createContext({});
vm.runInContext(bundle, context);
const { cityWeatherMarkup, cityRainGroundMarkup } = context.weather;
const css = readFileSync(new URL('../src/city-scene.css', import.meta.url), 'utf8');

const properties = style => Object.fromEntries([...style.matchAll(/--([\w-]+):([-\d.]+)(?:px|s)?/g)]
  .map(match => [match[1], Number(match[2])]));
function drops(seed, top) {
  return [...cityWeatherMarkup('near', seed, top).matchAll(/<g class="city-rain-drop city-rain-impact([^\"]*)" data-rain-index="(\d+)"\s+style="([^\"]+)">\s*<path d="([^\"]+)"/g)]
    .map(match => ({ tier: match[1], index: Number(match[2]), values: properties(match[3]), path: match[4] }));
}
function ripples(seed, top) {
  return [...cityRainGroundMarkup(seed, top).matchAll(/<g transform="translate\(([-\d.]+) ([-\d.]+)\)" class="([^\"]*)" data-rain-index="(\d+)">\s*<ellipse class="city-ripple"[^>]*style="([^\"]+)"/g)]
    .map(match => ({ x: Number(match[1]), y: Number(match[2]), tier: match[3], index: Number(match[4]), values: properties(match[5]) }));
}

test('every road ripple has a rain tip landing at the same position on the same clock', () => {
  for (const top of [24, 118, 204]) for (const seed of ['Lianhua', 'London', 'Sydney']) {
    const particles = drops(seed, top);
    const rings = ripples(seed, top);
    assert.equal(particles.length, 34);
    assert.equal(rings.length, 12);
    for (const ring of rings) {
      const drop = particles.find(drop => drop.index === ring.index);
      assert.ok(drop);
      assert.match(drop.path, /L0 0$/); // The animated origin is the tip, not the tail.
      assert.ok(Math.abs(drop.values['particle-x'] + drop.values['particle-drift'] - ring.x) < .001);
      assert.ok(Math.abs(drop.values['particle-top'] + drop.values['particle-fall'] - ring.y) < .001);
      assert.equal(drop.values['particle-duration'], ring.values['particle-duration']);
      assert.equal(drop.values['particle-delay'], ring.values['particle-delay']);
      assert.equal(drop.tier.trim(), ring.tier.trim());
      assert.ok(ring.x >= 40 && ring.x <= 1400);
      assert.ok(ring.y >= 354 && ring.y <= 392);
    }
  }
});

test('rain amount keeps 4, 8 and 12 matching ripples at light, moderate and heavy intensity', () => {
  const rings = ripples('Lianhua', 118);
  assert.equal(rings.filter(ring => !ring.tier).length, 4);
  assert.equal(rings.filter(ring => !ring.tier.includes('heavy')).length, 8);
  assert.equal(rings.length, 12);
  const totals = depth => [...cityWeatherMarkup(depth, 'Lianhua', 118).matchAll(/class="city-rain-drop([^\"]*)"/g)]
    .map(match => match[1]);
  const rain = ['far', 'mid', 'near'].flatMap(totals);
  assert.equal(rain.filter(tier => !/particle-(moderate|heavy)/.test(tier)).length, 28);
  assert.equal(rain.filter(tier => !tier.includes('particle-heavy')).length, 52);
  assert.equal(rain.length, 84);
});

test('scene height changes rain travel, but keep seeded impact positions and cycles stable', () => {
  const before = ripples('Lianhua', 24);
  const after = ripples('Lianhua', 204);
  assert.deepEqual(after, before);
  assert.equal(cityWeatherMarkup('near', 'Lianhua', 118), cityWeatherMarkup('near', 'Lianhua', 118));
  assert.notEqual(cityRainGroundMarkup('Lianhua', 118), cityRainGroundMarkup('London', 118));
  const high = drops('Lianhua', 24), low = drops('Lianhua', 204);
  assert.equal(high[0].values['particle-fall'] - low[0].values['particle-fall'], 180);
});

function animationFrames(name, property, opacity = .72) {
  const block = css.match(new RegExp(`@keyframes ${name} \\{([\\s\\S]*?)\\n\\}`))[1];
  const frames = [];
  for (const match of block.matchAll(/([\d.% ,]+)\{([^}]+)\}/g)) {
    let value;
    if (property === 'position' && match[2].includes('transform: translate')) value = match[2].includes('calc(') ? 1 : 0;
    else if (property === 'opacity') {
      const field = match[2].match(/opacity: ([^;]+);/);
      if (field) value = field[1].startsWith('var(') ? opacity : Number(field[1]);
    }
    if (value !== undefined) for (const percent of match[1].matchAll(/([\d.]+)%/g)) frames.push([Number(percent[1]) / 100, value]);
  }
  return frames.sort((a, b) => a[0] - b[0]);
}
function sample(frames, phase) {
  const next = frames.findIndex(([time]) => time >= phase);
  if (next === 0) return frames[0][1];
  const [t0, v0] = frames[next - 1], [t1, v1] = frames[next];
  return v0 + (v1 - v0) * (phase - t0) / (t1 - t0);
}

test('actual CSS shows the falling drop first, then a ripple only after contact', () => {
  const travel = animationFrames('city-rain-land', 'position');
  const rain = animationFrames('city-rain-land', 'opacity');
  const water = animationFrames('city-ripple', 'opacity');
  const contact = travel.find(([time, position]) => position === 1)[0];
  for (let i = 0; i <= 200; i++) {
    const phase = contact * i / 200;
    assert.equal(sample(water, phase), 0, `ripple appeared before contact at ${phase}`);
  }
  assert.ok(sample(travel, contact - .01) < 1);
  assert.ok(sample(rain, contact - .01) > 0);
  assert.equal(sample(travel, contact), 1);
  assert.ok(sample(water, contact + .01) > 0);
  assert.equal(sample(rain, contact + .01), 0);
  assert.equal(sample(water, 1), 0);
  assert.match(css, /\.city-rain-impact \{ animation-name: city-rain-land; \}/);
});

test('foreground rain reaches the road without the fade mask, while snow still uses it', () => {
  const near = cityWeatherMarkup('near', 'Lianhua', 118);
  assert.match(near, /class="city-weather city-weather-near" clip-path="url\(#city-weather-clip\)">/);
  assert.match(near, /class="city-snow" mask="url\(#city-weather-fade\)"/);
  assert.match(cityWeatherMarkup('far', 'Lianhua', 118), /mask="url\(#city-weather-fade\)"/);
  assert.match(css, /\.city-rain, \.city-snow \{ display: none !important; \}/);
});
