import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';
import { buildSync } from 'esbuild';

const bundle = buildSync({ stdin:{ contents:`import * as sky from './sky-scene'; globalThis.sky=sky;`,
  resolveDir:fileURLToPath(new URL('../src/',import.meta.url)),loader:'ts' },bundle:true,write:false,format:'iife',platform:'browser' }).outputFiles[0].text;
const body={dataset:{period:'night'}};
const context=vm.createContext({document:{body}});
vm.runInContext(bundle,context);
const {skyProfile,skyCloudMarkup,renderSkyScene}=context.sky;

test('fallback cloud cover distinguishes clear, few, scattered, broken and overcast',()=>{
  assert.equal(skyProfile('clear',800).cloudCount,0);
  for(const [id,mode,count] of [[801,'few',2],[802,'scattered',4],[803,'broken',6],[804,'overcast',8]]) {
    const profile=skyProfile('clouds',id);
    assert.equal(profile.mode,mode); assert.equal(profile.cloudCount,count);
  }
});
test('reported cloud cover takes precedence and invalid values fall back safely',()=>{
  assert.equal(skyProfile('clouds',804,12).mode,'few');
  assert.equal(skyProfile('clouds',801,97).mode,'overcast');
  assert.equal(skyProfile('clouds',802,NaN).cover,40);
  assert.equal(skyProfile('clouds',802,150).cover,100);
  assert.equal(skyProfile('clouds',802,-8).cover,0);
});
test('precipitation changes cloud form while night remains an independent state',()=>{
  for(const [type,id,mode] of [['rain',502,'rain'],['drizzle',300,'rain'],['snow',602,'snow'],['thunderstorm',202,'storm'],['atmosphere',741,'mist']]) {
    const profile=skyProfile(type,id);
    assert.equal(profile.mode,mode);
    const properties={};
    renderSkyScene({dataset:{},style:{setProperty:(key,value)=>{properties[key]=value;}},innerHTML:''},profile);
    assert.equal(body.dataset.sky,mode);
    assert.equal(body.dataset.period,'night');
  }
});
test('same cloud form retains its markup and drift phase when coverage changes',()=>{
  const container={dataset:{},style:{setProperty(){}},innerHTML:''};
  renderSkyScene(container,skyProfile('clouds',801,12));
  const original=container.innerHTML;
  container.innerHTML='retained cloud layer';
  renderSkyScene(container,skyProfile('clouds',801,24));
  assert.equal(container.innerHTML,'retained cloud layer');
  assert.equal(body.dataset.cloudCover,'24');
  assert.match(original,/ellipse/);
  assert.doesNotMatch(original,/scene-cloud-a|scene-cloud-b/);
});
test('clear skies contain no cloud shapes and cloudy skies use multiple puff groups',()=>{
  assert.equal((skyCloudMarkup(skyProfile('clear',800)).match(/class="sky-cloud"/g)||[]).length,0);
  assert.equal((skyCloudMarkup(skyProfile('clouds',804)).match(/class="sky-cloud"/g)||[]).length,8);
});
