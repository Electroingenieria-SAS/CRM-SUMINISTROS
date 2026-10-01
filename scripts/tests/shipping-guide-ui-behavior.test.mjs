import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { api } from "../../assets/js/services/api.js";
import {
  bindGuideReader,
  readGuideIntoDialog
} from "../../assets/js/domains/logistics/shipping/guide/guide-dialog.js";
import { buildShippingGuidePayload } from "../../assets/js/domains/logistics/shipping/guide/payload.js";
import { saveShippingGuideExplicit } from "../../assets/js/domains/logistics/shipping/guide/save-guide.js";

function eventNode(initial={}){
  const listeners=new Map();
  return {
    ...initial,
    dataset:initial.dataset||{},
    style:initial.style||{},
    className:initial.className||"",
    classList:{
      values:new Set(),
      add(...names){names.forEach(name=>this.values.add(name))},
      remove(...names){names.forEach(name=>this.values.delete(name))}
    },
    addEventListener(type,handler){
      if(!listeners.has(type))listeners.set(type,[]);
      listeners.get(type).push(handler);
    },
    emit(type,event={}){
      for(const handler of listeners.get(type)||[])handler({
        preventDefault(){},
        stopPropagation(){},
        target:this,
        ...event
      });
    },
    listenerCount(type){return (listeners.get(type)||[]).length}
  };
}

function uiHarness(){
  const controls={
    carrier:eventNode({name:"carrier",value:""}),
    trackingNumber:eventNode({name:"trackingNumber",value:""}),
    carrierInvoiceNumber:eventNode({name:"carrierInvoiceNumber",value:""}),
    carrierCost:eventNode({name:"carrierCost",value:""})
  };
  const hints=Object.fromEntries(Object.keys(controls).map(name=>[name,eventNode({textContent:""})]));
  const input=eventNode({files:[],clicked:0,click(){this.clicked++}});
  const choose=eventNode();
  const zone=eventNode();
  const title=eventNode({textContent:""});
  const meta=eventNode({textContent:""});
  const state=eventNode({dataset:{guideReaderState:"idle"}});
  const status=eventNode({textContent:""});
  const percent=eventNode({textContent:""});
  const bar=eventNode({style:{}});
  const message=eventNode({textContent:""});
  const map={
    '[name="guideFile"]':input,
    "[data-guide-dropzone]":zone,
    "[data-guide-choose]":choose,
    "[data-guide-file-title]":title,
    "[data-guide-file-meta]":meta,
    ".guide-reader-status-v11101":state,
    "[data-guide-reader-label]":status,
    "[data-guide-reader-percent]":percent,
    "[data-guide-reader-bar]":bar,
    "[data-guide-reader-message]":message
  };
  const dialog={
    dataset:{},
    querySelector(selector){
      const field=selector.match(/^\[name="(.+)"\]$/)?.[1];
      if(field&&controls[field])return controls[field];
      const hint=selector.match(/^\[data-guide-source="(.+)"\]$/)?.[1];
      if(hint)return hints[hint]||null;
      return map[selector]||null;
    },
    querySelectorAll(selector){
      return selector===".guide-reader-field-v11101 input"?Object.values(controls):[];
    }
  };
  return {dialog,controls,hints,input,choose,zone,state,status,message};
}

