import assert from 'node:assert/strict';
import {test} from 'node:test';

function replaceGlobal(name,value){
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,name);
  Object.defineProperty(globalThis,name,{value,configurable:true,writable:true});
  return ()=>descriptor?Object.defineProperty(globalThis,name,descriptor):delete globalThis[name];
}

function fresh(relative,token){
  const url=new URL(relative,import.meta.url);
  url.searchParams.set('case',token);
  return import(url);
}

test('service worker registration waits for load and installs only once',async()=>{
  let loadListener=null,listenerCount=0,registrations=0;
  const restoreWindow=replaceGlobal('window',{addEventListener(type,listener,options){
    assert.equal(type,'load');
    assert.deepEqual(options,{once:true});
    listenerCount+=1;
    loadListener=listener;
  }});
  const restoreNavigator=replaceGlobal('navigator',{serviceWorker:{register(url){
    registrations+=1;
    assert.equal(url,'./service-worker.js');
    return Promise.resolve();
  }}});
  try{
    const {registerServiceWorker}=await fresh('../../assets/js/core/pwa/register-service-worker.js','single');
    registerServiceWorker();
    registerServiceWorker();
    assert.equal(listenerCount,1);
    assert.equal(registrations,0);
    loadListener();
    assert.equal(registrations,1);
  }finally{restoreNavigator();restoreWindow()}
});

test('service worker registration is safe when unsupported and warns non-fatally on failure',async()=>{
  let listenerCount=0,loadListener=null,warned=null;
  const restoreWindow=replaceGlobal('window',{addEventListener(type,listener){listenerCount+=1;loadListener=listener}});
  const restoreNavigator=replaceGlobal('navigator',{});
  try{
    const unsupported=await fresh('../../assets/js/core/pwa/register-service-worker.js','unsupported');
    unsupported.registerServiceWorker();
    assert.equal(listenerCount,0);
  }finally{restoreNavigator()}
  const restoreNavigatorFailure=replaceGlobal('navigator',{serviceWorker:{register(){return Promise.reject(new Error('offline'))}}});
  const originalWarn=console.warn;
  console.warn=(...args)=>{warned=args};
  try{
    const failing=await fresh('../../assets/js/core/pwa/register-service-worker.js','failure');
    failing.registerServiceWorker();
    assert.equal(listenerCount,1);
    loadListener();
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(warned?.[0],'Service Worker no disponible');
    assert.equal(warned?.[1]?.message,'offline');
  }finally{
    console.warn=originalWarn;
    restoreNavigatorFailure();
    restoreWindow();
  }
});

test('module metadata preserves representative labels and fallback',async()=>{
  const {getModuleMetadata}=await import('../../assets/js/core/layout/module-metadata.js');
  assert.deepEqual(getModuleMetadata('dashboard'),['Centro de operaciones','Indicadores, cargas y prioridades de la operación']);
  assert.deepEqual(getModuleMetadata('shipping'),['Despachos y entregas','Rutas, recogidas, evidencias y cierre']);
  assert.deepEqual(getModuleMetadata('admin'),['Administración de CRM Suministros','Usuarios, roles, calendarios y configuración']);
  assert.deepEqual(getModuleMetadata('unknown-module'),['CRM Suministros','']);
});

test('global navigation installs once and preserves both event contracts',async()=>{
  const windowListeners=new Map(),documentListeners=new Map();
  let modalClears=0;
  const restoreWindow=replaceGlobal('window',{addEventListener(type,listener){
    assert.ok(!windowListeners.has(type),'window listener duplicated');
    windowListeners.set(type,listener);
  }});
  const restoreDocument=replaceGlobal('document',{
    addEventListener(type,listener){
      assert.ok(!documentListeners.has(type),'document listener duplicated');
      documentListeners.set(type,listener);
    },
    querySelector(selector){
      assert.equal(selector,'#modal-root');
      return {replaceChildren(){modalClears+=1}};
    }
  });
  const opened=[],navigations=[],toasts=[],steps=[];
  const dependencies={
    openOrder(detail){opened.push(detail)},
    navigate(moduleId,params){navigations.push({moduleId,params})},
    moduleForStep(step){steps.push(step);return 'cutting'},
    toast(...args){toasts.push(args)}
  };
  try{
    const {installGlobalNavigationEvents}=await fresh('../../assets/js/core/events/global-navigation.js','events');
    installGlobalNavigationEvents(dependencies);
    installGlobalNavigationEvents(dependencies);
    assert.deepEqual([...windowListeners.keys()],['erp:open-order']);
    assert.deepEqual([...documentListeners.keys()],['click']);

    windowListeners.get('erp:open-order')({detail:'order-42'});
    assert.deepEqual(opened,['order-42']);

    const button={dataset:{takeAnother:'CUTTING'}};
    documentListeners.get('click')({target:{closest(selector){
      assert.equal(selector,'[data-take-another]');
      return button;
    }}});
    assert.deepEqual(steps,['CUTTING']);
    assert.equal(modalClears,1);
    assert.deepEqual(navigations,[{moduleId:'cutting',params:{step:'CUTTING',assignment:'ALL'}}]);
    assert.deepEqual(toasts,[["El pedido anterior continúa en Mis pedidos activos. Puedes tomar otro sin perder el avance.",'success',6000]]);
  }finally{restoreDocument();restoreWindow()}
});
