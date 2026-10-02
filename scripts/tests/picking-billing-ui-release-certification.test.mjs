import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { shell } from "../../assets/js/domains/picking/ui/picking-shell.js";
import { itemRow } from "../../assets/js/domains/picking/verification/material-row.js";
import {
  adaptPickingFooter,
  continuePicking,
  pickingStage,
  syncPickingNext
} from "../../assets/js/domains/picking/ui/picking-focus.js";
import {
  adaptBillingFooter,
  billingStage,
  syncBillingNext
} from "../../assets/js/domains/billing/ui/billing-focus.js";
import { field } from "../../assets/js/domains/billing/invoice-reader/ui/invoice-dialog.js";
import { setAuto } from "../../assets/js/domains/billing/invoice-reader/ui/manual-fields.js";
import {
  BILLING_MAX_FILE_BYTES,
  renderBillingUploadState,
  validateBillingUploadFile
} from "../../assets/js/domains/billing/uploads/upload-experience.js";

const read=relative=>fs.readFileSync(new URL("../../"+relative,import.meta.url),"utf8");
const count=(value,needle)=>value.split(needle).length-1;

function classList(initial=[]){
  const values=new Set(initial);
  return {
    add(...names){names.forEach(name=>values.add(name))},
    remove(...names){names.forEach(name=>values.delete(name))},
    contains(name){return values.has(name)},
    toggle(name,force){const on=force===undefined?!values.has(name):Boolean(force);if(on)values.add(name);else values.delete(name);return on}
  };
}
function action({visible=true,disabled=false}={}){
  return {
    disabled,
    dataset:{testVisible:visible?"1":"0"},
    clicked:0,
    focused:0,
    classList:classList(),
    click(){this.clicked++},
    focus(){this.focused++},
    scrollIntoView(){},
    setAttribute(name,value){this[name]=value},
    removeAttribute(name){delete this[name]}
  };
}

const pickingData={
  order:{
    id:"order-1",
    order_number:"PED-001",
    client_name:"Cliente Demo",
    order_type_code:"PVC",
    payment_condition_code:"CASH",
    delivery_route_code:"CLIENT_POINT",
    current_step_code:"ALISTAMIENTO",
    current_assignee_name:"Auxiliar Demo",
    metadata:{}
  },
  items:[{id:"item-1",reference:"REF-1",description:"Cable",quantity:2,unit:"M",item_status:"PENDING"}],
  tasks:[],
  pickingRounds:[]
};

test("Picking canonical shell renders one root, facts, footer, support slot and secondary details",()=>{
  const html=shell(pickingData,'<section class="picking-take-card"><button type="button" data-picking-take>Tomar pedido</button></section>');
  assert.equal(count(html,'class="modal-overlay simple-process-overlay"'),1);
  assert.equal(count(html,'class="picking-order-strip"'),1);
  assert.equal(count(html,'class="parallel-work-footer"'),1);
  assert.equal(count(html,"data-order-support-slot"),1);
  assert.equal(count(html,'class="simple-details"'),1);
  assert.equal(count(html,"data-picking-take"),1);
  const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(match=>match[1]);
  assert.equal(new Set(ids).size,ids.length,"Picking shell must not duplicate ids");
});

test("Picking footer/Next double adaptation keeps one logical action and disabled state coherent",()=>{
  const close=action(),next=action();
  close.dataset={};
  next.dataset={takeAnother:"ALISTAMIENTO"};
  const actions={querySelector(selector){
    if(selector.includes("data-close"))return close;
    if(selector.includes("not(.picking-close-other)"))return next;
    if(selector.includes("data-picking-next-v1195"))return next;
    return null;
  }};
  const footer={dataset:{},querySelector(selector){return selector===".parallel-work-actions"?actions:null}};
  const modal={
    querySelector(selector){
      if(selector===".parallel-work-footer")return footer;
      if(selector==="[data-picking-next-v1195]")return next;
      if(selector===".picking-empty")return {};
      return null;
    },
    querySelectorAll(){return []}
  };
  adaptPickingFooter(modal);
  adaptPickingFooter(modal);
  assert.equal(next.dataset.pickingNextV1195,"1");
  assert.equal(close.dataset.takeAnother,"ALISTAMIENTO");
  assert.equal(pickingStage(modal),"BLOCKED");
  assert.equal(syncPickingNext(modal),false);
  assert.equal(next.disabled,true);
  assert.equal(next["aria-disabled"],"true");
});

