import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  adaptBillingFooter,
  billingStage,
  continueBilling,
  syncBillingNext
} from "../../assets/js/domains/billing/ui/billing-focus.js";
import {
  BILLING_MAX_FILE_BYTES,
  validateBillingUploadFile
} from "../../assets/js/domains/billing/uploads/upload-experience.js";

function classes(){return {add(){},remove(){},contains(){return false}}}
function action({visible=true,disabled=false}={}){return {disabled,dataset:{testVisible:visible?"1":"0"},clicked:0,click(){this.clicked++},setAttribute(name,value){this[name]=value},removeAttribute(){},classList:classes()}}
function modalWith(map={},classNames=[]){return {classList:{contains:name=>classNames.includes(name)},querySelector:q=>map[q]||null,querySelectorAll:()=>[]}}

test("Billing stages ROUTE_CHOICE TAKE DOCUMENT invoice/PVP SEND WAIT remain explicit",()=>{
  const accept=action(),cash=action(),invoice=action(),annex=action(),send=action();
  assert.equal(billingStage(modalWith({'[data-cash-action="accept"], [data-billing-action="accept"]':accept,'[data-billing-action="cash"]':cash})),"ROUTE_CHOICE");
  assert.equal(billingStage(modalWith({'[data-cash-action="accept"], [data-billing-action="accept"]':accept})),"TAKE");
  assert.equal(billingStage(modalWith({'[data-cash-action="invoice"], [data-billing-action="invoice"]':invoice})),"DOCUMENT");
  assert.equal(billingStage(modalWith({'[data-cash-action="annex"], [data-billing-action="annex"]':annex})),"DOCUMENT");
  assert.equal(billingStage(modalWith({'[data-cash-action="send"], [data-billing-action="send"]':send})),"SEND");
  assert.equal(billingStage(modalWith({'.cash-invoice-steps':{}})),"WAIT");
});

test("Billing canonical next executes TAKE DOCUMENT invoice/PVP and SEND actions",()=>{
  for(const [selector,stage] of [
    ['[data-cash-action="accept"], [data-billing-action="accept"]',"TAKE"],
    ['[data-cash-action="invoice"], [data-billing-action="invoice"]',"DOCUMENT"],
    ['[data-cash-action="annex"], [data-billing-action="annex"]',"DOCUMENT"],
    ['[data-cash-action="send"], [data-billing-action="send"]',"SEND"]
  ]){
    const target=action();
    const modal=modalWith({[selector]:target});
    assert.equal(continueBilling(modal),stage);
    assert.equal(target.clicked,1);
  }
});

test("Billing blocked issue disables next CTA with explicit notice",()=>{
  const next=action();
  const accept=action();
  const modal=modalWith({
    '[data-billing-next-v1198]':next,
    '[data-cash-action="accept"], [data-billing-action="accept"]':accept
  },["order-blocked-by-issue"]);
  assert.equal(syncBillingNext(modal,"TAKE"),false);
  assert.equal(next.disabled,true);
  assert.equal(next["aria-disabled"],"true");
  assert.match(next.title,/novedad pendiente/i);
});

test("Billing footer transformation is idempotent for close and next",()=>{
  const close=action(),next=action();
  close.dataset={};next.dataset={takeAnother:"FACTURACION"};
  const actions={querySelector(q){
    if(q.includes("data-close"))return close;
    if(q.includes("not(.billing-close-other)"))return next;
    if(q.includes("data-billing-next-v1198"))return next;
    return null;
  }};
  const footer={dataset:{},querySelector(q){return q===".parallel-work-actions"?actions:null}};
  const modal={querySelector(q){return q===".parallel-work-footer"?footer:null}};
  adaptBillingFooter(modal);
  adaptBillingFooter(modal);
  assert.equal(close.textContent,"Cerrar y tomar otro");
  assert.equal(close.dataset.takeAnother,"FACTURACION");
  assert.equal(next.textContent,"Siguiente");
  assert.equal(next.dataset.billingNextV1198,"1");
});

test("Billing upload accepts PDF image CSV and rejects empty oversize unknown formats",()=>{
  for(const file of [
    {name:"factura.pdf",type:"application/pdf",size:1200},
    {name:"factura.png",type:"image/png",size:1200},
    {name:"factura.csv",type:"text/csv",size:1200}
  ])assert.equal(validateBillingUploadFile(file).valid,true,file.name);
  assert.match(validateBillingUploadFile({name:"factura.exe",type:"application/octet-stream",size:1200}).message,/PDF, imagen o CSV/i);
  assert.match(validateBillingUploadFile({name:"factura.pdf",type:"application/pdf",size:0}).message,/vacío/i);
  assert.match(validateBillingUploadFile({name:"factura.pdf",type:"application/pdf",size:BILLING_MAX_FILE_BYTES+1}).message,/máximo/i);
  assert.equal(validateBillingUploadFile({name:"anexo.xlsx",type:"application/vnd.ms-excel",size:1200},{pvp:true}).valid,true);
});

test("Billing focus/upload owners preserve keyboard drop remove support and no global observer",()=>{
  const focus=fs.readFileSync(new URL("../../assets/js/domains/billing/ui/billing-focus.js",import.meta.url),"utf8");
  const upload=fs.readFileSync(new URL("../../assets/js/domains/billing/uploads/upload-experience.js",import.meta.url),"utf8");
  assert.doesNotMatch(focus,/MutationObserver/);
  assert.doesNotMatch(focus,/document\.addEventListener\(["']click/);
  assert.doesNotMatch(upload,/MutationObserver/);
  assert.match(upload,/event\.key==="Enter"\|\|event\.key===" "/);
  assert.match(upload,/dropzone\.ondrop=/);
  assert.match(upload,/dataTransfer\?\.files\?\.\[0\]/);
  assert.match(upload,/data-billing-file-remove/);
  assert.match(upload,/input\.dispatchEvent\(new Event\("change"/);
  assert.match(focus,/data-order-support-slot/);
});
