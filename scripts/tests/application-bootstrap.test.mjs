import assert from 'node:assert/strict';
import fs from 'node:fs';
import {test} from 'node:test';

function source(relative){
  return fs.readFileSync(new URL(relative,import.meta.url),'utf8');
}

function stripModule(code){
  return code
    .replace(/^import[\s\S]*?from\s+["'][^"']+["'];\s*/gm,'')
    .replace(/^import\s+["'][^"']+["'];\s*/gm,'')
    .replace(/\bexport\s+(?=(?:async\s+)?function|const|let|var|class)/g,'');
}

const authenticatedBootstrapSource=source('../../assets/js/core/bootstrap/authenticated-bootstrap.js');
const sessionLifecycleSource=source('../../assets/js/core/auth/session-lifecycle.js');
const applicationSource=source('../../assets/js/core/bootstrap/application.js');

const createAuthenticatedBootstrap=new Function(
  'appState','setAppState','renderLoginView','renderShellView','initAppRouter','navigateApp',
  'clearSession','apiService','loadingMarkup','openOrderView','createDispatcher','installRuntime',
  `${stripModule(authenticatedBootstrapSource)}; return createAuthenticatedBootstrap;`
)(
  {modules:[]},()=>{},()=>{},()=>{},()=>{},()=>{},async()=>{},
  {session:async()=>({})},()=>'',()=>{},()=>()=>{},()=>{}
);

const createSessionLifecycle=new Function(
  'appState','setAppState','renderLoginView','getCurrentSession','subscribeAuthChanges',
  `${stripModule(sessionLifecycleSource)}; return createSessionLifecycle;`
)(
  {profile:null},()=>{},()=>{},async()=>null,()=>({data:{subscription:{unsubscribe(){}}}})
);

const createApplication=new Function(
  'installDialogs','showToast','renderLoginView','navigateApp','openOrderView','resolveModuleForStep',
  'installGlobalNavigation','registerWorker','createLogin','createBootstrap','createLifecycle',
  `${stripModule(applicationSource).replace(/const application=createApplication\(\);[\s\S]*$/,'')}; return createApplication;`
)(
  ()=>{},()=>{},()=>{},()=>{},()=>{},()=>{},()=>{},()=>{},
  ()=>({bindLogin(){}}),()=>({bootAuthenticated:async()=>{}}),
  ()=>({startSessionLifecycle:()=>Promise.resolve(),disposeSessionLifecycle(){}})
);

function deferred(){
  let resolve,reject;
  const promise=new Promise((res,rej)=>{resolve=res;reject=rej});
  return {promise,resolve,reject};
}

function bootstrapHarness({sessionResult,sessionError}={}){
  const pending=deferred();
  const calls={session:0,state:[],login:[],shell:0,runtime:0,router:0,clear:0,bind:0,dispatcher:0};
  let useDeferred=sessionResult===undefined&&sessionError===undefined;
  const api={session(){
    calls.session+=1;
    if(useDeferred)return pending.promise;
    if(sessionError)throw sessionError;
    return Promise.resolve(sessionResult);
  }};
  const root={innerHTML:''};
  const dependencies={
    api,
    getModules:()=>[{code:'orders',canRead:true}],
    setState:value=>calls.state.push(value),
    renderLogin:message=>calls.login.push(message),
    renderShell:()=>{calls.shell+=1},
    loading:message=>`loading:${message}`,
    clearLocalSession:async()=>{calls.clear+=1},
    installAuthenticatedRuntime:()=>{calls.runtime+=1},
    initRouter:handler=>{calls.router+=1;calls.handler=handler},
    createRouteDispatcher:options=>{calls.dispatcher+=1;calls.dispatcherOptions=options;return ()=>{}},
    navigate:()=>{},
    openOrder:()=>{},
    bindLogin:()=>{calls.bind+=1},
    documentRef:{querySelector(selector){assert.equal(selector,'#app');return root}}
  };
  return {pending,calls,root,dependencies,setDeferred:value=>{useDeferred=value}};
}

