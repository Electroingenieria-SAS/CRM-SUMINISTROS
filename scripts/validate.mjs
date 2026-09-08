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

const packageJson=JSON.parse(read("package.json"));
const config=read("assets/js/config.js");
const version=config.match(/version:\s*"([^"]+)"/)?.[1]||"";
const build=config.match(/build:\s*"([^"]+)"/)?.[1]||"";
const index=read("index.html");
const entry=read("assets/js/app-entry.js");
const main=read("assets/js/main.js");
const sw=read("service-worker.js");
const vercel=read("vercel.json");
const css=read("assets/css/app.css");
const jsFiles=walk(path.join(root,"assets/js")).filter(file=>file.endsWith(".js"));
const jsRuntime=jsFiles.map(file=>fs.readFileSync(file,"utf8")).join("\n");

check(/^\d+\.\d+\.\d+$/.test(version),"CONFIG.version debe usar SemVer x.y.z.");
check(/^\d{4}-\d{2}-\d{2}\.\d{2}$/.test(build),"CONFIG.build debe usar YYYY-MM-DD.NN.");
check(packageJson.version===version,"package.json y CONFIG.version deben coincidir.");
check(index.includes(`app-entry.js?v=${version}`),"index.html debe cargar app-entry.js con la versión vigente.");
check((index.match(/<script\s+type="module"\s+src="\.\/assets\/js\//g)||[]).length===1,"index.html debe tener un único entrypoint ES Module local.");
check(entry.includes('import "./main.js";'),"app-entry.js debe terminar en el núcleo main.js.");

const cssRefs=[...index.matchAll(/href="\.\/([^"?#]+)(?:\?[^"#]*)?"/g)].map(m=>m[1]).filter(value=>value.endsWith(".css"));
for(const cssRef of cssRefs)check(exists(cssRef),`CSS inexistente referenciado por index.html: ${cssRef}`);
const cssVersions=[...index.matchAll(/href="\.\/assets\/css\/[^"?]+\?v=([^"]+)"/g)].map(m=>m[1]);
check(cssVersions.length===cssRefs.length&&cssVersions.every(item=>item===version),"Todas las hojas CSS deben usar la versión única del release.");
const scriptRefs=[...index.matchAll(/src="\.\/([^"?#]+)(?:\?[^"#]*)?"/g)].map(m=>m[1]);
for(const scriptRef of scriptRefs)check(exists(scriptRef),`Script inexistente referenciado por index.html: ${scriptRef}`);

const swRefs=[...sw.matchAll(/"(\.\/[^"?#]+)"/g)].map(m=>m[1]);
for(const asset of swRefs){
  if(asset==="./")continue;
  check(exists(asset.slice(2)),`Asset inexistente precacheado: ${asset}`);
}
check(new Set(swRefs).size===swRefs.length,"service-worker.js contiene assets duplicados en precache.");
const cacheVersion=version.replaceAll(".","-");
check(sw.includes(`crm-suministros-v${cacheVersion}-`),"Cache PWA no corresponde a CONFIG.version.");
check(sw.includes('caches.match(event.request,{ignoreSearch:true})'),"PWA debe resolver assets versionados desde el cache sin depender del query string.");
check(sw.includes('event.request.mode==="navigate"'),"Service Worker debe conservar fallback exclusivo para navegación.");
check(!sw.includes("paco-sprite-v11180.webp"),"Service Worker conserva sprite legado de Paco.");

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

const obsolete=[
  ".github/workflows/pages.yml",
  ".github/workflows/validate-admin-v11160.yml",
  ".github/workflows/validate-flow-times-v11120.yml",
  ".github/workflows/validate-history-v11150.yml",
  ".github/workflows/validate-performance-v11130.yml",
  ".github/workflows/validate-reports-v11140.yml",
  ".github/VERCEL_DEPLOY_HOLD.md",
  ".vercel-retry-v11100.txt",
  "assets/js/modules/api-getorder-dedupe-v11106.js",
  "assets/js/modules/shipping-focus-v11101.js",
  "assets/js/modules/shipping-next-v11106.js",
  "assets/js/modules/shipping-scale-v11103.js",
  "assets/js/modules/shipping-secondary-v11105.js",
  "assets/js/modules/shipping-workflow-v11102.js",
  "assets/css/shipping-focus-v11101.css",
  "assets/css/shipping-scale-v11103.css",
  "assets/css/shipping-secondary-v11105.css",
  "assets/css/shipping-workflow-v11102.css",
  "assets/img/logo-electroingenieria.jpeg",
  "assets/img/paco/paco-sprite-v11180.webp",
  "sql/00_INSTALL_ALL.sql"
];
for(const old of obsolete)check(!exists(old),`Artefacto obsoleto reapareció: ${old}`);

const workflows=walk(path.join(root,".github/workflows")).filter(file=>/\.ya?ml$/i.test(file)).map(rel);
check(workflows.length===1&&workflows[0]===".github/workflows/validate-crm.yml","Debe existir una sola CI canónica: validate-crm.yml.");
check(vercel.includes('"main": true')&&vercel.includes('"*": false'),"Vercel debe desplegar automáticamente solo main.");
check(exists(".vercelignore"),"Falta .vercelignore para excluir fuentes no desplegables.");
check(exists("supabase/migrations/094_architecture_core_cleanup_v11_21_0.sql"),"Falta la migración canónica de arquitectura V11.21.0.");

check(exists("assets/js/modules/paco-assistant-v11200.js")&&exists("assets/css/paco-assistant-v11200.css"),"Paco canónico no está completo.");
const paco=read("assets/js/modules/paco-assistant-v11200.js");
const pacoCss=read("assets/css/paco-assistant-v11200.css");
check(paco.includes('function setOpen(open)')&&paco.includes('addEventListener("click",toggleOpen)'),"Contrato de apertura de Paco incompleto.");
check(pacoCss.includes('.paco2-panel{display:none!important}')&&pacoCss.includes('.is-open .paco2-panel{display:flex!important}'),"Contrato visual de apertura de Paco incompleto.");

check((css.match(/:root\{/g)||[]).length===1,"app.css debe conservar una sola raíz de tokens visuales.");
check(css.includes('font-family:"Century Gothic"'),"La tipografía institucional no está aplicada en el sistema base.");
check(exists("assets/js/modules/inventory.js")&&exists("assets/js/modules/shipping-flow.js")&&exists("assets/js/modules/cutting-flow.js"),"Falta un módulo operativo crítico.");
check(exists("assets/js/modules/vsm.js")&&exists("assets/js/modules/reports-enterprise-v11140.js")&&exists("assets/js/modules/history-center-v11150.js"),"Falta un módulo analítico crítico.");
check(exists("supabase/functions/erp-admin-users/index.ts")&&exists("supabase/functions/erp-admin-impersonate/index.ts"),"Falta una Edge Function administrativa activa.");
check(main.includes('installPacoAssistant();')&&main.includes('initRouter('),"main.js debe conservar el arranque de asistente y router.");

if(failures.length){
  console.error(`VALIDACIÓN CRM ${version||"SIN VERSIÓN"} FALLÓ`);
  failures.forEach(item=>console.error(`- ${item}`));
  process.exit(1);
}
console.log(`VALIDACIÓN CRM ${version} CORRECTA`);
console.log(`- Build ${build}`);
console.log(`- ${jsFiles.length} archivos JavaScript revisados bajo un único entrypoint.`);
console.log(`- ${cssRefs.length} hojas CSS referenciadas y ${swRefs.length} rutas PWA verificadas.`);
console.log("- Sin QA/Sandbox frontend, entrypoints paralelos ni artefactos de despliegue obsoletos.");
