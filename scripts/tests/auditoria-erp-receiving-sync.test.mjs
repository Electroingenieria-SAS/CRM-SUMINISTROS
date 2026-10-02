import assert from "node:assert/strict";
import test from "node:test";

class FakeEvents{
  constructor(){this.listeners=new Map()}
  addEventListener(type,listener){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(listener)}
  removeEventListener(type,listener){this.listeners.get(type)?.delete(listener)}
  count(type){return this.listeners.get(type)?.size||0}
  emit(type,event={}){for(const listener of [...(this.listeners.get(type)||[])])listener(event)}
}

const warnings=[];
const originalWarn=console.warn;
console.warn=(...args)=>warnings.push(args);

const windowEvents=new FakeEvents();
const documentEvents=new FakeEvents();
let nextTimer=1;
const timeouts=new Map();
const intervals=new Map();
const rpcCalls=[];
const invokeCalls=[];
let rpcHandler=async()=>({data:[],error:null});
let invokeHandler=async()=>({data:{success:true},error:null});
let authCallback=null;
let authUnsubscribed=0;

const client={
  rpc(name,params,options){
    rpcCalls.push({name,params,options});
    return rpcHandler(name,params,options);
  },
  functions:{
    invoke(name,options){
      invokeCalls.push({name,options});
      return invokeHandler(name,options);
    }
  },
  auth:{
    onAuthStateChange(callback){
      authCallback=callback;
      return {data:{subscription:{unsubscribe(){authUnsubscribed++}}}};
    }
  }
};
const rpcIdentity=client.rpc;

Object.defineProperty(globalThis,"navigator",{value:{onLine:true},configurable:true,writable:true});
globalThis.document={
  visibilityState:"visible",
  title:"CRM fixture",
  addEventListener:documentEvents.addEventListener.bind(documentEvents),
  removeEventListener:documentEvents.removeEventListener.bind(documentEvents)
};
globalThis.window={
  location:{search:"",hash:"",href:"https://crm.invalid/"},
  supabase:{createClient:()=>client},
  addEventListener:windowEvents.addEventListener.bind(windowEvents),
  removeEventListener:windowEvents.removeEventListener.bind(windowEvents),
  setTimeout(callback,delay){const id=nextTimer++;timeouts.set(id,{callback,delay});return id},
  clearTimeout(id){timeouts.delete(id)},
  setInterval(callback,delay){const id=nextTimer++;intervals.set(id,{callback,delay});return id},
  clearInterval(id){intervals.delete(id)}
};

const adapter=await import("../../assets/js/integrations/auditoria-erp/receiving-sync.js");

test.after(()=>{
  adapter.disposeAuditoriaErpRetryScheduler();
  console.warn=originalWarn;
});

test.beforeEach(()=>{
  adapter.disposeAuditoriaErpRetryScheduler();
  navigator.onLine=true;
  document.visibilityState="visible";
  rpcCalls.length=0;
  invokeCalls.length=0;
  warnings.length=0;
  rpcHandler=async()=>({data:[],error:null});
  invokeHandler=async()=>({data:{success:true},error:null});
  timeouts.clear();
  intervals.clear();
  authCallback=null;
  authUnsubscribed=0;
});

test("sync invokes the authorized Edge Function with the receipt id",async()=>{
  await adapter.syncReceiptToAuditoriaErp("receipt-1");
  assert.deepEqual(invokeCalls,[{
    name:"erp-auditoria-bridge",
    options:{body:{receiptId:"receipt-1"}}
  }]);
});

test("notify keeps CRM save non-fatal when AuditoriaERP fails",async()=>{
  invokeHandler=async()=>({data:null,error:new Error("AuditoriaERP unavailable")});
  rpcHandler=async()=>({data:[],error:null});
  const result=await adapter.notifyGoodsReceiptCreated("receipt-2");
  await Promise.resolve();
  assert.equal(result,null);
  assert.equal(invokeCalls[0].options.body.receiptId,"receipt-2");
  assert.ok(warnings.some(args=>String(args[0]).includes("Recepción guardada")));
});

test("pending retry uses the normal rpc contract and drains at most the returned ids",async()=>{
  rpcHandler=async(name,params)=>{
    assert.equal(name,"erp_x_auditoria_erp_pending");
    assert.deepEqual(params,{p_limit:20});
    return {data:[{receiptId:"receipt-3"},{receipt_id:"receipt-4"},{receiptId:null}],error:null};
  };
  await adapter.retryPendingAuditoriaErp();
  assert.equal(rpcCalls.length,1);
  assert.deepEqual(invokeCalls.map(call=>call.options.body.receiptId),["receipt-3","receipt-4"]);
});

test("pending retry is single-flight",async()=>{
  let release;
  const pending=new Promise(resolve=>{release=resolve});
  rpcHandler=()=>pending;
  const first=adapter.retryPendingAuditoriaErp();
  const second=adapter.retryPendingAuditoriaErp();
  assert.equal(first,second);
  assert.equal(rpcCalls.length,1);
  release({data:[],error:null});
  await first;
});

test("offline or hidden browser state prevents retry",async()=>{
  navigator.onLine=false;
  await adapter.retryPendingAuditoriaErp();
  assert.equal(rpcCalls.length,0);

  navigator.onLine=true;
  document.visibilityState="hidden";
  await adapter.retryPendingAuditoriaErp();
  assert.equal(rpcCalls.length,0);
});

test("scheduler is idempotent, preserves client.rpc identity and dispose cleans lifecycle",()=>{
  const firstDispose=adapter.installAuditoriaErpRetryScheduler();
  const secondDispose=adapter.installAuditoriaErpRetryScheduler();

  assert.equal(firstDispose,secondDispose);
  assert.equal(client.rpc,rpcIdentity);
  assert.equal(windowEvents.count("online"),1);
  assert.equal(windowEvents.count("focus"),1);
  assert.equal(windowEvents.count("erp:work-changed"),1);
  assert.equal(windowEvents.count("pagehide"),1);
  assert.equal(documentEvents.count("visibilitychange"),1);
  assert.deepEqual([...timeouts.values()].map(item=>item.delay).sort((a,b)=>a-b),[250,2000]);
  assert.deepEqual([...intervals.values()].map(item=>item.delay),[10000]);

  authCallback("SIGNED_IN",{user:{id:"fixture"}});
  assert.ok([...timeouts.values()].some(item=>item.delay===150));

  adapter.disposeAuditoriaErpRetryScheduler();

  assert.equal(windowEvents.count("online"),0);
  assert.equal(windowEvents.count("focus"),0);
  assert.equal(windowEvents.count("erp:work-changed"),0);
  assert.equal(windowEvents.count("pagehide"),0);
  assert.equal(documentEvents.count("visibilitychange"),0);
  assert.equal(timeouts.size,0);
  assert.equal(intervals.size,0);
  assert.equal(authUnsubscribed,1);
  assert.equal(client.rpc,rpcIdentity);
});
