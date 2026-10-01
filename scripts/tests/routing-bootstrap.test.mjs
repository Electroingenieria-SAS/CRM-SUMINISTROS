import assert from 'node:assert/strict';
import fs from 'node:fs';
import {test} from 'node:test';

import {
  registeredModuleIds,
  rendererFor,
  queueStepsFor,
  moduleReadable,
  firstReadableModule
} from '../../assets/js/core/routing/module-registry.js';
import {createRouteDispatcher} from '../../assets/js/core/routing/route-dispatcher.js';
import {createAuthenticatedRuntimeInstaller} from '../../assets/js/core/bootstrap/runtime-installers.js';

const EXPECTED_MODULES=[
  'dashboard','orders','sales','credit','receiving','inventory','approvals','vsm','imports','audit','admin','reports','cutting','workforce',
  'cartera','caja','purchasing','picking','billing','shipping'
];

test('module registry resolves every current module and preserves shared renderers',()=>{
  assert.deepEqual(new Set(registeredModuleIds()),new Set(EXPECTED_MODULES));
  for(const moduleId of EXPECTED_MODULES){
    assert.ok(rendererFor(moduleId)||queueStepsFor(moduleId),`module not resolved: ${moduleId}`);
  }
  assert.equal(rendererFor('sales'),rendererFor('orders'));
  assert.equal(rendererFor('receiving')?.name,'renderReceivingHub');
});

test('module registry preserves exact queue steps and permission fallback',()=>{
  assert.deepEqual(queueStepsFor('cartera'),['CARTERA']);
  assert.deepEqual(queueStepsFor('caja'),['CAJA','CAJA_FACTURACION']);
  assert.deepEqual(queueStepsFor('purchasing'),['COMPRAS']);
  assert.deepEqual(queueStepsFor('picking'),['ALISTAMIENTO']);
  assert.deepEqual(queueStepsFor('billing'),['FACTURACION']);
  assert.deepEqual(queueStepsFor('shipping'),['CLIENT_POINT','CLIENT_PICKUP','LOCAL_DISPATCH','NATIONAL_DISPATCH','CLOSURE']);
  assert.equal(queueStepsFor('orders'),null);

  const modules=[{code:'orders',canRead:true},{code:'shipping',canRead:false}];
  assert.equal(moduleReadable(modules,'orders'),true);
  assert.equal(moduleReadable(modules,'shipping'),false);
  assert.equal(moduleReadable(modules,'missing'),false);
  assert.equal(firstReadableModule(modules),'orders');
  assert.equal(firstReadableModule([]),'dashboard');
});

function routeHarness({modules=[{code:'orders',canRead:true}],renderModule,renderQueue}={}){
  const calls={navigate:[],open:[],shell:[],render:[],queue:[],toast:[],reload:0};
  const retryButton={listener:null,addEventListener(type,listener){assert.equal(type,'click');this.listener=listener}};
  const root={
    innerHTML:'',
    querySelector(selector){
      if(selector==='#retry-module')return retryButton;
      return null;
    }
  };
  const dispatcher=createRouteDispatcher({
    getModules:()=>modules,
    navigate:(...args)=>calls.navigate.push(args),
    openOrder:id=>calls.open.push(id),
    updateShell:(...args)=>calls.shell.push(args),
    renderModule:renderModule||((...args)=>calls.render.push(args)),
    renderQueue:renderQueue||((...args)=>calls.queue.push(args)),
    loading:()=>'<loading>',
    toast:(...args)=>calls.toast.push(args),
    documentRef:{querySelector(selector){assert.equal(selector,'#page-content');return root}},
    locationRef:{reload(){calls.reload+=1}},
    defer:callback=>callback()
  });
  return {dispatcher,calls,root,retryButton};
}

test('route dispatcher renders authorized modules with metadata and context',async()=>{
  const h=routeHarness();
  await h.dispatcher({segments:[],module:'orders',params:{search:'ABC'}});
  assert.deepEqual(h.calls.navigate,[]);
  assert.deepEqual(h.calls.shell,[['orders','Pedidos','Consulta, trazabilidad y gestión integral']]);
  assert.equal(h.root.innerHTML,'<loading>');
  assert.equal(h.calls.render.length,1);
  assert.equal(h.calls.render[0][0],'orders');
  assert.equal(h.calls.render[0][2].moduleId,'orders');
  assert.deepEqual(h.calls.render[0][2].params,{search:'ABC'});
});

