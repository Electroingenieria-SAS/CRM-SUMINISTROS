import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const failures=[];
const check=(ok,msg)=>{if(!ok)failures.push(msg)};
const exists=rel=>fs.existsSync(path.join(root,rel));
const read=rel=>fs.readFileSync(path.join(root,rel),"utf8");
const rel=file=>path.relative(root,file).replaceAll("\\","/");
function walk(dir,out=[]){
  if(!fs.existsSync(dir))return out;
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())walk(full,out);else out.push(full);
  }
  return out;
}

const pkg=JSON.parse(read("package.json"));
const config=read("assets/js/config.js");
const version=config.match(/version:\s*"([^"]+)"/)?.[1]||"";
const build=config.match(/build:\s*"([^"]+)"/)?.[1]||"";
const index=read("index.html");
const entry=read("assets/js/app-entry.js");
const main=read("assets/js/main.js");
const sw=read("service-worker.js");
const vercel=read("vercel.json");
const migration=read("supabase/migrations/094_architecture_core_cleanup_v11_21_0.sql");
const coreCss=read("assets/css/core-shell.css");
const experienceCss=read("assets/css/experience.css");
const jsFiles=walk(path.join(root,"assets/js")).filter(file=>file.endsWith(".js"));
const jsRuntime=jsFiles.map(file=>fs.readFileSync(file,"utf8")).join("\n");

