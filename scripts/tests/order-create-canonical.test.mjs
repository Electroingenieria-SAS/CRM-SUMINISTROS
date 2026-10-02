import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fmt } from "../../assets/js/core/format.js";
import { state } from "../../assets/js/core/state.js";
import { orderTypeOptions } from "../../assets/js/domains/orders/shared/order-formatters.js";
import {
  CLIENT_EXTRA_FIELDS,
  readClientExtraValues,
  writeClientExtraValues,
  clearClientExtraValues
} from "../../assets/js/domains/orders/create/client-extra-dialog.js";
import { orderFormStep } from "../../assets/js/domains/orders/create/order-form.js";

function fakeForm(values={}){
  const inputs=new Map(CLIENT_EXTRA_FIELDS.map(name=>[name,{value:String(values[name]??"")}]));
  return {
    querySelector(selector){
      const match=selector.match(/name="([^"]+)"/);
      return match?inputs.get(match[1])||null:null;
    }
  };
}

test("order type labels are canonical without mutating fmt or the state catalog",()=>{
  const previous=state.catalogs;
  const catalog=[
    {code:"PVC",name:"Pedido de venta crédito",extra:{source:"fixture"}},
    {code:"PVN",name:"Pedido de venta nacional"},
    {code:"PVE",name:"Pedido de venta especial"},
    {code:"PVP",name:"Pedido de venta proyecto"}
  ];
  const snapshot=structuredClone(catalog);
  const labelIdentity=fmt.label;
  try{
    state.catalogs={orderTypes:catalog};
    const options=orderTypeOptions(state.catalogs.orderTypes);
    assert.deepEqual(options.map(item=>item.name),["PVC","PVN","PVE","PVP"]);
    assert.deepEqual(["PVC","PVN","PVE","PVP"].map(code=>fmt.label(code)),["PVC","PVN","PVE","PVP"]);
    assert.equal(fmt.label,labelIdentity);
    assert.deepEqual(state.catalogs.orderTypes,snapshot);
  }finally{
    state.catalogs=previous;
  }
});

test("optional client data can be accepted or cleared without breaking the final form payload",()=>{
  const form=fakeForm();
  const yes={
    clientDocument:" 901234567 ",
    clientPhone:" 3100000000 ",
    externalReference:" EXT-42 ",
    requestedDeliveryDate:"2026-10-15"
  };
  assert.deepEqual(writeClientExtraValues(form,yes),{
    clientDocument:"901234567",
    clientPhone:"3100000000",
    externalReference:"EXT-42",
    requestedDeliveryDate:"2026-10-15"
  });
  assert.deepEqual(readClientExtraValues(form),{
    clientDocument:"901234567",
    clientPhone:"3100000000",
    externalReference:"EXT-42",
    requestedDeliveryDate:"2026-10-15"
  });
  assert.deepEqual(clearClientExtraValues(form),{
    clientDocument:"",
    clientPhone:"",
    externalReference:"",
    requestedDeliveryDate:""
  });
});

test("create order keeps three steps, hidden optional fields and no manual priority",()=>{
  const types=orderTypeOptions([{code:"PVC",name:"Legacy"}]);
  const first=orderFormStep(types,[{code:"CASH",name:"Contado"}],[{code:"CLIENT_POINT",name:"Punto"}],"<option value=\"76\">Valle</option>");
  for(const name of CLIENT_EXTRA_FIELDS)assert.match(first.content,new RegExp(`type="hidden" name="${name}"`));
  assert.doesNotMatch(first.content,/name="priority"/);
  const createSource=fs.readFileSync(new URL("../../assets/js/domains/orders/create/create-order.js",import.meta.url),"utf8");
  assert.match(createSource,/orderMaterialsStep\(\)/);
  assert.match(createSource,/orderConfirmationStep\(\)/);
  assert.match(createSource,/\.\.\.readClientExtraValues\(form\)/);
  assert.match(createSource,/openClientExtraDecision\(context\)/);
});

test("client extra dialog has an idempotent pending-decision guard and no global observer",()=>{
  const source=fs.readFileSync(new URL("../../assets/js/domains/orders/create/client-extra-dialog.js",import.meta.url),"utf8");
  assert.match(source,/const pendingDecisions=new WeakMap\(\)/);
  assert.match(source,/pendingDecisions\.has\(modal\)/);
  assert.doesNotMatch(source,/MutationObserver/);
  assert.doesNotMatch(source,/document\.addEventListener\("click"/);
});
