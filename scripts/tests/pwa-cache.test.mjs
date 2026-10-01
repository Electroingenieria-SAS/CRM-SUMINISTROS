import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');

function workerHarness(){
  const listeners=new Map(),assets=new Set(),opened=[],deleted=[];
  const cache={
    async addAll(urls){
      for(const url of urls){
        const file=path.resolve(root,url==='./'?'index.html':url);
        assert.ok(fs.existsSync(file),`precache points to a removed asset: ${url}`);
        assets.add(url);
      }
    },async put(){}
  };
  const context={URL,Response,location:{origin:'https://crm.test'},
    self:{addEventListener:(type,fn)=>listeners.set(type,fn),skipWaiting:async()=>{},clients:{claim:async()=>{}}},
    caches:{open:async name=>{opened.push(name);return cache},keys:async()=>['legacy-cache',opened[0]],delete:async key=>deleted.push(key),match:async()=>new Response('offline')},
    fetch:async url=>new Response(fs.readFileSync(path.resolve(root,String(url))))
  };
  vm.runInNewContext(fs.readFileSync(path.join(root,'service-worker.js'),'utf8'),context);
  return {listeners,assets,opened,deleted,context};
}

async function dispatch(harness,type,event={}){
  let pending;
  harness.listeners.get(type)({...event,waitUntil:value=>{pending=value},respondWith:value=>{pending=value}});
  return pending;
}

test('PWA installation precaches current modules and extracted CSS, without deleted files',async()=>{
  const h=workerHarness();
  await dispatch(h,'install');
  for(const asset of ['assets/js/domains/orders/index.js','assets/js/domains/workforce/calendar/index.js','assets/js/domains/paco/index.js']){
    assert.ok(h.assets.has('./'+asset),`missing domain: ${asset}`);
  }
  const scan=directory=>fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
    const file=path.join(directory,entry.name);
    return entry.isDirectory()?scan(file):/\.(?:js|css)$/.test(file)?[file]:[];
  });
  for(const folder of ['assets/js','assets/css','assets/runtime-css']){
    for(const file of scan(path.join(root,folder))){
      assert.ok(h.assets.has('./'+path.relative(root,file).split(path.sep).join('/')),`offline dependency missing: ${file}`);
    }
  }
});

test('PWA activation retains the revision cache and removes old caches',async()=>{
  const h=workerHarness();
  await dispatch(h,'install');
  await dispatch(h,'activate');
  assert.match(h.opened[0],/-[a-f0-9]{16}$/);
  assert.deepEqual(h.deleted,['legacy-cache']);
});

test('PWA offline requests resolve versioned assets and navigation fallback',async()=>{
  const h=workerHarness(),matches=[];
  h.context.fetch=async()=>{throw new Error('offline')};
  h.context.caches.match=async(url,options)=>{matches.push({url,options});return matches.length===1?undefined:new Response('shell')};
  const response=await dispatch(h,'fetch',{request:{method:'GET',url:'https://crm.test/orders',mode:'navigate'}});
  assert.equal(await response.text(),'shell');
  assert.equal(matches[0].options.ignoreSearch,true);
  assert.equal(matches[1].url,'./index.html');
});
