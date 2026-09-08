import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const cssDir=path.join(root,"assets/css");

const bundles={
  "core-shell.css":[
    "app.css","operational-v112.css","guides-v113.css","workforce-taxonomy-v113.css"
  ],
  "operations.css":[
    "receiving-v115.css","receiving-guide-v115.css","inventory-scan-v116.css","inventory-core-v11110.css",
    "v118.css","audit-v1182.css","audit-v1183.css","ui-v1184.css","dashboard-v1185.css",
    "commercial-v1187.css","commercial-v1188.css","operational-lists-v1189.css","popup-ux-v1190.css",
    "order-create-v1191.css","receiving-order-v1192.css","receiving-focus-v1193.css","receiving-polish-v1194.css",
    "picking-focus-v1195.css","picking-legibility-v1196.css","picking-review-v1197.css",
    "billing-focus-v1198.css","billing-upload-v1199.css","billing-invoice-reader-v1199.css","global-progress-v11100.css",
    "shipping-guide-reader-v11101.css","shipping-core-v11107.css","sent-orders-v11108.css"
  ],
  "analytics.css":[
    "flow-times-core-v11120.css","flow-performance-v11130.css","reports-enterprise-v11140.css",
    "history-center-v11150.css","admin-center-v11160.css","cutting-center-v11170.css"
  ],
  "experience.css":[
    "workspace-atmosphere-v11200.css","responsive-foundation-v11190.css","paco-assistant-v11200.css"
  ]
};

const sources=Object.values(bundles).flat();
const missing=sources.filter(name=>!fs.existsSync(path.join(cssDir,name)));
if(missing.length){
  const allBundles=Object.keys(bundles).every(name=>fs.existsSync(path.join(cssDir,name)));
  if(allBundles){console.log("CSS V11.21 ya consolidado; sin cambios.");process.exit(0)}
  throw new Error(`No se puede consolidar: faltan fuentes ${missing.join(", ")}`);
}

for(const [bundle,names] of Object.entries(bundles)){
  const body=names.map(name=>{
    const source=fs.readFileSync(path.join(cssDir,name),"utf8").replace(/^\uFEFF/,"");
    return `\n/* ==========================================================================\n   Fuente consolidada: ${name}\n   ========================================================================== */\n${source.trimEnd()}\n`;
  }).join("");
  fs.writeFileSync(path.join(cssDir,bundle),`/* CRM Suministros V11.21.0 · Familia CSS canónica\n   Generada por concatenación determinista. El orden interno replica exactamente\n   la cascada de Production anterior para evitar regresiones visuales. */\n${body}`,"utf8");
}

const indexPath=path.join(root,"index.html");
let index=fs.readFileSync(indexPath,"utf8");
const first=index.indexOf('  <link rel="stylesheet" href="./assets/css/app.css?v=11.21.0">');
const lastLine='  <link rel="stylesheet" href="./assets/css/paco-assistant-v11200.css?v=11.21.0">';
const last=index.indexOf(lastLine);
if(first<0||last<0)throw new Error("No se encontró el bloque CSS V11.21 esperado en index.html");
const replacement=[
  '  <link rel="stylesheet" href="./assets/css/core-shell.css?v=11.21.0">',
  '  <link rel="stylesheet" href="./assets/css/operations.css?v=11.21.0">',
  '  <link rel="stylesheet" href="./assets/css/analytics.css?v=11.21.0">',
  '  <link rel="stylesheet" href="./assets/css/experience.css?v=11.21.0">'
].join("\n");
index=index.slice(0,first)+replacement+index.slice(last+lastLine.length);
fs.writeFileSync(indexPath,index,"utf8");

const swPath=path.join(root,"service-worker.js");
let sw=fs.readFileSync(swPath,"utf8");
const swStart=sw.indexOf('  "./assets/css/app.css"');
const swLastToken='"./assets/css/paco-assistant-v11200.css",';
const swEnd=sw.indexOf(swLastToken);
if(swStart<0||swEnd<0)throw new Error("No se encontró el bloque CSS esperado en service-worker.js");
const swReplacement='  "./assets/css/core-shell.css","./assets/css/operations.css","./assets/css/analytics.css","./assets/css/experience.css",\n';
sw=sw.slice(0,swStart)+swReplacement+sw.slice(swEnd+swLastToken.length+1);
fs.writeFileSync(swPath,sw,"utf8");

for(const name of sources)fs.unlinkSync(path.join(cssDir,name));

console.log(`CSS consolidado: ${sources.length} archivos -> ${Object.keys(bundles).length} familias canónicas.`);
