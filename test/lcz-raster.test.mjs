import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';
import { buildSync } from 'esbuild';

const bundle = buildSync({ stdin: { contents:`import handler from './edge-functions/api/lcz-raster.js'; globalThis.handler=handler;`,
  resolveDir:fileURLToPath(new URL('../',import.meta.url)),loader:'js' },bundle:true,write:false,format:'iife',platform:'browser' }).outputFiles[0].text;
function environment(upstream) {
  const calls=[];
  const context=vm.createContext({ Response,AbortController,setTimeout,clearTimeout,
    fetch:async(url,options)=>{calls.push({url,options});return upstream;} });
  vm.runInContext(bundle,context);
  const request=(range,method='GET')=>({request:new Request('https://weather.example/api/lcz-raster?url=https://example.com',
    {method,headers:range?{Range:range}:{}})});
  return {handler:context.handler,calls,request};
}
test('a small byte range is forwarded to the pinned source, independently of client URLs', async()=>{
  const env=environment(new Response(new Uint8Array([1,2,3,4]),{status:206,headers:{'Content-Range':'bytes 100-103/1000'}}));
  const response=await env.handler(env.request('bytes=100-103'));
  assert.equal(response.status,206);
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())],[1,2,3,4]);
  assert.equal(env.calls[0].url,'https://lcz-generator.rub.de/cogs/lcz_filter_v3_cog.tif');
  assert.equal(env.calls[0].options.headers.Range,'bytes=100-103');
  assert.equal(response.headers.get('Vary'),'Range');
});
test('unbounded, multipart, oversized and unsafe ranges are rejected before any fetch',async()=>{
  const env=environment();
  for(const range of [null,'bytes=0-','bytes=-20','bytes=0-10,20-30','bytes=0-2097152','bytes=5-2','bytes=0-999999999999999999']) {
    const response=await env.handler(env.request(range));
    assert.ok([400,416].includes(response.status));
  }
  assert.equal(env.calls.length,0);
  assert.equal((await env.handler(env.request('bytes=0-1','POST'))).status,405);
});
test('full-file and mismatched upstream responses cannot be accepted as raster ranges',async()=>{
  for(const upstream of [new Response('whole file',{status:200}),
    new Response(new Uint8Array(4),{status:206,headers:{'Content-Range':'bytes 200-203/1000'}}),
    new Response(new Uint8Array(1),{status:206,headers:{'Content-Range':'bytes 100-103/1000'}}),
    new Response(new Uint8Array(10),{status:206,headers:{'Content-Range':'bytes 100-103/1000'}})]) {
    const env=environment(upstream);
    assert.equal((await env.handler(env.request('bytes=100-103'))).status,502);
  }
});