test("Picking one continue call maps to one effective action and a valid focusable target",()=>{
  const take=action();
  const modal={
    querySelector(selector){
      if(selector==="[data-picking-take]")return take;
      return null;
    },
    querySelectorAll(){return []}
  };
  assert.equal(pickingStage(modal),"TAKE");
  assert.equal(continuePicking(modal),"TAKE");
  assert.equal(take.clicked,1);
});

test("Picking FOUND, MISSING and cut-origin DOM expose the expected state",()=>{
  const base={id:"item-1",reference:"REF-1",description:"Cable",quantity:2,unit:"M",metadata:{}};
  const found=itemRow({...base,requires_cut:false},0,{result:"FOUND"});
  assert.match(found,/data-result="FOUND"/);
  assert.match(found,/class="picking-origin" data-origin-wrap(?! hidden)/);
  assert.match(found,/data-novelty-wrap hidden/);
  assert.match(found,/Encontrado/);

  const missing=itemRow({...base,id:"item-2",requires_cut:false},1,{result:"MISSING",novelty:"No apareció"});
  assert.match(missing,/data-result="MISSING"/);
  assert.match(missing,/data-origin-wrap hidden/);
  assert.match(missing,/data-novelty-wrap(?! hidden)/);
  assert.match(missing,/textarea[^>]*required/);
  assert.match(missing,/No apareció/);

  const cut=itemRow({...base,id:"item-3",requires_cut:true,requested_cut_length:1.5},2,{result:"FOUND"});
  assert.match(cut,/picking-cut-origin-note(?![^>]*hidden)/);
  assert.match(cut,/Origen trazado por Corte/);
  assert.doesNotMatch(cut,/data-origin-wrap/);
});

test("Picking MISSING novelty label is structurally associated and row ids stay unique",()=>{
  const rows=[0,1].map(index=>itemRow({id:"item-"+(index+1),reference:"REF",description:"Cable",quantity:1,unit:"M",requires_cut:false,metadata:{}},index,{result:"MISSING"}));
  const ids=[];
  for(const html of rows){
    const label=html.match(/<label([^>]*)>¿Por qué no se encontró\? \*<\/label>/);
    const textarea=html.match(/<textarea([^>]*)>/);
    assert.ok(label&&textarea,"MISSING novelty label and textarea must render");
    const forId=label[1].match(/\bfor="([^"]+)"/)?.[1]||"";
    const textId=textarea[1].match(/\bid="([^"]+)"/)?.[1]||"";
    assert.ok(forId&&forId===textId,"MISSING novelty label must use matching for/id");
    ids.push(textId);
  }
  assert.equal(new Set(ids).size,ids.length,"novelty textarea ids must be unique inside one rendered item list");
});