test('authenticated bootstrap is real single-flight and installs valid runtime/router once',async()=>{
  const h=bootstrapHarness();
  const {bootAuthenticated}=createAuthenticatedBootstrap(h.dependencies);
  const first=bootAuthenticated();
  const second=bootAuthenticated();
  assert.equal(first,second);
  assert.equal(h.calls.session,1);
  assert.equal(h.root.innerHTML,'loading:Preparando tu espacio de trabajo…');

  h.pending.resolve({profile:{id:'p1'},organization:{id:'o1'},modules:[{code:'orders',canRead:true}],catalogs:{orderTypes:[]}});
  await first;

  assert.equal(h.calls.shell,1);
  assert.equal(h.calls.runtime,1);
  assert.equal(h.calls.router,1);
  assert.equal(h.calls.dispatcher,1);
  assert.deepEqual(h.calls.state,[{
    profile:{id:'p1'},
    organization:{id:'o1'},
    modules:[{code:'orders',canRead:true}],
    catalogs:{orderTypes:[]}
  }]);
});

test('authenticated bootstrap clears invalid profile/session and returns to login',async()=>{
  const error=Object.assign(new Error('usuario sin perfil operativo activo'),{rpc:'erp_x_session'});
  const h=bootstrapHarness({sessionError:error});
  const {bootAuthenticated}=createAuthenticatedBootstrap(h.dependencies);
  await bootAuthenticated();

  assert.equal(h.calls.clear,1);
  assert.deepEqual(h.calls.state.at(-1),{session:null,profile:null,organization:null,modules:[],catalogs:{}});
  assert.equal(h.calls.login.at(-1),'La sesión anterior ya no es válida. Inicia sesión nuevamente.');
  assert.equal(h.calls.bind,1);
  assert.equal(h.calls.runtime,0);
  assert.equal(h.calls.router,0);
});

test('authenticated bootstrap renders normal errors and finally allows retry',async()=>{
  const h=bootstrapHarness({sessionError:new Error('ERP temporalmente no disponible')});
  const {bootAuthenticated}=createAuthenticatedBootstrap(h.dependencies);
  await bootAuthenticated();
  assert.equal(h.calls.login.at(-1),'ERP temporalmente no disponible');
  assert.equal(h.calls.clear,0);
  assert.equal(h.calls.bind,1);

  h.dependencies.api.session=async()=>{
    h.calls.session+=1;
    return {profile:{id:'p2'},organization:{},modules:[],catalogs:{}};
  };
  await bootAuthenticated();
  assert.equal(h.calls.session,2);
  assert.equal(h.calls.runtime,1);
  assert.equal(h.calls.router,1);
});

function lifecycleHarness({initialSession=null,profile=null}={}){
  const calls={state:[],login:0,bind:0,boot:0,subscribe:0,unsubscribe:0};
  let authCallback=null;
  const subscription={unsubscribe(){calls.unsubscribe+=1}};
  const dependencies={
    bootAuthenticated:async()=>{calls.boot+=1},
    bindLogin:()=>{calls.bind+=1},
    getSession:async()=>initialSession,
    onAuthChange:callback=>{calls.subscribe+=1;authCallback=callback;return {data:{subscription}}},
    setState:value=>calls.state.push(value),
    getState:()=>({profile}),
    renderLogin:()=>{calls.login+=1}
  };
  return {calls,dependencies,getAuthCallback:()=>authCallback};
}

test('session lifecycle without initial session renders login and subscribes once',async()=>{
  const h=lifecycleHarness();
  const lifecycle=createSessionLifecycle(h.dependencies);
  const first=lifecycle.startSessionLifecycle();
  const second=lifecycle.startSessionLifecycle();
  assert.equal(first,second);
  await first;
  assert.equal(h.calls.boot,0);
  assert.equal(h.calls.login,1);
  assert.equal(h.calls.bind,1);
  assert.equal(h.calls.subscribe,1);
  assert.deepEqual(h.calls.state[0],{session:null});
});

test('session lifecycle boots initial session and INITIAL_SESSION does not duplicate',async()=>{
  const session={id:'s1'};
  const h=lifecycleHarness({initialSession:session,profile:null});
  const lifecycle=createSessionLifecycle(h.dependencies);
  await lifecycle.startSessionLifecycle();
  assert.equal(h.calls.boot,1);
  await h.getAuthCallback()(session,'INITIAL_SESSION');
  assert.equal(h.calls.boot,1);
});

test('session lifecycle SIGNED_IN with empty profile boots and sign-out cleans login state',async()=>{
  const h=lifecycleHarness({initialSession:null,profile:null});
  const lifecycle=createSessionLifecycle(h.dependencies);
  await lifecycle.startSessionLifecycle();
  const session={id:'signed'};
  await h.getAuthCallback()(session,'SIGNED_IN');
  assert.equal(h.calls.boot,1);
  await h.getAuthCallback()(null,'SIGNED_OUT');
  assert.deepEqual(h.calls.state.slice(-2),[
    {session:null},
    {profile:null,organization:null,modules:[],catalogs:{}}
  ]);
  assert.equal(h.calls.login,2);
  assert.equal(h.calls.bind,2);
});

