import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  adaptPickingFooter,
  continuePicking,
  pickingStage,
  syncPickingNext
} from "../../assets/js/domains/picking/ui/picking-focus.js";
import { originSelectionValid, readRow } from "../../assets/js/domains/picking/origins/origin-selection.js";

function classes(){return {add(){},remove(){}}}
function action({visible=true,disabled=false}={}){
  return {disabled,dataset:{testVisible:visible?"1":"0"},clicked:0,click(){this.clicked++},classList:classes(),setAttribute(){},removeAttribute(){},focus(){},scrollIntoView(){}};
}

test("Picking TAKE and RESUME execute the canonical visible action",()=>{
  for(const [selector,expected] of [["[data-picking-take]","TAKE"],["[data-resume-partial]","RESUME"]]){
    const target=action();
    const modal={querySelector(q){return q===selector?target:null},querySelectorAll(){return []}};
    assert.equal(pickingStage(modal),expected);
    assert.equal(continuePicking(modal),expected);
    assert.equal(target.clicked,1);
  }
});

test("Picking PICKUP confirms when ready and otherwise focuses pending pickup",()=>{
  const confirm=action();
  const modal={querySelector(q){
    if(q==="[data-confirm-cut-pickup], [data-cut-pickup-item]")return {};
    if(q==="[data-confirm-cut-pickup]")return confirm;
    return null;
  },querySelectorAll(){return []}};
  assert.equal(pickingStage(modal),"PICKUP");
  assert.equal(continuePicking(modal),"PICKUP_CONFIRM");
  assert.equal(confirm.clicked,1);
});

test("Picking VERIFY sends only when ready and otherwise focuses unresolved work",()=>{
  const send=action();
  const modalReady={querySelector(q){
    if(q==="[data-picking-items], .picking-verification-card")return {};
    if(q==="[data-picking-send]")return send;
    return null;
  },querySelectorAll(){return []}};
  assert.equal(continuePicking(modalReady),"VERIFY_SEND");
  assert.equal(send.clicked,1);

  const unresolved={dataset:{},querySelector(){return action()},classList:classes(),scrollIntoView(){}};
  const modalPending={querySelector(q){
    if(q==="[data-picking-items], .picking-verification-card")return {};
    if(q==="[data-picking-send]")return {disabled:true};
    return null;
  },querySelectorAll(q){return q==="[data-picking-item]"?[unresolved]:[]}};
  assert.equal(continuePicking(modalPending),"VERIFY_UNRESOLVED");
});

test("Picking BLOCKED disables canonical next CTA",()=>{
  const next=action();
  const modal={querySelector(q){if(q===".picking-empty")return {};if(q==="[data-picking-next-v1195]")return next;return null},querySelectorAll(){return []}};
  assert.equal(pickingStage(modal),"BLOCKED");
  assert.equal(syncPickingNext(modal),false);
  assert.equal(next.disabled,true);
});

test("Picking footer transformation is idempotent and keeps one canonical next action",()=>{
  const close=action(),next=action();
  close.dataset={};next.dataset={takeAnother:"ALISTAMIENTO"};
  close.classList=classes();next.classList=classes();
  const actions={querySelector(q){
    if(q.includes("data-close"))return close;
    if(q.includes("not(.picking-close-other)"))return next;
    return null;
  }};
  const footer={dataset:{},querySelector(q){return q===".parallel-work-actions"?actions:null}};
  const modal={querySelector(q){return q===".parallel-work-footer"?footer:null}};
  adaptPickingFooter(modal);
  adaptPickingFooter(modal);
  assert.equal(close.textContent,"Cerrar y tomar otro");
  assert.equal(close.dataset.takeAnother,"ALISTAMIENTO");
  assert.equal(next.textContent,"Siguiente");
  assert.equal(next.dataset.pickingNextV1195,"1");
});

test("FOUND preserves physical origin and MISSING preserves novelty",()=>{
  const originCheck={checked:true,value:"lot-1"};
  const originQty={value:"2"};
  const option={querySelector(q){return q==="[data-origin-check]"?originCheck:q==="[data-origin-qty]"?originQty:null}};
  const found={dataset:{itemId:"item-1",result:"FOUND",requiresCut:"false",originLoaded:"true",originValid:"true"},querySelector(q){if(q==="textarea")return {value:""};return null},querySelectorAll(q){return q==="[data-origin-option]"?[option]:[]}};
  assert.equal(originSelectionValid(found),true);
  assert.deepEqual(readRow(found).origins,[{lotId:"lot-1",quantity:2}]);

  const missing={dataset:{itemId:"item-2",result:"MISSING",requiresCut:"false"},querySelector(q){return q==="textarea"?{value:"No apareció físicamente"}:null},querySelectorAll(){return []}};
  const row=readRow(missing);
  assert.equal(row.novelty,"No apareció físicamente");
  assert.deepEqual(row.origins,[]);
});

test("canonical Picking focus has no global observer or document click installer",()=>{
  const source=fs.readFileSync(new URL("../../assets/js/domains/picking/ui/picking-focus.js",import.meta.url),"utf8");
  assert.doesNotMatch(source,/MutationObserver/);
  assert.doesNotMatch(source,/document\.addEventListener\(["']click/);
  const shell=fs.readFileSync(new URL("../../assets/js/domains/picking/ui/picking-shell.js",import.meta.url),"utf8");
  assert.match(shell,/data-order-support-slot/);
});
