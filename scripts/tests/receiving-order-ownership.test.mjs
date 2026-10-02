import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { bindFooterNavigation } from "../../assets/js/domains/receiving/order/ui/footer-navigation.js";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const read=relative=>fs.readFileSync(path.join(ROOT,relative),"utf8");
const exists=relative=>fs.existsSync(path.join(ROOT,relative));
const source=relative=>read(`assets/js/domains/receiving/order/${relative}`);

function fakeElement(){
  return {
    disabled:false,hidden:false,title:"",clicks:0,focuses:0,scrolls:0,offsetWidth:1,
    classList:{add(){},remove(){}},
    setAttribute(name,value){this[name]=value},
    click(){this.clicks+=1},
    focus(){this.focuses+=1},
    scrollIntoView(){this.scrolls+=1}
  };
}
function host(map){return {querySelector(selector){return map[selector]||null}}}

test("Receiving renders TAKE REVIEW PDF EDIT ASSIGN STATUS explicitly",()=>{
  const files={TAKE:"stages/take.js",REVIEW:"stages/review.js",PDF:"stages/pdf.js",EDIT:"stages/edit-lines.js",ASSIGN:"stages/assignment.js",STATUS:"stages/status.js"};
  for(const [stage,file] of Object.entries(files)){
    const value=source(file);
    assert.ok(value.length>100,`${stage} source missing`);
    assert.doesNotMatch(value,/MutationObserver|stageOf\(/);
  }
  assert.match(source("stages/take.js"),/PEDIDO A RECIBIR/);
  assert.match(source("stages/review.js"),/Revisa y decide/);
  assert.match(source("stages/pdf.js"),/Selecciona el PDF/);
  assert.match(source("stages/edit-lines.js"),/Corrige solo lo necesario/);
  assert.match(source("stages/assignment.js"),/Confirmar y enviar a alistamiento/);
  assert.match(source("stages/status.js"),/Estado/);
});

test("Next is idempotent and dispatches TAKE PDF EDIT ASSIGN exactly once",()=>{
  for(const [stage,targetSelector] of [["TAKE","[data-take-order]"],["PDF","[data-read-drive-pdf]"],["EDIT","[data-confirm-lines]"],["ASSIGN","[data-confirm-reception]"]]){
    const next=fakeElement(),target=fakeElement();
    const root=host({"[data-reception-next]":next,[targetSelector]:target});
    bindFooterNavigation(root,stage);
    bindFooterNavigation(root,stage);
    next.onclick({preventDefault(){}});
    assert.equal(target.clicks,1,`${stage} action duplicated`);
  }
});

test("Review focuses a decision, PDF falls back local, STATUS disables Next",()=>{
  const reviewNext=fakeElement(),decision=fakeElement();
  const grid={querySelector(){return decision}};
  bindFooterNavigation(host({"[data-reception-next]":reviewNext,".reception-decision-grid":grid}),"REVIEW");
  reviewNext.onclick({preventDefault(){}});
  assert.equal(decision.clicks,0);
  assert.equal(decision.focuses,1);

  const pdfNext=fakeElement(),local=fakeElement();
  bindFooterNavigation(host({"[data-reception-next]":pdfNext,"[data-local-pdf]":local}),"PDF");
  pdfNext.onclick({preventDefault(){}});
  assert.equal(local.clicks,1);

  const statusNext=fakeElement();
  bindFooterNavigation(host({"[data-reception-next]":statusNext}),"STATUS");
  assert.equal(statusNext.disabled,true);
  assert.equal(statusNext["aria-disabled"],"true");
  assert.equal(statusNext.onclick,null);
});

test("Ownership and CLAIM START RESUME stay canonical",()=>{
  const start=source("actions/start-reception.js");
  assert.match(start,/profileId&&task\?\.assigned_profile_id===profileId/);
  assert.match(start,/actions\.has\("CLAIM"\)/);
  assert.match(start,/actions\.has\("START"\)/);
  assert.match(start,/actions\.has\("RESUME"\)/);
  assert.equal((start.match(/api\.executeAction/g)||[]).length,3);
});

test("Canonical Receiving order has no V1192 V1193 V1194 observer or global click runtime",()=>{
  const dir=path.join(ROOT,"assets/js/domains/receiving/order");
  const stack=[dir];
  let combined="";
  while(stack.length){
    const current=stack.pop();
    for(const entry of fs.readdirSync(current,{withFileTypes:true})){
      const full=path.join(current,entry.name);
      if(entry.isDirectory())stack.push(full);
      else if(entry.name.endsWith(".js"))combined+=fs.readFileSync(full,"utf8")+"\n";
    }
  }
  assert.doesNotMatch(combined,/v1192|v1193|v1194/i);
  assert.doesNotMatch(combined,/MutationObserver/);
  assert.doesNotMatch(combined,/document\.addEventListener\(["']click/);
});

test("Receiving styles have no V1192 V1193 V1194 selectors",()=>{
  for(const relative of [
    "assets/css/modules/receiving/order-workspace-reception-process-modal.css",
    "assets/css/modules/receiving/order-workspace-receiving-guided.css",
    "assets/css/modules/receiving/order-task-layout-reception-process-modal.css",
    "assets/css/modules/receiving/order-task-layout-receiving-focus.css",
    "assets/css/modules/receiving/confirmation-layout.css"
  ])assert.doesNotMatch(read(relative),/v1192|v1193|v1194/i,relative);
});

test("Legacy modules and app-entry imports are retired",()=>{
  const legacy=["receiving-order-v"+"1192.js","receiving-focus-v"+"1193.js","receiving-polish-v"+"1194.js"];
  for(const file of legacy)assert.equal(exists(`assets/js/modules/${file}`),false,file);
  const entry=read("assets/js/app-entry.js");
  for(const file of legacy)assert.equal(entry.includes(file),false,file);
});

test("PDF draft lines assignment and confirmation contracts remain wired",()=>{
  const bindings=source("stages/stage-bindings.js");
  for(const contract of [/downloadDriveFile/,/data-local-pdf/,/persistDraft/,/processPdf/])assert.match(bindings,contract);
  assert.match(source("lines/editor-bindings.js"),/collectEditorLines\(editor,true\)/);
  const assignment=source("assignment/assignment-pool.js");
  assert.match(assignment,/pickingProfileId/);
  assert.match(assignment,/cutProfileId/);
  assert.equal((assignment.match(/confirmReception\(/g)||[]).length,1);
  const confirm=source("actions/confirm-reception.js");
  assert.match(confirm,/confirmOrderReception/);
  assert.match(confirm,/clearDraft/);
});
