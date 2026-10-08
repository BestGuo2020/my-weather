import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';
import { buildSync } from 'esbuild';

const bundle = buildSync({ stdin: {
  contents: `import * as sampling from './lcz-sampling'; import {createLczClient} from './lcz-client';
    import {citySceneMarkup} from './city-scene'; globalThis.api={...sampling,createLczClient,citySceneMarkup};`,
  resolveDir: fileURLToPath(new URL('../src/', import.meta.url)), loader: 'ts'
}, bundle:true, write:false, format:'iife', platform:'browser', external:['./lcz-data'] }).outputFiles[0].text;
const context = vm.createContext({ Date });
vm.runInContext(bundle, context);
const { lczSampleWindow, summarizeLcz, createLczClient, citySceneMarkup } = context.api;
const sample = { window:[0,0,3,3], centreX:1, centreY:1, metresX:100, metresY:100 };

test('world coordinates map to a bounded geographic raster window, including edges', () => {
  const grid = { width:100, height:100, origin:[0,.1], resolution:[.001,-.001] };
  const result = lczSampleWindow(.05,.05,grid);
  assert.equal(result.centreX,49.5);
  assert.equal(result.centreY,49.5);
  const edge = lczSampleWindow(.0995,.0005,grid);
  assert.equal(edge.window[0],0);
  assert.equal(edge.window[1],0);
  for (const [lat,lon] of [[91,0],[0,181],[.2,.05],[.05,-.1],[NaN,0]]) {
    assert.equal(lczSampleWindow(lat,lon,grid),null);
  }
});

test('a predominantly built neighbourhood chooses the dominant built class with attribution', () => {
  const result = summarizeLcz([2,2,2,6,6,17,17,17,17],sample);
  assert.equal(result.lczClass,2);
  assert.equal(result.referenceYear,2018);
  assert.equal(result.sampleRadiusM,500);
  assert.equal(result.sampleCount,9);
  assert.equal(result.classShare,3/9);
  assert.match(result.source,/8419340/);
});

test('natural cover remains natural, ties are stable, and no-data is excluded', () => {
  assert.equal(summarizeLcz([1,1,1,11,11,11,11,17,17],sample).lczClass,11);
  assert.equal(summarizeLcz([2,2,6,6,6,2,0,0,0],sample).lczClass,6);
  assert.equal(summarizeLcz([0,0,0,0,0,0,0,0,0],sample),null);
});

test('the sample is circular and does not include distant corners of its bounding box', () => {
  const large = { window:[0,0,7,7], centreX:3, centreY:3, metresX:200, metresY:200 };
  const values = new Array(49).fill(6);
  values[0]=1; values[6]=1; values[42]=1; values[48]=1;
  const result = summarizeLcz(values,large);
  assert.equal(result.lczClass,6);
  assert.equal(result.classShare,1);
  assert.ok(result.sampleCount < 49);
});

test('repeated coordinates reuse cached LCZ data and aborted reads cannot populate the cache', async () => {
  let calls = 0, complete;
  const form = { lczClass:4, source:'test-fixture' };
  const client = createLczClient(async () => async () => { calls++; return form; });
  const signal = new AbortController().signal;
  assert.equal(await client.read(30,114,signal),form);
  assert.equal(await client.read(30,114,signal),form);
  assert.equal(calls,1);
  const controller = new AbortController();
  let begin, attempts=0;
  const started = new Promise(resolve => { begin=resolve; });
  const pending = createLczClient(async () => async () => {
    attempts++;
    if(attempts>1) return form;
    return new Promise(resolve => { complete=resolve; begin(); });
  });
  const read = pending.read(30,114,controller.signal);
  await started; controller.abort(); complete(form);
  assert.equal(await read,null);
  assert.equal(await pending.read(30,114,new AbortController().signal),form);
  assert.equal(attempts,2);
});

test('compact, open and sparse forms change building count and tree cover consistently', () => {
  const compact = citySceneMarkup('high','same','compact',1);
  const open = citySceneMarkup('high','same','open',4);
  const sparse = citySceneMarkup('low','same','sparse',9);
  assert.ok((compact.match(/class="building-wall"/g)||[]).length > (open.match(/class="building-wall"/g)||[]).length);
  assert.ok((open.match(/class="tree-trunk"/g)||[]).length > (compact.match(/class="tree-trunk"/g)||[]).length);
  assert.ok((sparse.match(/class="building-wall"/g)||[]).length < (compact.match(/class="building-wall"/g)||[]).length);
});