test('session lifecycle dispose unsubscribes provider and allows a clean restart',async()=>{
  const h=lifecycleHarness();
  const lifecycle=createSessionLifecycle(h.dependencies);
  await lifecycle.startSessionLifecycle();
  lifecycle.disposeSessionLifecycle();
  assert.equal(h.calls.unsubscribe,1);
  await lifecycle.startSessionLifecycle();
  assert.equal(h.calls.subscribe,2);
});

function applicationHarness({rejectStart=false}={}){
  const calls={dialogs:0,global:0,sw:0,loginFactory:0,bootstrapFactory:0,lifecycleFactory:0,lifecycleStart:0,lifecycleDispose:0,render:[],bind:0};
  const bootAuthenticated=async()=>{};
  const bindLogin=()=>{calls.bind+=1};
  const dependencies={
    installDialogSystem:()=>{calls.dialogs+=1},
    installGlobalNavigationEvents:options=>{calls.global+=1;calls.globalOptions=options},
    registerServiceWorker:()=>{calls.sw+=1},
    createAuthenticatedBootstrap:options=>{calls.bootstrapFactory+=1;calls.bootstrapOptions=options;return {bootAuthenticated}},
    createLoginController:options=>{calls.loginFactory+=1;calls.loginOptions=options;return {bindLogin}},
    createSessionLifecycle:options=>{
      calls.lifecycleFactory+=1;
      calls.lifecycleOptions=options;
      return {
        startSessionLifecycle(){
          calls.lifecycleStart+=1;
          return rejectStart?Promise.reject(new Error('fatal start')):Promise.resolve();
        },
        disposeSessionLifecycle(){calls.lifecycleDispose+=1}
      };
    },
    renderLogin:message=>calls.render.push(message),
    navigate:()=>{},openOrder:()=>{},moduleForStep:()=>{},toast:()=>{}
  };
  return {calls,dependencies,bootAuthenticated,bindLogin};
}

test('application composition installs dialog/global/SW once and wires factories correctly',async()=>{
  const h=applicationHarness();
  const app=createApplication(h.dependencies);
  const first=app.startApplication();
  const second=app.startApplication();
  assert.equal(first,second);
  await first;
  assert.deepEqual(
    {dialogs:h.calls.dialogs,global:h.calls.global,sw:h.calls.sw,login:h.calls.loginFactory,bootstrap:h.calls.bootstrapFactory,lifecycle:h.calls.lifecycleFactory,start:h.calls.lifecycleStart},
    {dialogs:1,global:1,sw:1,login:1,bootstrap:1,lifecycle:1,start:1}
  );
  assert.equal(h.calls.loginOptions.bootAuthenticated,h.bootAuthenticated);
  assert.equal(h.calls.lifecycleOptions.bootAuthenticated,h.bootAuthenticated);
  assert.equal(h.calls.lifecycleOptions.bindLogin,h.bindLogin);
  assert.equal(typeof h.calls.bootstrapOptions.bindLogin,'function');
  h.calls.bootstrapOptions.bindLogin();
  assert.equal(h.calls.bind,1);
});

test('application top-level failure renders login and rebinds instead of failing silently',async()=>{
  const h=applicationHarness({rejectStart:true});
  const app=createApplication(h.dependencies);
  await app.startApplication();
  assert.deepEqual(h.calls.render,['fatal start']);
  assert.equal(h.calls.bind,1);
});

test('application dispose delegates lifecycle cleanup',async()=>{
  const h=applicationHarness();
  const app=createApplication(h.dependencies);
  await app.startApplication();
  app.disposeApplication();
  assert.equal(h.calls.lifecycleDispose,1);
});

test('main is a minimal composition entry point with no auth/session/router ownership',()=>{
  const main=source('../../assets/js/main.js');
  assert.equal(main.trim(),'import {startApplication} from "./core/bootstrap/application.js";\n\nstartApplication();');
  for(const forbidden of [
    'getSession','onAuthChange','bootAuthenticated','createRouteDispatcher','initRouter',
    'renderLogin','setState','openOrder','moduleForStep','registerServiceWorker'
  ])assert.ok(!main.includes(forbidden),`main owns forbidden responsibility: ${forbidden}`);
});