test("Picking origin option markup is balanced",()=>{
  const source=read("assets/js/domains/picking/origins/origin-plan.js");
  const start=source.indexOf('<div class="picking-origin-options">');
  const end=source.indexOf('<div class="picking-origin-total"');
  assert.ok(start>=0&&end>start,"origin options template must exist");
  const template=source.slice(start,end);
  assert.match(template,/<label class="picking-origin-qty">[\s\S]*?<\/label>/,"quantity label must remain balanced");
  assert.match(template,/candidate\.recommended\?\'<em>Recomendado<\/em>\':""\}[\s\S]*?<\/div>/,"origin option must close as div");
  assert.doesNotMatch(template,/candidate\.recommended\?\'<em>Recomendado<\/em>\':""\}[\s\S]*?<\/label>\s*`\}\)\.join/,"origin option must not close as label");
});

test("Picking origin checkbox has a dynamic escaped accessible name",()=>{
  const source=read("assets/js/domains/picking/origins/origin-plan.js");
  assert.match(source,/const originLabel=\[candidate\.warehouseCode,candidate\.location\]\.filter\(Boolean\)\.join\(" · "\)\|\|"Ubicación"/);
  assert.match(source,/aria-label="\$\{fmt\.escape\(`Seleccionar origen \$\{originLabel\}`\)\}"/);
  assert.match(source,/<strong>\$\{fmt\.escape\(originLabel\)\}<\/strong>/);
});

test("Billing canonical stage matrix preserves ROUTE_CHOICE TAKE DOCUMENT invoice/PVP SEND WAIT and blocked state",()=>{
  const accept=action(),cash=action(),invoice=action(),annex=action(),send=action();
  assert.equal(billingStage(billingModal({'[data-cash-action="accept"], [data-billing-action="accept"]':accept,'[data-billing-action="cash"]':cash})),"ROUTE_CHOICE");
  assert.equal(billingStage(billingModal({'[data-cash-action="accept"], [data-billing-action="accept"]':accept})),"TAKE");
  assert.equal(billingStage(billingModal({'[data-cash-action="invoice"], [data-billing-action="invoice"]':invoice})),"DOCUMENT");
  assert.equal(billingStage(billingModal({'[data-cash-action="annex"], [data-billing-action="annex"]':annex})),"DOCUMENT");
  assert.equal(billingStage(billingModal({'[data-cash-action="send"], [data-billing-action="send"]':send})),"SEND");
  assert.equal(billingStage(billingModal({'.cash-invoice-steps':{}})),"WAIT");

  const next=action();
  const blocked=billingModal({
    '[data-billing-next-v1198]':next,
    '[data-cash-action="accept"], [data-billing-action="accept"]':accept
  },["order-blocked-by-issue"]);
  assert.equal(syncBillingNext(blocked,"TAKE"),false);
  assert.equal(next.disabled,true);
  assert.equal(next["aria-disabled"],"true");
  assert.match(next.title,/novedad pendiente/i);
});

test("Billing footer double adaptation leaves one logical Next and one close action",()=>{
  const close=action(),next=action();
  close.dataset={};
  next.dataset={takeAnother:"FACTURACION"};
  const actions={querySelector(selector){
    if(selector.includes("data-close"))return close;
    if(selector.includes("not(.billing-close-other)"))return next;
    if(selector.includes("data-billing-next-v1198"))return next;
    return null;
  }};
  const footer={dataset:{},querySelector(selector){return selector===".parallel-work-actions"?actions:null}};
  const modal={querySelector(selector){return selector===".parallel-work-footer"?footer:null}};
  adaptBillingFooter(modal);
  adaptBillingFooter(modal);
  assert.equal(close.dataset.takeAnother,"FACTURACION");
  assert.equal(next.dataset.billingNextV1198,"1");
  assert.equal(close.textContent,"Cerrar y tomar otro");
  assert.equal(next.textContent,"Siguiente");
});

test("Billing source keeps one canonical root/focus/footer/support slot per render path",()=>{
  const cash=read("assets/js/domains/billing/ui/cash-invoice.js");
  const logistics=read("assets/js/domains/billing/ui/logistics-billing.js");
  const focus=read("assets/js/domains/billing/ui/billing-focus.js");
  for(const [name,source] of [["Caja",cash],["Logística",logistics]]){
    assert.equal(count(source,'<div class="modal-overlay simple-process-overlay">'),1,name);
    assert.equal(count(source,"parallelWorkFooter(order.current_step_code)"),1,name);
    assert.equal(count(source,'<details class="simple-details">'),1,name);
  }
  assert.equal(count(focus,'className="billing-task-focus-v1198"'),1);
  assert.match(focus,/if\(!focus\)\{/);
  assert.match(focus,/if\(!details\)\{/);
  assert.equal(count(focus,"data-order-support-slot"),1);
  assert.match(focus,/Hay una novedad pendiente · abre para resolver/);
});

test("Billing upload DOM keeps confirm disabled without valid file and enables it for PDF/image/CSV",()=>{
  const state={className:"",innerHTML:"",replaceChildren(){this.innerHTML=""}};
  const confirm={disabled:false};
  const dropzone={classList:classList()};
  const modal={querySelector(selector){
    if(selector===".billing-file-state-v1199")return state;
    if(selector==="[data-confirm]")return confirm;
    if(selector===".billing-dropzone-v1199")return dropzone;
    return null;
  }};
  const input={files:[],value:""};
  assert.equal(renderBillingUploadState(modal,input),false);
  assert.equal(confirm.disabled,true);

  for(const file of [
    {name:"factura.pdf",type:"application/pdf",size:1200},
    {name:"factura.png",type:"image/png",size:1200},
    {name:"factura.csv",type:"text/csv",size:1200}
  ]){
    input.files=[file];
    assert.equal(renderBillingUploadState(modal,input),true,file.name);
    assert.equal(confirm.disabled,false,file.name);
    assert.match(state.innerHTML,/Cambiar archivo/);
  }

  input.files=[{name:"factura.exe",type:"application/octet-stream",size:1200}];
  assert.equal(renderBillingUploadState(modal,input),false);
  assert.equal(confirm.disabled,true);
  assert.match(state.innerHTML,/Revisa el archivo/);

  assert.match(validateBillingUploadFile({name:"zero.pdf",type:"application/pdf",size:0}).message,/vacío/i);
  assert.match(validateBillingUploadFile({name:"huge.pdf",type:"application/pdf",size:BILLING_MAX_FILE_BYTES+1}).message,/máximo/i);
});

test("Invoice reader fields are label-associated and manual override survives auto-read",()=>{
  const html=field("Valor total","invoiceAmountV1199","number","0",true,'step="0.01"');
  assert.match(html,/^<label[^>]*>[\s\S]*<input[^>]*name="invoiceAmountV1199"[\s\S]*<\/label>$/);

  const input={value:"450000",dataset:{manual:"1"}};
  const hint={textContent:"Editado manualmente",classList:classList()};
  const modal={querySelector(selector){
    if(selector==='[name="invoiceAmountV1199"]')return input;
    if(selector==='[data-field-source="invoiceAmountV1199"]')return hint;
    return null;
  }};
  setAuto(modal,"invoiceAmountV1199","999999");
  assert.equal(input.value,"450000");
});

test("Billing save/error UX disables before await, shows pending state, re-enables on error and saves once",()=>{
  const dialog=read("assets/js/core/ui/dialog.js");
  const reader=read("assets/js/domains/billing/invoice-reader/pdf/read-invoice-file.js");
  const upload=read("assets/js/domains/billing/uploads/invoice-upload.js");

  assert.match(reader,/status\.innerHTML='<span class="spinner"><\/span> Leyendo documento'/);
  assert.match(dialog,/confirm\.disabled=true;\s*const dialog=/s);
  assert.match(dialog,/await onConfirm\?\.\(dialog\)/);
  assert.match(dialog,/catch\(error\)\{[\s\S]*toast\([\s\S]*confirm\.disabled=false/s);
  assert.match(dialog,/if\(dialogState\.dialogSystemInstalled\)return/);
  assert.match(dialog,/confirm\.onclick=async\(\)=>/);

  const storeAt=upload.indexOf('await storeBillingFile(data,file,"INVOICE"');
  const saveAt=upload.indexOf("await saveInvoiceExplicit(data.order.id,payload)");
  const successAt=upload.indexOf('toast("Factura cargada correctamente.","success")');
  assert.ok(storeAt>=0&&saveAt>storeAt&&successAt>saveAt);
  assert.equal((upload.match(/saveInvoiceExplicit\(data\.order\.id,payload\)/g)||[]).length,1);
});
