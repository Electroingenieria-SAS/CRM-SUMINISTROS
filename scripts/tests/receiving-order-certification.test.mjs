import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { api } from "../../assets/js/services/api.js";
import { state } from "../../assets/js/core/state.js";
import { takeStage } from "../../assets/js/domains/receiving/order/stages/take.js";
import { reviewStage } from "../../assets/js/domains/receiving/order/stages/review.js";
import { pdfStage } from "../../assets/js/domains/receiving/order/stages/pdf.js";
import { editStage } from "../../assets/js/domains/receiving/order/stages/edit-lines.js";
import { assignmentStage } from "../../assets/js/domains/receiving/order/stages/assignment.js";
import { statusStage } from "../../assets/js/domains/receiving/order/stages/status.js";
import { baseShell, bindClose } from "../../assets/js/domains/receiving/order/ui/reception-shell.js";
import { bindFooterNavigation } from "../../assets/js/domains/receiving/order/ui/footer-navigation.js";
import { activeTask, actionCodes, assigneeName, beginReception } from "../../assets/js/domains/receiving/order/actions/start-reception.js";
import { loadDraft, persistDraft, clearDraft, DRAFT_PREFIX } from "../../assets/js/domains/receiving/order/draft/reception-draft.js";
import { collectEditorLines } from "../../assets/js/domains/receiving/order/lines/read-editor-lines.js";
import { fromOrderItem } from "../../assets/js/domains/receiving/order/lines/map-reception-line.js";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const read=relative=>fs.readFileSync(path.join(ROOT,relative),"utf8");
const source=relative=>read(`assets/js/domains/receiving/order/${relative}`);

const baseData={
  order:{
    id:"order-1",
    order_number:"PED-001",
    client_name:"Cliente Demo",
    order_type_code:"PVC",
    payment_condition_code:"CASH",
    delivery_route_code:"CLIENT_POINT",
    current_step_code:"RECEPCION_PEDIDO",
    current_role_code:"recepcion_mercancia",
    version:7
  },
  assigneeLabel:"Ana Recepción",
  files:[{drive_file_id:"drive-1",file_name:"pedido.pdf",mime_type:"application/pdf",size_bytes:2048}],
  items:[{
    id:"item-1",
    material_master_id:"mat-1",
    material_variant_id:"var-1",
    sku:"SKU-1",
    reference:"REF-1",
    description:"Cable",
    quantity:2,
    unit:"M",
    requires_cut:true,
    requested_cut_length:1.5,
    metadata:{variantLabel:"Rojo"}
  }]
};

function count(value,needle){return value.split(needle).length-1}

function fakeElement(){
  return {
    disabled:false,hidden:false,title:"",clicks:0,focuses:0,scrolls:0,replacements:0,offsetWidth:1,
    classList:{add(){},remove(){}},
    setAttribute(name,value){this[name]=value},
    click(){this.clicks+=1},
    focus(){this.focuses+=1},
    scrollIntoView(){this.scrolls+=1}
  };
}

function host(map={}){
  return {
    map,
    querySelector(selector){return this.map[selector]||null},
    querySelectorAll(selector){return this.map[selector]||[]},
    replaceChildren(){this.replacements=(this.replacements||0)+1}
  };
}

function localStore(){
  const values=new Map();
  return {
    getItem:key=>values.has(key)?values.get(key):null,
    setItem:(key,value)=>values.set(key,String(value)),
    removeItem:key=>values.delete(key),
    clear:()=>values.clear(),
    values
  };
}

function workflowData({status="ASSIGNED",assignedProfileId="profile-1",assignedName="Ana",role="recepcion_mercancia",actions=[]}={}){
  return {
    order:{...baseData.order},
    tasks:[{id:"task-1",status,assigned_profile_id:assignedProfileId,assigned_name:assignedName,assigned_role_code:role}],
    actions:{actions:actions.map(code=>({code}))}
  };
}

