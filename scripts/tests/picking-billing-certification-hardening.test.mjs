import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read=url=>fs.readFileSync(new URL(url,import.meta.url),"utf8");

test("Picking render cycle replaces shell before rebinding and keeps backend errors visible",()=>{
  const controller=read("../../assets/js/domains/picking/picking-controller.js");
  const pickup=read("../../assets/js/domains/picking/pickup/pickup-selection.js");
  const verification=read("../../assets/js/domains/picking/verification/submit-verification.js");

  assert.match(controller,/host\.innerHTML=shell\(/);
  assert.match(controller,/button\.disabled=true;\s*try\{/s);
  assert.match(controller,/catch\(error\).*button\.disabled=false/s);
  assert.match(pickup,/button\.disabled=true;\s*try\{await onConfirm\(ids\)\}catch\(error\).*button\.disabled=false/s);
  assert.match(verification,/button\.disabled=true;\s*try\{/s);
  assert.match(verification,/catch\(error\).*button\.disabled=false/s);
});

test("Picking result contracts keep FOUND origins, MISSING novelty and required origin validation",()=>{
  const bindings=read("../../assets/js/domains/picking/verification/result-bindings.js");
  const origins=read("../../assets/js/domains/picking/origins/origin-selection.js");
  assert.match(bindings,/textarea\.required=button\.dataset\.result==="MISSING"/);
  assert.match(bindings,/if\(button\.dataset\.result==="FOUND"\)textarea\.value=""/);
  assert.match(origins,/row\.dataset\.originLoaded==="true"&&row\.dataset\.originValid==="true"/);
  assert.match(origins,/row\.dataset\.result==="FOUND".*readOrigins\(row\)/s);
  assert.match(origins,/novelty:row\.querySelector\("textarea"\)/);
});

test("Billing Caja and Logística preserve route choice, PVP document and notices",()=>{
  const cash=read("../../assets/js/domains/billing/ui/cash-invoice.js");
  const logistics=read("../../assets/js/domains/billing/ui/logistics-billing.js");
  const focus=read("../../assets/js/domains/billing/ui/billing-focus.js");

  assert.match(cash,/Caja · Pedido pagado de contado/);
  assert.match(cash,/data-cash-action="invoice"/);
  assert.match(logistics,/data-billing-action="cash"/);
  assert.match(logistics,/pvp\?"annex":"invoice"/);
  assert.match(logistics,/Anexo PVP/);
  assert.match(logistics,/Enviar a Caja/);
  assert.match(focus,/Hay una novedad pendiente · abre para resolver/);
  assert.match(focus,/button\.onclick=event=>/);
});

test("Billing upload interaction contract covers picker keyboard drop change remove and validation",()=>{
  const upload=read("../../assets/js/domains/billing/uploads/upload-experience.js");
  for(const contract of [
    /<label class="billing-dropzone-v1199" for="\$\{escapeHtml\(input\.id\)\}"/,
    /event\.key==="Enter"\|\|event\.key===" "/,
    /input\.click\(\)/,
    /dropzone\.ondrop=/,
    /new DataTransfer\(\)/,
    /input\.dispatchEvent\(new Event\("change"/,
    /data-billing-file-remove/,
    /input\.value=""/,
    /documentKind\(file\)==="unknown"/,
    /Number\(file\.size\|\|0\)<=0/,
    /Number\(file\.size\)>maxFileBytes/
  ])assert.match(upload,contract);
});

test("Invoice save contract remains explicit institutional-upload-first and exactly once",()=>{
  const upload=read("../../assets/js/domains/billing/uploads/invoice-upload.js");
  const adapter=read("../../assets/js/domains/billing/invoice-reader/save/invoice-save-adapter.js");
  const storeAt=upload.indexOf("await storeBillingFile(data,file,\"INVOICE\"");
  const payloadAt=upload.indexOf("buildInvoiceReaderPayload(dialog,basePayload)");
  const saveAt=upload.indexOf("await saveInvoiceExplicit(data.order.id,payload)");
  assert.ok(storeAt>=0&&payloadAt>storeAt&&saveAt>payloadAt);
  assert.equal((upload.match(/saveInvoiceExplicit\(data\.order\.id,payload\)/g)||[]).length,1);
  assert.equal((adapter.match(/return save\(orderId,payload\)/g)||[]).length,1);
  assert.doesNotMatch(adapter,/api\.saveInvoice\s*=/);
  assert.match(adapter,/currency:"COP"/);
});