test("Shipping UI reader opens, reads, remains editable and binds handlers only once",async()=>{
  const h=uiHarness();
  bindGuideReader(h.dialog);
  bindGuideReader(h.dialog);

  assert.equal(h.choose.listenerCount("click"),1);
  assert.equal(h.zone.listenerCount("keydown"),1);
  assert.equal(h.input.listenerCount("change"),1);

  h.choose.emit("click");
  assert.equal(h.input.clicked,1);
  h.zone.emit("keydown",{key:"Enter"});
  assert.equal(h.input.clicked,2);

  h.controls.carrier.value="Transportadora manual";
  h.controls.carrier.emit("input");
  assert.equal(h.controls.carrier.dataset.manual,"1");

  const parsed=await readGuideIntoDialog(
    h.dialog,
    {name:"guia.pdf",size:2048},
    {reader:async()=>({
      parsed:{
        carrier:"AUTO CARRIER",
        trackingNumber:"TRACK-900",
        carrierInvoiceNumber:"INV-900",
        carrierCost:45000
      }
    })}
  );

  assert.equal(parsed.trackingNumber,"TRACK-900");
  assert.equal(h.controls.carrier.value,"Transportadora manual","manual carrier must win");
  assert.equal(h.controls.trackingNumber.value,"TRACK-900");
  assert.equal(h.controls.carrierInvoiceNumber.value,"INV-900");
  assert.equal(h.controls.carrierCost.value,"45000");
  assert.equal(h.state.dataset.guideReaderState,"ready");

  h.controls.carrierInvoiceNumber.value="INV-CORREGIDA";
  h.controls.carrierInvoiceNumber.emit("input");
  h.controls.carrierCost.value="50000";
  h.controls.carrierCost.emit("input");
  assert.equal(h.controls.carrierInvoiceNumber.dataset.manual,"1");
  assert.equal(h.controls.carrierCost.dataset.manual,"1");
});

test("final visible Shipping values build the saved payload and save exactly once",async()=>{
  const h=uiHarness();
  h.controls.carrier.value="TCC";
  h.controls.trackingNumber.value="TRACK-FINAL";
  h.controls.carrierInvoiceNumber.value="INV-FINAL";
  h.controls.carrierCost.value="52.500";

  const payload=buildShippingGuidePayload({
    trackingNumber:h.controls.trackingNumber.value,
    carrier:h.controls.carrier.value,
    carrierInvoiceNumber:h.controls.carrierInvoiceNumber.value,
    carrierCost:h.controls.carrierCost.value,
    carrierCostCurrency:"COP"
  });
  const identity=api.saveShippingGuide;
  const calls=[];
  await saveShippingGuideExplicit("order-final",payload,{save:async(...args)=>{calls.push(args);return {ok:true}}});
  assert.equal(calls.length,1);
  assert.equal(calls[0][0],"order-final");
  assert.deepEqual(calls[0][1],{
    trackingNumber:"TRACK-FINAL",
    carrier:"TCC",
    carrierInvoiceNumber:"INV-FINAL",
    carrierCostCurrency:"COP",
    carrierCost:52500
  });
  assert.equal(api.saveShippingGuide,identity);
});

test("cancel/read interactions do not persist; save exists only in confirm path",async()=>{
  const h=uiHarness();
  bindGuideReader(h.dialog);
  await readGuideIntoDialog(h.dialog,{name:"guia.csv",size:100},{reader:async()=>({parsed:{
    carrier:"TCC",trackingNumber:"G1",carrierInvoiceNumber:"I1",carrierCost:1000
  }})});
  const source=fs.readFileSync(new URL("../../assets/js/domains/logistics/shipping/guide/guide-dialog.js",import.meta.url),"utf8");
  assert.equal((source.match(/saveShippingGuideExplicit\(/g)||[]).length,1);
  assert.match(source,/onConfirm:async dialog=>/);
  assert.doesNotMatch(source,/MutationObserver/);
  assert.doesNotMatch(source,/document\.addEventListener\(["']click/);
});

test("requested carrier aliases are not a hidden Shipping Guide contract",()=>{
  const source=fs.readFileSync(new URL("../../assets/js/domains/logistics/shipping/guide/guide-dialog.js",import.meta.url),"utf8");
  for(const unsupported of ["carrierName","carrierDocument","carrierPhone","carrierVehiclePlate","carrierFreightAmount"]){
    assert.equal(source.includes(unsupported),false,unsupported);
  }
  for(const canonical of ['name="carrier"','name="trackingNumber"','name="carrierInvoiceNumber"','name="carrierCost"']){
    assert.ok(source.includes(canonical),canonical);
  }
});
