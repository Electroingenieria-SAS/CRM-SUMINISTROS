import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const read=relative=>fs.readFileSync(path.join(ROOT,relative),"utf8");

test("Receiving confirmation cancel closes without invoking or persisting onConfirm",()=>{
  const taskPanel=read("assets/js/core/ui/task-panel.js");
  assert.match(taskPanel,/querySelectorAll\('\[data-task-panel-close\]'\)\.forEach\(button=>button\.addEventListener\("click",close\)\)/);
  assert.match(taskPanel,/modal-task-panel-scrim'\)\?\.addEventListener\("click",close\)/);
  assert.doesNotMatch(taskPanel,/data-task-panel-close[^\n]*onConfirm/);
  assert.match(taskPanel,/data-task-panel-confirm/);
  assert.match(taskPanel,/const outcome=await onConfirm\?\.\(panel,button\)/);
});

test("in-flight confirmation disables the confirm control before side effect",()=>{
  const taskPanel=read("assets/js/core/ui/task-panel.js");
  const confirm=read("assets/js/domains/receiving/order/actions/confirm-reception.js");
  assert.match(taskPanel,/button\.disabled=true;\s*try\{\s*const outcome=await onConfirm/s);
  assert.match(confirm,/onConfirm:async button=>\{\s*button\.disabled=true;\s*try\{/s);
  assert.equal((confirm.match(/api\.confirmOrderReception\(/g)||[]).length,1);
  assert.match(confirm,/catch\(error\).*button\.disabled=false/s);
});

test("assignment validates required assignees before confirmation side effect",()=>{
  const assignment=read("assets/js/domains/receiving/order/assignment/assignment-pool.js");
  const confirmAt=assignment.indexOf("confirmReception(host,data,draft,callbacks)");
  const pickingAt=assignment.indexOf("if(!draft.pickingProfileId)return toast");
  const cutAt=assignment.indexOf("if(hasCuts&&!draft.cutProfileId)return toast");
  assert.ok(pickingAt>=0&&pickingAt<confirmAt);
  assert.ok(cutAt>=0&&cutAt<confirmAt);
  assert.equal((assignment.match(/confirmReception\(/g)||[]).length,1);
});
