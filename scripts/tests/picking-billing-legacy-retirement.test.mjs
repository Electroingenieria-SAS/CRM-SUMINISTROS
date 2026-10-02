import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const runtimeRoot=path.join(root,"assets/js");
const appEntry=fs.readFileSync(path.join(runtimeRoot,"app-entry.js"),"utf8");
const legacy=[
  "modules/picking-focus-v1195.js",
  "modules/billing-focus-v1198.js",
  "modules/billing-upload-v1199.js",
  "modules/billing-multiformat-v11101.js"
];

function runtimeSources(directory){
  const output=[];
  for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
    const full=path.join(directory,entry.name);
    if(entry.isDirectory())output.push(...runtimeSources(full));
    else if(entry.isFile()&&entry.name.endsWith(".js"))output.push([path.relative(root,full),fs.readFileSync(full,"utf8")]);
  }
  return output;
}

function resolvedRelativeImports(file,source){
  const directory=path.dirname(path.join(root,file));
  return [...source.matchAll(/(?:from\s+|import\s*)["']([^"']+)["']/g)]
    .map(match=>match[1])
    .filter(spec=>spec.startsWith("."))
    .map(spec=>path.relative(root,path.resolve(directory,spec)).split(path.sep).join("/"));
}

test("Picking and Billing legacy runtime modules are retired",()=>{
  for(const relative of legacy){
    assert.equal(fs.existsSync(path.join(runtimeRoot,relative)),false,relative);
    assert.equal(appEntry.includes(relative.split("/").at(-1)),false,relative);
  }
});

test("runtime never reassigns api.saveInvoice",()=>{
  const offenders=runtimeSources(runtimeRoot)
    .filter(([,source])=>/api\.saveInvoice\s*=/.test(source))
    .map(([file])=>file);
  assert.deepEqual(offenders,[]);
});

test("canonical Picking and Billing owners do not install replacement global observers/click patches",()=>{
  const files=[
    "domains/picking/ui/picking-focus.js",
    "domains/billing/ui/billing-focus.js",
    "domains/billing/uploads/upload-experience.js",
    "domains/billing/invoice-reader/installation.js"
  ];
  for(const relative of files){
    const source=fs.readFileSync(path.join(runtimeRoot,relative),"utf8");
    assert.doesNotMatch(source,/MutationObserver/,relative);
  }
  const picking=fs.readFileSync(path.join(runtimeRoot,"domains/picking/ui/picking-focus.js"),"utf8");
  const billing=fs.readFileSync(path.join(runtimeRoot,"domains/billing/ui/billing-focus.js"),"utf8");
  assert.doesNotMatch(picking,/document\.addEventListener\(["']click/, "Picking global click");
  assert.doesNotMatch(billing,/document\.addEventListener\(["']click/, "Billing global click");
});

test("canonical invoice reader remains explicitly reachable from invoice upload",()=>{
  const upload=fs.readFileSync(path.join(runtimeRoot,"domains/billing/uploads/invoice-upload.js"),"utf8");
  assert.match(upload,/installInvoiceReader\(dialog\)/);
  assert.match(upload,/buildInvoiceReaderPayload\(dialog,basePayload\)/);
  assert.match(upload,/saveInvoiceExplicit\(data\.order\.id,payload\)/);
});

test("Picking and Billing relative imports remain isolated from other closing lanes and DB",()=>{
  const domainFiles=[
    ...runtimeSources(path.join(runtimeRoot,"domains/picking")),
    ...runtimeSources(path.join(runtimeRoot,"domains/billing"))
  ];
  const forbiddenPrefixes=[
    "assets/js/domains/shipping/",
    "assets/js/domains/receiving/",
    "assets/js/integrations/auditoria-erp/",
    "assets/js/domains/orders/",
    "assets/js/core/bootstrap/",
    "supabase/"
  ];
  const offenders=[];
  for(const [file,source] of domainFiles){
    for(const target of resolvedRelativeImports(file,source)){
      const prefix=forbiddenPrefixes.find(value=>target.startsWith(value));
      if(prefix)offenders.push({file,target,prefix});
    }
    if(/supabase\/migrations\//.test(source))offenders.push({file,target:"literal supabase/migrations/"});
  }
  assert.deepEqual(offenders,[]);
});