test('route dispatcher redirects forbidden modules before rendering',async()=>{
  const h=routeHarness({modules:[{code:'dashboard',canRead:true},{code:'orders',canRead:false}]});
  await h.dispatcher({segments:[],module:'orders',params:{}});
  assert.deepEqual(h.calls.navigate,[['dashboard']]);
  assert.equal(h.calls.render.length,0);
  assert.equal(h.calls.queue.length,0);
});

test('route dispatcher preserves order deep-link navigation and exact openOrder id',async()=>{
  const h=routeHarness();
  await h.dispatcher({segments:['order','order-42'],module:'orders',params:{}});
  assert.deepEqual(h.calls.navigate,[['orders']]);
  assert.deepEqual(h.calls.open,['order-42']);
  assert.equal(h.calls.render.length,0);
});

test('route dispatcher sends queue modules their exact steps and params',async()=>{
  const h=routeHarness({modules:[{code:'shipping',canRead:true}]});
  await h.dispatcher({segments:[],module:'shipping',params:{assignment:'MINE'}});
  assert.equal(h.calls.queue.length,1);
  assert.deepEqual(h.calls.queue[0][1],{
    moduleId:'shipping',
    steps:['CLIENT_POINT','CLIENT_PICKUP','LOCAL_DISPATCH','NATIONAL_DISPATCH','CLOSURE'],
    params:{assignment:'MINE'}
  });
  assert.equal(h.calls.render.length,0);
});

test('route dispatcher escapes renderer errors, exposes retry and emits the original toast',async()=>{
  const h=routeHarness({renderModule:async()=>{throw new Error('<img src=x onerror=1>')}});
  const originalError=console.error;
  console.error=()=>{};
  try{
    await h.dispatcher({segments:[],module:'orders',params:{}});
  }finally{console.error=originalError}
  assert.ok(h.root.innerHTML.includes('module-error'));
  assert.ok(h.root.innerHTML.includes('&lt;img src=x onerror=1&gt;'));
  assert.ok(!h.root.innerHTML.includes('<img src=x onerror=1>'));
  assert.deepEqual(h.calls.toast,[['<img src=x onerror=1>','error',8000]]);
  assert.equal(typeof h.retryButton.listener,'function');
  h.retryButton.listener();
  assert.equal(h.calls.reload,1);
});

test('authenticated runtime installers preserve order and run each exactly once',()=>{
  const calls=[];
  const install=createAuthenticatedRuntimeInstaller([
    ()=>calls.push('active-work'),
    ()=>calls.push('work-clock'),
    ()=>calls.push('support-flow'),
    ()=>calls.push('paco'),
    ()=>calls.push('resolve-guard'),
    ()=>calls.push('operational')
  ]);
  assert.equal(install(),true);
  assert.equal(install(),false);
  assert.deepEqual(calls,['active-work','work-clock','support-flow','paco','resolve-guard','operational']);
});

test('authenticated runtime installer resumes after a failed installer without duplicating completed work',()=>{
  const calls=[];
  let shouldFail=true;
  const install=createAuthenticatedRuntimeInstaller([
    ()=>calls.push('first'),
    ()=>{calls.push('second');if(shouldFail){shouldFail=false;throw new Error('boom')}},
    ()=>calls.push('third')
  ]);
  assert.throws(()=>install(),/boom/);
  assert.equal(install(),true);
  assert.equal(install(),false);
  assert.deepEqual(calls,['first','second','second','third']);
});

test('authenticated bootstrap owns routing/runtime while main stays free of registries',()=>{
  const main=fs.readFileSync(new URL('../../assets/js/main.js',import.meta.url),'utf8');
  const bootstrap=fs.readFileSync(new URL('../../assets/js/core/bootstrap/authenticated-bootstrap.js',import.meta.url),'utf8');
  assert.ok(!main.includes('const routes='));
  assert.ok(!main.includes('const queueModules='));
  assert.ok(!main.includes('function moduleReadable('));
  assert.ok(!main.includes('function firstReadableModule('));
  assert.ok(!main.includes('initRouter('));
  assert.ok(!main.includes('installAuthenticatedRuntime('));
  assert.ok(bootstrap.includes('initRouter(createRouteDispatcher('));
  assert.ok(bootstrap.includes('installAuthenticatedRuntime();'));
  for(const path of [
    '../../modules/dashboard.js','../../modules/inventory.js','../../modules/approvals.js','../../modules/vsm.js',
    '../../modules/imports.js','../../modules/audit.js','../../modules/admin.js','../../modules/credit.js',
    '../../modules/reports.js','../../modules/cutting-flow.js','../../modules/workforce.js','../../domains/receiving/index.js'
  ])assert.ok(!bootstrap.includes(path),`renderer import leaked into authenticated bootstrap: ${path}`);
});