check(version==="11.21.0","CONFIG.version debe ser 11.21.0.");
check(build==="2026-09-08.10","CONFIG.build debe ser 2026-09-08.10.");
check(pkg.version===version,"package.json y CONFIG.version deben coincidir.");
check(index.includes(`app-entry.js?v=${version}`),"index.html debe cargar app-entry.js con la versión vigente.");
check((index.match(/<script\s+type="module"\s+src="\.\/assets\/js\//g)||[]).length===1,"index.html debe tener un único entrypoint ES Module local.");
check(entry.includes('import "./main.js";'),"app-entry.js debe delegar finalmente al núcleo main.js.");

const canonicalCss=["assets/css/core-shell.css","assets/css/operations.css","assets/css/analytics.css","assets/css/experience.css"];
const cssRefs=[...index.matchAll(/href="\.\/([^"?#]+)(?:\?v=([^"#]+))?"/g)]
  .filter(m=>m[1].endsWith(".css"));
check(cssRefs.length===4,"index.html debe cargar exactamente cuatro familias CSS canónicas.");
check(JSON.stringify(cssRefs.map(m=>m[1]))===JSON.stringify(canonicalCss),"El orden CSS canónico debe ser core-shell → operations → analytics → experience.");
check(cssRefs.every(m=>m[2]===version),"Las cuatro familias CSS deben usar la versión única del release.");
for(const cssPath of canonicalCss)check(exists(cssPath),`Falta familia CSS canónica: ${cssPath}`);
const cssFiles=walk(path.join(root,"assets/css")).filter(file=>file.endsWith(".css")).map(rel).sort();
check(cssFiles.length===4&&cssFiles.every(file=>canonicalCss.includes(file)),"assets/css debe contener únicamente las cuatro familias canónicas.");
check((coreCss.match(/:root\{/g)||[]).length===1,"core-shell.css debe conservar una sola raíz de tokens visuales.");
check(coreCss.includes('font-family:"Century Gothic"'),"La tipografía institucional no está aplicada en core-shell.css.");
check(experienceCss.includes('.paco2-panel{display:none!important}')&&experienceCss.includes('.is-open .paco2-panel{display:flex!important}'),"El contrato visual de Paco no sobrevivió a la consolidación.");

const swRefs=[...sw.matchAll(/"(\.\/[^"?#]+)"/g)].map(m=>m[1]);
for(const asset of swRefs){if(asset!=="./")check(exists(asset.slice(2)),`Asset inexistente precacheado: ${asset}`)}
check(new Set(swRefs).size===swRefs.length,"service-worker.js contiene assets duplicados.");
for(const cssPath of canonicalCss)check(sw.includes(`./${cssPath}`),`PWA no precachea ${cssPath}.`);
check(!/assets\/css\/(?!core-shell|operations|analytics|experience)[^"']+\.css/.test(sw),"PWA conserva hojas CSS históricas.");
check(sw.includes("crm-suministros-v11-21-0-20260908-10"),"Cache PWA no corresponde a V11.21.0.");
check(sw.includes('caches.match(event.request,{ignoreSearch:true})'),"PWA debe resolver assets versionados ignorando query string.");
check(sw.includes('event.request.mode==="navigate"'),"Service Worker debe conservar fallback exclusivo para navegación.");

const enhancementModules=[
  "responsive-foundation-v11190.js","global-progress-v11100.js","bootstrap-v113.js","inventory-scan-bootstrap-v116.js",
  "order-priority-v117.js","pagination-v1184.js","commercial-v1187.js","commercial-records-v1188.js","popup-ux-v1190.js",
  "order-create-v1191.js","receiving-order-v1192.js","receiving-focus-v1193.js","receiving-polish-v1194.js","picking-focus-v1195.js",
  "billing-focus-v1198.js","billing-upload-v1199.js","billing-invoice-reader-v1199.js","billing-multiformat-v11101.js",
  "shipping-guide-reader-v11101.js","flow-performance-v11130.js"
];
for(const moduleName of enhancementModules){
  check(entry.includes(`./modules/${moduleName}`),`app-entry.js no gobierna ${moduleName}.`);
  check(!index.includes(`/modules/${moduleName}`),`index.html todavía carga ${moduleName} como entrypoint paralelo.`);
}

const bannedRuntime=/\b(QA_BOT|erp_x_qa_|erp_x_run_qa_|erp_x_sandbox_|sandboxMode|manualSandbox|TEST-QA-|erp-e2e-bot)\b/i;
check(!bannedRuntime.test(jsRuntime),"El frontend productivo conserva referencias QA/Sandbox.");
check(!/\.from\s*\(/.test(jsRuntime),"El navegador no debe acceder a tablas directamente; use RPC.");

check(migration.includes("erp_supply.confirm_picking_round_core"),"Migración 094 no consolida Picking.");
check(migration.includes("erp_supply.execute_cut_group_core"),"Migración 094 no consolida Corte agrupado.");
check(migration.includes("erp_supply.resolve_cut_requirement_core"),"Migración 094 no consolida resolución de Corte.");
check(migration.includes("erp_supply.work_my_day_core"),"Migración 094 no consolida Jornada.");
check(migration.includes("erp_supply.vsm_people_core"),"Migración 094 no consolida People Analytics.");
check((migration.match(/set search_path=''/g)||[]).length>=5,"Los contratos públicos saneados deben fijar search_path vacío.");
check((migration.match(/revoke all on function erp_supply\./g)||[]).length>=5,"Los núcleos privados deben revocar EXECUTE directo.");

const workflows=walk(path.join(root,".github/workflows")).filter(file=>/\.ya?ml$/i.test(file)).map(rel);
check(workflows.length===1&&workflows[0]===".github/workflows/validate-crm.yml","Debe existir una sola CI canónica: validate-crm.yml.");
check(vercel.includes('"main": true')&&vercel.includes('"*": false'),"Vercel debe desplegar automáticamente solo main.");
check(exists(".vercelignore"),"Falta .vercelignore.");
check(exists("supabase/functions/erp-admin-users/index.ts")&&exists("supabase/functions/erp-admin-impersonate/index.ts"),"Falta una Edge Function administrativa activa.");
check(main.includes('installPacoAssistant();')&&main.includes('initRouter('),"main.js debe conservar el arranque del asistente y router.");
check(exists("assets/js/modules/inventory.js")&&exists("assets/js/modules/shipping-flow.js")&&exists("assets/js/modules/cutting-flow.js"),"Falta un módulo operativo crítico.");
check(exists("assets/js/modules/vsm.js")&&exists("assets/js/modules/reports-enterprise-v11140.js")&&exists("assets/js/modules/history-center-v11150.js"),"Falta un módulo analítico crítico.");

if(failures.length){
  console.error(`VALIDACIÓN CRM ${version||"SIN VERSIÓN"} FALLÓ`);
  failures.forEach(item=>console.error(`- ${item}`));
  process.exit(1);
}
console.log(`VALIDACIÓN CRM ${version} CORRECTA`);
console.log(`- Build ${build}`);
console.log(`- ${jsFiles.length} archivos JavaScript bajo un único app-entry.`);
console.log("- 4 familias CSS canónicas; 0 hojas versionadas paralelas.");
console.log("- 5 núcleos Supabase privados/versionless detrás de contratos públicos estables.");
console.log("- CI única, Vercel solo desde main y PWA V11.21 coherente.");