test("stage matrix renders canonical owner, CTA and footer state for TAKE REVIEW PDF EDIT ASSIGN STATUS",()=>{
  const draft={stage:"REVIEW",mode:"PDF",lines:[fromOrderItem(baseData.items[0],0)],sourceFileId:"drive-1",sourceFileName:"pedido.pdf",pickingProfileId:"pick-1",cutProfileId:"cut-1",rawPreview:""};
  const stages={
    TAKE:{html:takeStage(baseData,{label:"Tomar pedido"}),cta:"data-take-order",next:true},
    REVIEW:{html:reviewStage(baseData),cta:"data-info-correct",next:true},
    PDF:{html:pdfStage(baseData,{...draft,stage:"PDF"}),cta:"data-read-drive-pdf",next:true},
    EDIT:{html:editStage(baseData,{...draft,stage:"EDIT"}),cta:"data-confirm-lines",next:true},
    ASSIGN:{html:assignmentStage(baseData,{...draft,stage:"ASSIGN"},[{id:"pick-1",name:"Picking"}],[{id:"cut-1",name:"Cutting"}]),cta:"data-confirm-reception",next:true},
    STATUS:{html:statusStage({assignee:"Ana Recepción"}),cta:"reception-status-stage",next:false}
  };
  for(const [stage,entry] of Object.entries(stages)){
    assert.match(entry.html,new RegExp(entry.cta),stage);
    const shell=baseShell(baseData,entry.html,{stage});
    assert.match(shell,new RegExp(`data-receiving-stage="${stage}"`),stage);
    assert.equal(count(shell,"data-reception-next"),1,`${stage} must render one Next`);
    assert.equal(count(shell,'data-take-another="RECEPCION_PEDIDO"'),1,`${stage} must render one take-another`);
    assert.equal(/data-reception-next disabled/.test(shell),!entry.next,`${stage} next state`);
    assert.doesNotMatch(shell,/stageOf\(|MutationObserver/);
  }
});

test("navigation double-bind remains one effective handler and STATUS is inert",()=>{
  for(const [stage,targetSelector] of [["TAKE","[data-take-order]"],["PDF","[data-read-drive-pdf]"],["EDIT","[data-confirm-lines]"],["ASSIGN","[data-confirm-reception]"]]){
    const next=fakeElement(),target=fakeElement();
    const root=host({"[data-reception-next]":next,[targetSelector]:target});
    bindFooterNavigation(root,stage);
    bindFooterNavigation(root,stage);
    next.onclick({preventDefault(){}});
    assert.equal(target.clicks,1,stage);
  }

  const reviewNext=fakeElement(),decision=fakeElement();
  const grid={querySelector(){return decision}};
  const reviewHost=host({"[data-reception-next]":reviewNext,".reception-decision-grid":grid});
  bindFooterNavigation(reviewHost,"REVIEW");
  bindFooterNavigation(reviewHost,"REVIEW");
  reviewNext.onclick({preventDefault(){}});
  assert.equal(decision.focuses,1);

  const local=fakeElement(),pdfNext=fakeElement();
  const pdfHost=host({"[data-reception-next]":pdfNext,"[data-local-pdf]":local});
  bindFooterNavigation(pdfHost,"PDF");
  pdfNext.onclick({preventDefault(){}});
  assert.equal(local.clicks,1);

  const statusNext=fakeElement();
  bindFooterNavigation(host({"[data-reception-next]":statusNext}),"STATUS");
  assert.equal(statusNext.disabled,true);
  assert.equal(statusNext["aria-disabled"],"true");
  assert.equal(statusNext.onclick,null);
});

test("close/reopen binding replaces handlers instead of accumulating listeners",()=>{
  const close=fakeElement();
  const root=host({"[data-close]":[close]});
  bindClose(root);
  bindClose(root);
  close.onclick();
  assert.equal(root.replacements,1);
  assert.equal(typeof close.onclick,"function");
});

test("ownership distinguishes current profile, missing profile and another assignee",()=>{
  const previous=state.profile;
  try{
    state.profile={id:"profile-1",name:"Juan Recepción"};
    assert.equal(assigneeName(workflowData()),"Juan Recepción");

    state.profile=null;
    const missing=workflowData({assignedProfileId:null,assignedName:null,role:"aux_logistica"});
    assert.notEqual(assigneeName(missing),"Tu usuario");
    assert.equal(assigneeName(missing),"Auxiliar de logística");

    state.profile={id:"profile-2",name:"Otro usuario"};
    assert.equal(assigneeName(workflowData({assignedProfileId:"profile-1",assignedName:"Ana Operación"})),"Ana Operación");
  }finally{state.profile=previous}
});

test("activeTask and actionCodes preserve already-owned workflow state",()=>{
  const data=workflowData({status:"IN_PROGRESS",actions:["COMPLETE","WAIT"]});
  assert.equal(activeTask(data)?.status,"IN_PROGRESS");
  assert.deepEqual([...actionCodes(data)].sort(),["COMPLETE","WAIT"]);
});

test("beginReception executes CLAIM then refreshed START exactly once",async()=>{
  const originalExecute=api.executeAction;
  const originalGet=api.getOrder;
  const calls=[];
  try{
    api.executeAction=async(id,action,payload,version)=>{calls.push({id,action,version,payload})};
    api.getOrder=async id=>({...workflowData({status:"ASSIGNED",actions:["START"]}),order:{...baseData.order,id,version:8}});
    await beginReception(workflowData({actions:["CLAIM"]}));
    assert.deepEqual(calls.map(call=>[call.action,call.version]),[["CLAIM",7],["START",8]]);
  }finally{api.executeAction=originalExecute;api.getOrder=originalGet}
});

test("beginReception executes START or RESUME once when order is already owned",async()=>{
  const originalExecute=api.executeAction;
  const originalGet=api.getOrder;
  try{
    for(const action of ["START","RESUME"]){
      const calls=[];
      api.executeAction=async(id,code,payload,version)=>{calls.push({id,code,version})};
      api.getOrder=async()=>{throw new Error("getOrder must not run without CLAIM")};
      await beginReception(workflowData({actions:[action]}));
      assert.deepEqual(calls.map(call=>call.code),[action]);
    }
  }finally{api.executeAction=originalExecute;api.getOrder=originalGet}
});

test("beginReception propagates backend rejection and does not report a later action",async()=>{
  const originalExecute=api.executeAction;
  const originalGet=api.getOrder;
  let reads=0;
  try{
    api.executeAction=async()=>{throw new Error("backend rejected")};
    api.getOrder=async()=>{reads+=1;return workflowData({actions:["START"]})};
    await assert.rejects(()=>beginReception(workflowData({actions:["CLAIM"]})),/backend rejected/);
    assert.equal(reads,0);
  }finally{api.executeAction=originalExecute;api.getOrder=originalGet}
});

test("draft restores, survives rerender reads and clears only on explicit clear",()=>{
  const previous=globalThis.localStorage;
  const store=localStore();
  globalThis.localStorage=store;
  try{
    const draft={stage:"EDIT",mode:"PDF",lines:[{orderItemId:"item-1",quantity:3}],sourceFileId:"drive-1",sourceFileName:"pedido.pdf",orderVersion:7};
    persistDraft("order-1",draft);
    const first=loadDraft(baseData);
    const second=loadDraft(baseData);
    assert.equal(first.stage,"EDIT");
    assert.equal(second.lines[0].quantity,3);
    assert.ok(store.getItem(DRAFT_PREFIX+"order-1"));
    clearDraft("order-1");
    assert.equal(store.getItem(DRAFT_PREFIX+"order-1"),null);
  }finally{
    if(previous===undefined)delete globalThis.localStorage;
    else globalThis.localStorage=previous;
  }
});

function editorRow({quantity="2",requiresCut=false,cutLength="",orderItemId="item-1"}={}){
  const material={dataset:{
    materialId:"mat-1",
    materialVariantId:"var-1",
    materialVariantLabel:"Rojo",
    materialReference:"REF-1",
    materialName:"Cable",
    materialUnit:"M"
  }};
  const fields={
    quantity:{value:quantity},
    warehouseLocation:{value:"A-01"},
    requiresCut:{checked:requiresCut},
    requestedCutLength:{value:cutLength}
  };
  return {
    dataset:{orderItemId},
    querySelector(selector){
      if(selector==="[data-material-picker]")return material;
      const match=selector.match(/data-field="([^"]+)"/);
      return match?fields[match[1]]:null;
    }
  };
}

