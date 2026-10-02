import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  billingStage,
  continueBilling,
  syncBillingNext
} from "../../assets/js/domains/billing/ui/billing-focus.js";
import {
  BILLING_MAX_FILE_BYTES,
  validateBillingUploadFile
} from "../../assets/js/domains/billing/uploads/upload-experience.js";

function action({visible=true,disabled=false}={}){return {disabled,dataset:{testVisible:visible?"1":"0"},clicked:0,click(){this.clicked++},setAttribute(){},classList:{add(){},remove(){}}}}
function modalWith(map={},classes=[]){return {classList:{contains:name=>classes.includes(name)},querySelector:q=>map[q]||null,querySelectorAll:()=>[]}}

test("Billing stages ROUTE_CHOICE TAKE DOCUMENT SEND WAIT remain explicit",()=>{
  const accept=action(),cash=action(),invoice=action(),send=action();
  assert.equal(billingStage(modalWith({'[data-cash-action="accept"], [data-billing-action="accept"]':accept,'[data-billing-action="cash"]':cash})),"ROUTE_CHOICE");
  assert.equal(billingStage(modalWith({'[data-cash-action="accept"], [data-billing-action="accept"]':accept})),"TAKE");
  assert.equal(billingStage(modalWith({'[data-cash-action="invoice"], [data-billing-action="invoice"]':invoice})),"DOCUMENT");
  assert.equal(billingStage(modalWith({'[data-cash-action="send"], [data-billing-action="send"]':send})),"SEND");
  assert.equal(billingStage(modalWith({'.cash-invoice-steps':{}})),"WAIT");
});

test("Billing canonical next executes TAKE DOCUMENT and SEND actions",()=>{
  for(const [selector,stage] of [
    ['[data-cash-action="accept"], [data-billing-action="accept"]',"TAKE"],
    ['[data-cash-action="invoice"], [data-billing-action="invoice"]',"DOCUMENT"],
    ['[data-cash-action="send"], [data-billing-action="send"]',"SEND"]
  ]){
    const target=action();
    const modal=modalWith({[selector]:target});
    assert.equal(continueBilling(modal),stage);
    assert.equal(target.clicked,1);
  }
});

test("Billing blocked issue disables next CTA",()=>{
  const next=action();
  const accept=action();
  const modal=modalWith({
    '[data-billing-next-v1198]':next,
    '[data-cash-action="accept"], [data-billing-action="accept"]':accept
  },["order-blocked-by-issue"]);
  assert.equal(syncBillingNext(modal,"TAKE"),false);
  assert.equal(next.disabled,true);
});

test("Billing upload validates PDF, empty and max size while PVP preserves current file contract",()=>{
  assert.equal(validateBillingUploadFile({name:"factura.pdf",type:"application/pdf",size:1200}).valid,true);
  assert.match(validateBillingUploadFile({name:"factura.png",type:"image/png",size:1200}).message,/PDF/i);
  assert.match(validateBillingUploadFile({name:"factura.pdf",type:"application/pdf",size:0}).message,/vacío/i);
  assert.match(validateBillingUploadFile({name:"factura.pdf",type:"application/pdf",size:BILLING_MAX_FILE_BYTES+1}).message,/máximo/i);
  assert.equal(validateBillingUploadFile({name:"anexo.xlsx",type:"application/vnd.ms-excel",size:1200},{pvp:true}).valid,true);
});

test("Billing canonical focus/upload owners contain no global observer installer",()=>{
  const focus=fs.readFileSync(new URL("../../assets/js/domains/billing/ui/billing-focus.js",import.meta.url),"utf8");
  const upload=fs.readFileSync(new URL("../../assets/js/domains/billing/uploads/upload-experience.js",import.meta.url),"utf8");
  assert.doesNotMatch(focus,/MutationObserver/);
  assert.doesNotMatch(focus,/document\.addEventListener\(["']click/);
  assert.doesNotMatch(upload,/MutationObserver/);
  assert.match(upload,/keydown/);
  assert.match(upload,/ondrop/);
  assert.match(upload,/data-billing-file-remove/);
  assert.match(focus,/data-order-support-slot/);
});
