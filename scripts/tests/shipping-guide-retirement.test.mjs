import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const runtimeRoot=path.join(root,"assets/js");
const legacyPath=path.join(runtimeRoot,"modules/shipping-guide-reader-v11101.js");
const appEntry=fs.readFileSync(path.join(runtimeRoot,"app-entry.js"),"utf8");

function runtimeSources(directory){
  const output=[];
  for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
    const full=path.join(directory,entry.name);
    if(entry.isDirectory())output.push(...runtimeSources(full));
    else if(entry.isFile()&&entry.name.endsWith(".js"))output.push([path.relative(root,full),fs.readFileSync(full,"utf8")]);
  }
  return output;
}

test("shipping guide legacy module and app-entry import are retired",()=>{
  assert.equal(fs.existsSync(legacyPath),false);
  assert.equal(appEntry.includes("shipping-guide-reader-v11101.js"),false);
});

test("runtime never reassigns api.saveShippingGuide",()=>{
  const offenders=runtimeSources(runtimeRoot)
    .filter(([,source])=>/api\.saveShippingGuide\s*=/.test(source))
    .map(([file])=>file);
  assert.deepEqual(offenders,[]);
});

test("shipping canonical owner remains explicit and reachable",()=>{
  const dialog=fs.readFileSync(path.join(runtimeRoot,"domains/logistics/shipping/guide/guide-dialog.js"),"utf8");
  const dispatch=fs.readFileSync(path.join(runtimeRoot,"domains/logistics/shipping/dispatch/dispatch-stage.js"),"utf8");
  assert.match(dispatch,/openGuideDialog/);
  assert.match(dialog,/saveShippingGuideExplicit/);
  assert.match(dialog,/buildShippingGuidePayload/);
  assert.doesNotMatch(dialog,/MutationObserver/);
});
