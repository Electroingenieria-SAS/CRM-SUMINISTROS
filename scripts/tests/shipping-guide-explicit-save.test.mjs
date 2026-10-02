import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { api } from "../../assets/js/services/api.js";
import { parseGuideText, localizedNumber } from "../../assets/js/domains/logistics/shipping/guide/reader.js";
import { buildShippingGuidePayload } from "../../assets/js/domains/logistics/shipping/guide/payload.js";
import { saveShippingGuideExplicit } from "../../assets/js/domains/logistics/shipping/guide/save-guide.js";
import { applyAutoreadValues } from "../../assets/js/domains/logistics/shipping/guide/guide-dialog.js";

test("shipping guide parser detects carrier, tracking, carrier invoice and localized freight cost",()=>{
  const parsed=parseGuideText("Transportadora: TCC\nGuía: ABC123456\nFactura transportadora: FT-9988\nCosto flete: COP 1.234.567,89");
  assert.equal(parsed.carrier,"TCC");
  assert.equal(parsed.trackingNumber,"ABC123456");
  assert.equal(parsed.carrierInvoiceNumber,"FT-9988");
  assert.equal(parsed.carrierCost,1234567.89);
  assert.equal(localizedNumber("$ 123.456"),123456);
  assert.equal(localizedNumber("1,234.56"),1234.56);
});

test("shipping payload validates required carrier data, uses COP and preserves existing tracking/carrier",()=>{
  const payload=buildShippingGuidePayload({
    existingPayload:{trackingNumber:"OLD-1",carrier:"TCC",guideFileId:"file-1"},
    carrierInvoiceNumber:"INV-77",
    carrierCost:"45.500",
    carrierCostCurrency:"COP"
  });
  assert.deepEqual(payload,{
    trackingNumber:"OLD-1",
    carrier:"TCC",
    guideFileId:"file-1",
    carrierInvoiceNumber:"INV-77",
    carrierCostCurrency:"COP",
    carrierCost:45500
  });
  assert.throws(()=>buildShippingGuidePayload({trackingNumber:"G1",carrier:"TCC",carrierCost:100}),/factura/i);
  assert.throws(()=>buildShippingGuidePayload({trackingNumber:"G1",carrier:"TCC",carrierInvoiceNumber:"I1",carrierCost:0}),/mayor que 0/i);
});

test("manual values are not overwritten by autoread",()=>{
  const inputs={
    carrier:{name:"carrier",value:"Manual Carrier",dataset:{manual:"1"}},
    trackingNumber:{name:"trackingNumber",value:"MANUAL-TRACK",dataset:{}},
    carrierInvoiceNumber:{name:"carrierInvoiceNumber",value:"",dataset:{}},
    carrierCost:{name:"carrierCost",value:"",dataset:{}}
  };
  const hints=Object.fromEntries(Object.keys(inputs).map(name=>[name,{textContent:"",className:""}]));
  const dialog={
    querySelector(selector){
      const input=selector.match(/^\[name="(.+)"\]$/)?.[1];
      if(input)return inputs[input]||null;
      const hint=selector.match(/^\[data-guide-source="(.+)"\]$/)?.[1];
      return hint?hints[hint]||null:null;
    }
  };
  applyAutoreadValues(dialog,{carrier:"AUTO",trackingNumber:"AUTO-TRACK",carrierInvoiceNumber:"AUTO-INV",carrierCost:25000});
  assert.equal(inputs.carrier.value,"Manual Carrier");
  assert.equal(inputs.trackingNumber.value,"AUTO-TRACK");
  assert.equal(inputs.carrierInvoiceNumber.value,"AUTO-INV");
  assert.equal(inputs.carrierCost.value,"25000");
});

test("explicit save calls api contract once without changing api.saveShippingGuide identity",async()=>{
  const identity=api.saveShippingGuide;
  const calls=[];
  const result=await saveShippingGuideExplicit("order-1",{trackingNumber:"G1"},{save:async(...args)=>{calls.push(args);return {ok:true}}});
  assert.deepEqual(result,{ok:true});
  assert.deepEqual(calls,[["order-1",{trackingNumber:"G1"}]]);
  assert.equal(api.saveShippingGuide,identity);
});

test("canonical guide dialog owns picker, drop, keyboard and document reader without a global observer",()=>{
  const source=fs.readFileSync(new URL("../../assets/js/domains/logistics/shipping/guide/guide-dialog.js",import.meta.url),"utf8");
  for(const token of ["data-guide-dropzone","data-guide-choose","keydown","Enter","dragover","drop","readShippingGuideFile","dataset.manual"])assert.ok(source.includes(token),`missing ${token}`);
  assert.doesNotMatch(source,/MutationObserver/);
  assert.doesNotMatch(source,/modal-head h3/);
});

test("incomplete payload and non-COP currency reject before persistence",()=>{
  assert.throws(
    ()=>buildShippingGuidePayload({trackingNumber:"G1",carrier:"TCC",carrierInvoiceNumber:"INV-1",carrierCost:15000,carrierCostCurrency:"USD"}),
    /moneda.*COP/i
  );
  assert.throws(
    ()=>buildShippingGuidePayload({trackingNumber:"G1",carrier:"TCC",carrierInvoiceNumber:"",carrierCost:15000,carrierCostCurrency:"COP"}),
    /factura/i
  );
  assert.throws(
    ()=>buildShippingGuidePayload({trackingNumber:"",carrier:"TCC",carrierInvoiceNumber:"INV-1",carrierCost:15000,carrierCostCurrency:"COP"}),
    /número de guía/i
  );
});

test("omitted carrier preserves the existing carrier while an explicit empty carrier is rejected",()=>{
  const preserved=buildShippingGuidePayload({
    existingPayload:{
      trackingNumber:"G-OLD",
      carrier:"TCC",
      carrierInvoiceNumber:"INV-OLD",
      carrierCost:25000,
      carrierCostCurrency:"COP"
    },
    trackingNumber:"G-NEW",
    carrierInvoiceNumber:"INV-NEW",
    carrierCost:30000
  });
  assert.equal(preserved.carrier,"TCC");
  assert.throws(()=>buildShippingGuidePayload({
    existingPayload:preserved,
    carrier:"",
    trackingNumber:"G-NEW",
    carrierInvoiceNumber:"INV-NEW",
    carrierCost:30000,
    carrierCostCurrency:"COP"
  }),/transportadora/i);
});

test("backend rejection propagates and never becomes a false success",async()=>{
  const identity=api.saveShippingGuide;
  let calls=0;
  await assert.rejects(
    ()=>saveShippingGuideExplicit("order-1",{trackingNumber:"G1"},{save:async()=>{calls++;throw new Error("shipping backend rejected")}}),
    /shipping backend rejected/
  );
  assert.equal(calls,1);
  assert.equal(api.saveShippingGuide,identity);
});

test("canonical modal disables confirm before awaiting Shipping onConfirm",()=>{
  const source=fs.readFileSync(new URL("../../assets/js/core/ui/dialog.js",import.meta.url),"utf8");
  const disabledAt=source.indexOf("confirm.disabled=true");
  const awaitAt=source.indexOf("await onConfirm?.(dialog)");
  assert.ok(disabledAt>=0&&awaitAt>disabledAt,"confirm must be disabled before awaiting onConfirm");
});
