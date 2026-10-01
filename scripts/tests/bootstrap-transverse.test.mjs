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


function memoryStorage(initial={}){
  const values=new Map(Object.entries(initial));
  return {
    getItem:key=>values.has(key)?values.get(key):null,
    setItem:(key,value)=>values.set(key,String(value)),
    removeItem:key=>values.delete(key),
    value:key=>values.get(key)??null
  };
}

function loginForm(email=' user@ei.com.co ',password='secret'){
  const button={disabled:false};
  return {
    email:{value:email},
    password:{value:password},
    onsubmit:null,
    querySelector(selector){
      assert.equal(selector,'button');
      return button;
    },
    button
  };
}

function loginHarness({guard,now=1_000_000,signIn,bootAuthenticated}={}){
  const storage=memoryStorage(guard?{erp_ei_login_guard:JSON.stringify(guard)}:{});
  const form=loginForm();
  const states=[],rendered=[];
  let clearCalls=0,signInCalls=0,bootCalls=0;
  const documentRef={querySelector(selector){
    assert.equal(selector,'#login-form');
    return form;
  }};
  const dependencies={
    storage,documentRef,now:()=>now,
    async clearLocalSession(){clearCalls+=1},
    setState(value){states.push(value)},
    renderLogin(message=''){rendered.push(message)},
    async signIn(email,password){
      signInCalls+=1;
      if(signIn)return signIn(email,password);
      return {session:{id:'session-1'}};
    },
    async bootAuthenticated(){
      bootCalls+=1;
      if(bootAuthenticated)return bootAuthenticated();
    }
  };
  return {storage,form,states,rendered,dependencies,counts:()=>({clearCalls,signInCalls,bootCalls})};
}

async function submit(form){
  assert.equal(typeof form.onsubmit,'function');
  await form.onsubmit({preventDefault(){}});
}

test('login guard blocks attempt 10 inside the active window without calling signIn',async()=>{
  const h=loginHarness({guard:{count:10,resetAt:1_600_000}});
  const {createLoginController}=await import('../../assets/js/core/auth/login-controller.js');
  const {bindLogin}=createLoginController(h.dependencies);
  bindLogin();
  await submit(h.form);
  assert.equal(h.counts().signInCalls,0);
  assert.match(h.rendered.at(-1),/Demasiados intentos fallidos/);
  assert.equal(h.form.button.disabled,false);
});

test('expired login guard is cleared and allows a new authentication attempt',async()=>{
  const h=loginHarness({guard:{count:10,resetAt:999_999}});
  const {createLoginController}=await import('../../assets/js/core/auth/login-controller.js');
  const {bindLogin}=createLoginController(h.dependencies);
  bindLogin();
  await submit(h.form);
  assert.equal(h.counts().signInCalls,1);
  assert.equal(h.counts().bootCalls,1);
  assert.equal(h.storage.value('erp_ei_login_guard'),null);
});

test('credential failure increments the local guard, resets state and renders the error',async()=>{
  const h=loginHarness({signIn:async()=>{throw new Error('Credenciales inválidas')}});
  const {createLoginController}=await import('../../assets/js/core/auth/login-controller.js');
  const {bindLogin}=createLoginController(h.dependencies);
  bindLogin();
  await submit(h.form);
  const guard=JSON.parse(h.storage.value('erp_ei_login_guard'));
  assert.equal(guard.count,1);
  assert.equal(h.counts().bootCalls,0);
  assert.equal(h.rendered.at(-1),'Credenciales inválidas');
  assert.deepEqual(h.states.at(-1),{session:null,profile:null,organization:null,modules:[],catalogs:{}});
  assert.equal(h.form.button.disabled,false);
});

test('successful login clears the guard, stores session and boots exactly once',async()=>{
  const h=loginHarness({guard:{count:3,resetAt:1_600_000}});
  const {createLoginController}=await import('../../assets/js/core/auth/login-controller.js');
  const {bindLogin}=createLoginController(h.dependencies);
  bindLogin();
  bindLogin();
  const installedHandler=h.form.onsubmit;
  await installedHandler({preventDefault(){}});
  assert.deepEqual(h.counts(),{clearCalls:1,signInCalls:1,bootCalls:1});
  assert.equal(h.storage.value('erp_ei_login_guard'),null);
  assert.deepEqual(h.states.at(-1),{session:{id:'session-1'}});
  assert.equal(h.form.button.disabled,false);
});

test('authenticated bootstrap failure returns to a clean login state and rebinds submit',async()=>{
  const h=loginHarness({bootAuthenticated:async()=>{throw new Error('No fue posible cargar perfil')}});
  const {createLoginController}=await import('../../assets/js/core/auth/login-controller.js');
  const {bindLogin}=createLoginController(h.dependencies);
  bindLogin();
  const before=h.form.onsubmit;
  await submit(h.form);
  assert.equal(h.counts().bootCalls,1);
  assert.deepEqual(h.states.at(-1),{session:null,profile:null,organization:null,modules:[],catalogs:{}});
  assert.equal(h.rendered.at(-1),'No fue posible cargar perfil');
  assert.equal(typeof h.form.onsubmit,'function');
  assert.notEqual(h.form.onsubmit,before);
});
