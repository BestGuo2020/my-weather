import assert from 'node:assert/strict';
import vm from 'node:vm';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';

const sourceDir = fileURLToPath(new URL('../src/', import.meta.url));
const bundle = buildSync({
  stdin: { contents: `import * as profile from './city-profile'; globalThis.profile = profile;`, resolveDir: sourceDir, loader: 'ts' },
  bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2020'
}).outputFiles[0].text;
const context = vm.createContext({});
vm.runInContext(bundle, context);
const { classifyCity, fromOpenMeteo, mergeCityMetadata, mergePlaceSources } = context.profile;
const city = (name, country, lat, lon, metadata = {}) => ({ name, country, lat, lon, ...metadata });

test('administrative rank and population never imply building height in any country', () => {
  for (const country of ['CN', 'US', 'FR', 'JP']) {
    for (const featureCode of ['PPLC', 'PPLA', 'PPLA2', 'PPLA3', 'PPLA4', 'PPLL']) {
      for (const population of [0, 500, 200000, 20000000]) {
        const result = classifyCity(city('Example', country, 30, 114, { featureCode, population }));
        assert.equal(result.scale, 'medium');
        assert.equal(result.reason, 'default');
      }
    }
  }
});

test('Chinese provincial-capital aliases and county suffixes no longer override observations', () => {
  for (const name of ['武汉市', 'Shanghai', '长沙县', '莲花县', '北京']) {
    assert.equal(classifyCity(city(name, 'CN', 30.59, 114.30)).reason, 'default');
  }
  const lowCapital = city('武汉市', 'CN', 30.59, 114.30, { featureCode: 'PPLA',
    urbanForm: { lczClass: 6, source: 'test-fixture' } });
  const highCounty = city('Example县', 'CN', 27.13, 113.96, { featureCode: 'PPLA3',
    urbanForm: { lczClass: 4, source: 'test-fixture' } });
  assert.equal(classifyCity(lowCapital).scale, 'low');
  assert.equal(classifyCity(highCounty).scale, 'high');
});

test('observed LCZ built forms select the same height tier worldwide', () => {
  const expected = ['high', 'medium', 'low', 'high', 'medium', 'low', 'low', 'low', 'low'];
  for (const country of ['CN', 'DE', 'US']) {
    expected.forEach((scale, index) => {
      const result = classifyCity(city('Example', country, 30, 114, {
        urbanForm: { lczClass: index + 1, source: 'test-fixture', referenceYear: 2020 }
      }));
      assert.equal(result.scale, scale);
      assert.equal(result.reason, 'lcz');
    });
  }
});

test('unavailable, invalid, industrial and natural LCZ observations use the generic street', () => {
  for (const lczClass of [undefined, 0, -1, 1.5, NaN, 10, 11, 17, 99, '4']) {
    assert.equal(classifyCity(city('Example', 'CN', 30, 114, {
      urbanForm: { lczClass, source: 'test-fixture' }
    })).reason, 'default');
  }
  for (const source of [undefined, '', '   ']) {
    assert.equal(classifyCity(city('Example', 'CN', 30, 114, {
      urbanForm: { lczClass: 1, source }
    })).reason, 'default');
  }
});

test('geocoding responses cannot masquerade as observed building morphology', () => {
  const place = fromOpenMeteo({ name: 'Example', country_code: 'CN', latitude: 30, longitude: 114,
    feature_code: 'PPLC', population: 20000000, urbanForm: { lczClass: 1, source: 'untrusted-geocoder-field' } });
  assert.equal(place.urbanForm, undefined);
  assert.equal(classifyCity(place).reason, 'default');
});

test('Open-Meteo administrative metadata survives conversion and duplicate merging', () => {
  const raw = { name: 'Wuhan', country_code: 'CN', latitude: 30.58, longitude: 114.27,
    feature_code: 'PPLA', population: 10392693, admin1: 'Hubei', admin2: 'Wuhan' };
  const openWeather = city('武汉市', 'CN', 30.59, 114.30, { searchName: 'Wuhan', state: 'Hubei' });
  const places = mergePlaceSources([[openWeather], [fromOpenMeteo(raw)]]);
  assert.equal(places.length, 1);
  assert.equal(places[0].name, '武汉市');
  assert.equal(places[0].lat, openWeather.lat);
  assert.equal(places[0].featureCode, 'PPLA');
  assert.equal(places[0].population, 10392693);
  assert.equal(places[0].admin2, 'Wuhan');
});

test('distant places with the same name and administrative labels remain separate choices', () => {
  const places = mergePlaceSources([[city('Lianhua', 'CN', 28.12, 112.77, { state: 'Hunan' })],
    [city('Lianhua', 'CN', 28.7, 112.7, { state: 'Hunan', featureCode: 'PPLA4' })]]);
  assert.equal(places.length, 2);
});

test('merging search metadata retains explicitly supplied urban morphology', () => {
  const place = city('Example', 'CN', 30, 114, { urbanForm: { lczClass: 4, source: 'test-fixture' } });
  const merged = mergeCityMetadata(place, city('Example', 'CN', 30, 114, { featureCode: 'PPLA3', population: 500 }));
  assert.equal(merged.urbanForm, place.urbanForm);
  assert.equal(classifyCity(merged).scale, 'high');
});
