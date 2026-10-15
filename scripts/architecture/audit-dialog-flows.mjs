import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root=fileURLToPath(new URL("../../",import.meta.url));
const folders=["assets/js/domains","assets/js/modules","assets/js/core/ui"];
function walk(directory){
  if(!fs.existsSync(directory))return [];
  return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
    const full=path.join(directory,entry.name);
    return entry.isDirectory()?walk(full):entry.isFile()&&full.endsWith(".js")?[full]:[];
  });
}
const markers=[
  ["core-modal",/\bmodal\s*\(\s*\{/],
  ["wizard",/\bwizard\s*\(\s*\{/],
  ["task-panel",/\btaskPanel\s*\(/],
  ["native-dialog",/<dialog\b|createElement\(["']dialog["']\)/],
  ["custom-dialog",/role=\\?["']dialog\\?["']|class=\\?["'][^"']*modal-overlay/],
  ["shipping-shell",/\bshell\(host|shippingFooter\(/]
];
const actionSelectors=/(data-next|data-confirm|data-task-panel-confirm|data-shipping-next-core|type=\\?["']submit|confirmLabel|finishLabel|onConfirm|onFinish|data-picking-next|data-billing-next)/;
const files=folders.flatMap(folder=>walk(path.join(root,folder)));
const found=files.flatMap(full=>{
  const contents=fs.readFileSync(full,"utf8");
  const patterns=markers.filter(([,re])=>re.test(contents)).map(([name])=>name);
  if(!patterns.length)return [];
  const relative=path.relative(root,full).replaceAll(path.sep,"/");
  return [{file:relative,domain:relative.split("/")[3]||"shared",
    kinds:patterns,hasActionContract:actionSelectors.test(contents),
    hasCancelOrClose:/(data-close|data-.*close|cancelLabel|Cerrar|Cancelar)/i.test(contents)}];
});
const summary={
  scannedFiles:files.length,
  dialogueOwners:found.length,
  byKind:Object.fromEntries(markers.map(([name])=>[name,found.filter(f=>f.kinds.includes(name)).length])),
  needsManualReview:found.filter(f=>!f.hasActionContract||!f.hasCancelOrClose).map(f=>f.file)
};
if(process.argv.includes("--json"))console.log(JSON.stringify({summary,owners:found},null,2));
else{
  console.log("CRM: modal entrypoint inventory",summary);
  for(const item of found)console.log(`${item.file} | ${item.kinds.join(",")} | actions:${item.hasActionContract} close:${item.hasCancelOrClose}`);
  console.log("NOTE: flags identify code paths for manual testing, not proven missing buttons.");
}
