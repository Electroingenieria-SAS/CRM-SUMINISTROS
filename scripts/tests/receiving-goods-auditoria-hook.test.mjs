import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source=fs.readFileSync(new URL("../../assets/js/domains/receiving/goods/create/receipt-form.js",import.meta.url),"utf8");

function extractNotifierFactory(){
  const start=source.indexOf("export function createAuditoriaReceiptNotifier(");
  const end=source.indexOf("\n\nexport function openGoodsReceiptForm",start);
  assert.ok(start>=0&&end>start,"receipt-form debe exponer el notifier focal antes del formulario");
  const code=source.slice(start,end).replace(/^export\s+/,"");
  return new Function(
    "notifyGoodsReceiptCreated","queueMicrotask","console",
    `${code}; return createAuditoriaReceiptNotifier;`
  );
}

test("goods receipt hook notifies exactly once per saved receipt and ignores duplicate confirm",async()=>{
  const queued=[];
  const calls=[];
  const createNotifier=extractNotifierFactory()(
    async receiptId=>{calls.push(receiptId)},
    callback=>queued.push(callback),
    console
  );
  const notify=createNotifier(async receiptId=>{calls.push(receiptId)},callback=>queued.push(callback));

  const result={receipt:{id:"receipt-1"}};
  assert.equal(notify(result),true);
  assert.equal(notify(result),false);
  assert.equal(calls.length,0);
  assert.equal(queued.length,1);

  queued.shift()();
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(calls,["receipt-1"]);
});

test("goods receipt hook is safe when receipt id is missing",()=>{
  const queued=[];
  const createNotifier=extractNotifierFactory()(
    async()=>{throw new Error("notify should not run")},
    callback=>queued.push(callback),
    console
  );
  const notify=createNotifier(async()=>{throw new Error("notify should not run")},callback=>queued.push(callback));

  assert.equal(notify({receipt:{receipt_number:"REC-1"}}),false);
  assert.equal(notify({receipt:null}),false);
  assert.equal(notify(null),false);
  assert.equal(queued.length,0);
});

test("goods receipt hook keeps external rejection fire-and-forget and non-fatal",async()=>{
  const queued=[];
  const warnings=[];
  const fakeConsole={warn:(...args)=>warnings.push(args)};
  const createNotifier=extractNotifierFactory()(
    async()=>{},
    callback=>queued.push(callback),
    fakeConsole
  );
  const notify=createNotifier(
    async()=>{throw new Error("AuditoriaERP unavailable")},
    callback=>queued.push(callback)
  );

  assert.equal(notify({receipt:{id:"receipt-2"}}),true);
  assert.equal(queued.length,1);
  queued.shift()();
  await Promise.resolve();
  await Promise.resolve();
  assert.ok(warnings.some(args=>String(args[0]).includes("Hook post-create no fatal")));
});

test("receipt-form hooks the notifier immediately after successful create RPC",()=>{
  const rpcIndex=source.indexOf('await rpc("erp_x_goods_receipt_create"');
  const notifyIndex=source.indexOf("notifyAuditoriaReceipt(result);");
  const toastIndex=source.indexOf('toast(message,"success",8000)');
  assert.ok(rpcIndex>=0&&notifyIndex>rpcIndex&&toastIndex>notifyIndex);
  assert.equal((source.match(/notifyAuditoriaReceipt\(result\);/g)||[]).length,1);
});