test("editor preserves IDs quantities cuts and validates invalid input before persistence",()=>{
  const valid={querySelectorAll(){return [editorRow({quantity:"2.5",requiresCut:true,cutLength:"1.25"})]}};
  const [line]=collectEditorLines(valid,true);
  assert.deepEqual({
    orderItemId:line.orderItemId,
    materialMasterId:line.materialMasterId,
    materialVariantId:line.materialVariantId,
    quantity:line.quantity,
    unit:line.unit,
    requiresCut:line.requiresCut,
    requestedCutLength:line.requestedCutLength,
    warehouseLocation:line.warehouseLocation
  },{
    orderItemId:"item-1",
    materialMasterId:"mat-1",
    materialVariantId:"var-1",
    quantity:2.5,
    unit:"M",
    requiresCut:true,
    requestedCutLength:1.25,
    warehouseLocation:"A-01"
  });

  assert.throws(()=>collectEditorLines({querySelectorAll(){return [editorRow({quantity:"0"})]}},true),/cantidad válida/);
  assert.throws(()=>collectEditorLines({querySelectorAll(){return [editorRow({requiresCut:true,cutLength:"0"})]}},true),/longitud de corte/);
});

test("PDF error, assignment validation and final confirmation retain no-duplicate guards",()=>{
  const processPdf=source("pdf/process-pdf.js");
  assert.match(processPdf,/catch\(error\)/);
  assert.match(processPdf,/buttons\.forEach\(button=>button\.disabled=false\)/);
  assert.match(processPdf,/toast\(error\.message,"error"/);

  const assignment=source("assignment/assignment-pool.js");
  assert.match(assignment,/if\(!draft\.pickingProfileId\)return toast/);
  assert.match(assignment,/if\(hasCuts&&!draft\.cutProfileId\)return toast/);
  assert.equal((assignment.match(/confirmReception\(/g)||[]).length,1);

  const confirm=source("actions/confirm-reception.js");
  assert.equal((confirm.match(/confirmOrderReception\(/g)||[]).length,1);
  assert.match(confirm,/button\.disabled=true/);
  assert.match(confirm,/catch\(error\).*button\.disabled=false/s);
  assert.match(confirm,/clearDraft\(data\.order\.id\)/);
});

test("final confirmation payload preserves order/material identifiers and cutting values",()=>{
  const confirm=source("actions/confirm-reception.js");
  for(const token of [
    "orderItemId:line.orderItemId||null",
    "materialMasterId:line.materialMasterId||null",
    "materialVariantId:line.materialVariantId||null",
    "quantity:Number(line.quantity)",
    "unit:line.unit||\"UND\"",
    "requiresCut:Boolean(line.requiresCut)",
    "requestedCutLength:line.requiresCut?Number(line.requestedCutLength||line.quantity):null",
    "pickingProfileId:draft.pickingProfileId",
    "cutProfileId:draft.lines.some(line=>line.requiresCut)?draft.cutProfileId:null"
  ])assert.ok(confirm.includes(token),token);
});

test("legacy retirement guard covers modules imports observers global clicks and migrated CSS",()=>{
  const legacy=["receiving-order-v"+"1192.js","receiving-focus-v"+"1193.js","receiving-polish-v"+"1194.js"];
  for(const file of legacy)assert.equal(fs.existsSync(path.join(ROOT,"assets/js/modules",file)),false,file);
  const appEntry=read("assets/js/app-entry.js");
  for(const file of legacy)assert.doesNotMatch(appEntry,new RegExp(file.replaceAll(".","\\.")));

  const orderDir=path.join(ROOT,"assets/js/domains/receiving/order");
  const stack=[orderDir];
  let runtime="";
  while(stack.length){
    const current=stack.pop();
    for(const entry of fs.readdirSync(current,{withFileTypes:true})){
      const full=path.join(current,entry.name);
      if(entry.isDirectory())stack.push(full);
      else if(entry.name.endsWith(".js"))runtime+=fs.readFileSync(full,"utf8")+"\n";
    }
  }
  assert.doesNotMatch(runtime,/v1192|v1193|v1194/i);
  assert.doesNotMatch(runtime,/MutationObserver/);
  assert.doesNotMatch(runtime,/document\.addEventListener\(["']click/);

  for(const css of [
    "assets/css/modules/receiving/order-workspace-reception-process-modal.css",
    "assets/css/modules/receiving/order-workspace-receiving-guided.css",
    "assets/css/modules/receiving/order-task-layout-reception-process-modal.css",
    "assets/css/modules/receiving/order-task-layout-receiving-focus.css",
    "assets/css/modules/receiving/confirmation-layout.css"
  ])assert.doesNotMatch(read(css),/v1192|v1193|v1194/i,css);
});

test("Receiving ORDER remains isolated from Goods and AuditoriaERP",()=>{
  const dir=path.join(ROOT,"assets/js/domains/receiving/order");
  const stack=[dir];
  let runtime="";
  while(stack.length){
    const current=stack.pop();
    for(const entry of fs.readdirSync(current,{withFileTypes:true})){
      const full=path.join(current,entry.name);
      if(entry.isDirectory())stack.push(full);
      else if(entry.name.endsWith(".js"))runtime+=fs.readFileSync(full,"utf8")+"\n";
    }
  }
  assert.doesNotMatch(runtime,/receiving-sync\.js/);
  assert.doesNotMatch(runtime,/receipt-form\.js/);
  assert.doesNotMatch(runtime,/installAuditoriaErpRetryScheduler/);
  assert.doesNotMatch(runtime,/client\.rpc\s*=/);
});
