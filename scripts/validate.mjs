import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const failures=[];
const check=(ok,msg)=>{if(!ok)failures.push(msg)};
const exists=rel=>fs.existsSync(path.join(root,rel));
const read=rel=>fs.readFileSync(path.join(root,rel),"utf8");
const rel=file=>path.relative(root,file).replaceAll("\\","/");
function walk(dir,out=[]){if(!fs.existsSync(dir))return out;for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())walk(full,out);else out.push(full)}return out}

const pkg=JSON.parse(read("package.json"));
const config=read("assets/js/config.js");
const version=config.match(/version:\s*"([^"]+)"/)?.[1]||"";
const build=config.match(/build:\s*"([^"]+)"/)?.[1]||"";
const index=read("index.html"),entry=read("assets/js/app-entry.js"),main=read("assets/js/main.js"),sw=read("service-worker.js"),vercel=read("vercel.json");
const inventory=read("assets/js/modules/inventory.js"),service=read("assets/js/services/inventory.js"),home=read("assets/js/modules/inventory-home-v11250.js"),operator=read("assets/js/modules/inventory-operator-v11250.js"),plan=read("assets/js/modules/inventory-plan-v11250.js"),review=read("assets/js/modules/inventory-review-v11250.js"),stock=read("assets/js/modules/inventory-stock-v11250.js"),ledger=read("assets/js/modules/inventory-ledger-v11250.js"),control=read("assets/js/modules/inventory-control-v11250.js"),exportsModule=read("assets/js/modules/inventory-export-v11250.js"),ui=read("assets/js/modules/inventory-ui-v11240.js");
const inventoryMigration=read("supabase/migrations/095_inventory_accounting_blind_count_v11_23_0.sql");
const expressMigration=read("supabase/migrations/096_inventory_express_super_admin_review_v11_23_1.sql");
const scheduleMigration=read("supabase/migrations/097_restore_inventory_control_plan_v11_23_2.sql");
const coreCss=read("assets/css/core-shell.css"),experienceCss=read("assets/css/experience.css");
const jsFiles=walk(path.join(root,"assets/js")).filter(file=>file.endsWith(".js"));
const jsRuntime=jsFiles.map(file=>fs.readFileSync(file,"utf8")).join("\n");
const normalizedJsRuntime=jsRuntime.replace(/\bArray\s*\.\s*from\s*\(/g,"Array_from(").replace(/\bObject\s*\.\s*fromEntries\s*\(/g,"Object_fromEntries(");

check(version==="11.25.0","CONFIG.version debe ser 11.25.0.");
check(build==="2026-09-09.05","CONFIG.build debe ser 2026-09-09.05.");
check(pkg.version===version,"package.json y CONFIG.version deben coincidir.");
check(index.includes(`app-entry.js?v=${version}`),"index.html debe cargar el entrypoint de la versión vigente.");
check((index.match(/<script\s+type="module"\s+src="\.\/assets\/js\//g)||[]).length===1,"index.html debe tener un único entrypoint ES Module local.");
check(entry.includes('import "./main.js";'),"app-entry.js debe delegar a main.js.");

const canonicalCss=["assets/css/core-shell.css","assets/css/operations.css","assets/css/analytics.css","assets/css/experience.css"];
const cssRefs=[...index.matchAll(/href="\.\/([^"?#]+)(?:\?v=([^"#]+))?"/g)].filter(m=>m[1].endsWith(".css"));
check(cssRefs.length===4,"index.html debe cargar exactamente cuatro familias CSS canónicas.");
check(JSON.stringify(cssRefs.map(m=>m[1]))===JSON.stringify(canonicalCss),"El orden CSS canónico es inválido.");
check(cssRefs.every(m=>m[2]===version),"Todas las familias CSS deben usar la versión vigente.");
for(const cssPath of canonicalCss)check(exists(cssPath),`Falta CSS canónico: ${cssPath}`);
check(walk(path.join(root,"assets/css")).filter(file=>file.endsWith(".css")).map(rel).every(file=>canonicalCss.includes(file)),"assets/css conserva una familia no canónica.");
check((coreCss.match(/:root\{/g)||[]).length===1,"core-shell.css debe conservar una sola raíz de tokens.");
check(coreCss.includes('font-family:"Century Gothic"'),"Falta tipografía institucional.");
check(experienceCss.includes('.paco2-panel{display:none!important}'),"Se perdió el contrato visual de Paco.");

check(sw.includes('// previous-cache: crm-suministros-v11-24-0-20260909-04'),"previous-cache PWA debe apuntar a V11.24.0.");
check(sw.includes('const CACHE="crm-suministros-v11-25-0-20260909-05";'),"CACHE activo PWA no corresponde a V11.25.0.");
check(sw.includes('caches.match(event.request,{ignoreSearch:true})'),"PWA debe resolver assets versionados.");

const bannedRuntime=/\b(QA_BOT|erp_x_qa_|erp_x_run_qa_|erp_x_sandbox_|sandboxMode|manualSandbox|TEST-QA-|erp-e2e-bot)\b/i;
check(!bannedRuntime.test(jsRuntime),"El frontend productivo conserva referencias QA/Sandbox.");
check(!/\.from\s*\(/.test(normalizedJsRuntime),"El navegador no debe acceder a tablas directamente; use RPC.");

for(const token of ["erp_supply.inventory_count_reports","erp_x_inventory_count_submit","erp_x_inventory_count_review","erp_x_inventory_count_center","inventory_count_is_blind_operator","drop function if exists public.erp_x_inventory_cycle_count","drop function if exists public.erp_x_inventory_cycle_control"])check(inventoryMigration.includes(token),`Migración 095 incompleta: falta ${token}.`);
check(inventoryMigration.includes("Vista de existencias restringida durante el conteo ciego"),"Falta el bloqueo de existencias para el auxiliar.");
check(expressMigration.includes("erp_x_inventory_express_reports")&&expressMigration.includes("erp_supply.has_role('super_admin')"),"Migración 096 perdió la revisión exprés exclusiva.");
check(scheduleMigration.includes("inventory_count_schedule_core")&&scheduleMigration.includes("remainingToday")&&scheduleMigration.includes("countedToday"),"Migración 097 perdió el avance real de jornada.");

const requiredInventory=[
  "assets/js/modules/inventory.js","assets/js/modules/inventory-ui-v11240.js","assets/js/modules/inventory-home-v11250.js","assets/js/modules/inventory-operator-v11250.js","assets/js/modules/inventory-plan-v11250.js","assets/js/modules/inventory-review-v11250.js","assets/js/modules/inventory-stock-v11250.js","assets/js/modules/inventory-ledger-v11250.js","assets/js/modules/inventory-control-v11250.js","assets/js/modules/inventory-export-v11250.js","assets/js/services/inventory.js"
];
for(const file of requiredInventory)check(exists(file),`Falta propietario V11.25: ${file}`);
check(inventory.includes('inventoryCountCenter')&&inventory.includes('access.operator')&&inventory.includes('access.controller'),"Inventario debe gobernarse por capacidades del servidor.");
for(const view of ["home","capture","count","labels","plan","review","history","stock","ledger","control"])check(inventory.includes(`\"${view}\"`),`Falta vista de Inventario: ${view}`);
check(inventory.includes('express-review'),"Super Admin perdió Revisión exprés.");
check(home.includes("Conteo no programado")&&home.includes("Etiquetas y stickers")&&home.includes("Movimientos"),"Inicio no expone las funciones críticas.");
check(operator.includes("REGISTRAR CONTEO")&&operator.includes("Conteo exprés")&&operator.includes("Metraje")&&operator.includes("Imprimir jornada")&&operator.includes("Exportar CSV"),"Captura V11.25 perdió conteo, exprés, metraje o stickers.");
check(operator.includes("inventoryCountSubmit")&&operator.includes("inventoryCountResolve")&&operator.includes("inventoryCountSearch"),"Captura no usa los contratos seguros de conteo.");
check(plan.includes("PARETO ADAPTATIVO")&&plan.includes("Exportar CSV")&&plan.includes("businessScore"),"Plan perdió Pareto o exportación.");
check(review.includes("Aprobar y aplicar")&&review.includes("Solicitar reconteo")&&review.includes("Exportar CSV")&&review.includes("ALL"),"Revisión/Historial perdió decisiones o exportación.");
check(stock.includes("Actualizar Siesa")&&stock.includes("Exportar CSV")&&stock.includes("inventoryMovements"),"Existencias perdió sincronización, exportación o trazabilidad.");
check(ledger.includes("KARDEX")&&ledger.includes("inventoryMovements")&&ledger.includes("Exportar CSV"),"Movimientos no implementa kardex exportable.");
check(control.includes("PARETO ADAPTATIVO")&&control.includes("Exportar análisis"),"Inteligencia perdió Pareto o exportación.");
check(exportsModule.includes("downloadCsv")&&exportsModule.includes("URL.createObjectURL"),"Falta utilidad de exportación CSV.");
check(ui.includes("v115-goods-row")&&ui.includes("bindListFilter"),"Falta el sistema visual WMS común.");
check(service.includes("erp_x_inventory_count_submit")&&service.includes("erp_x_inventory_count_review")&&service.includes("erp_x_inventory_express_reports"),"El servicio de Inventario perdió contratos contables.");
check(!service.includes("erp_x_inventory_cycle_count"),"El servicio aún referencia conteo directo V11.22.");

const workflows=walk(path.join(root,".github/workflows")).filter(file=>/\.ya?ml$/i.test(file)).map(rel);
check(workflows.length===1&&workflows[0]===".github/workflows/validate-crm.yml","Debe existir una sola CI canónica.");
check(vercel.includes('"main": true')&&vercel.includes('"*": false'),"Vercel debe desplegar automáticamente solo main.");
check(exists(".vercelignore"),"Falta .vercelignore.");
check(main.includes('installPacoAssistant();')&&main.includes('initRouter('),"main.js perdió el arranque principal.");

if(failures.length){console.error(`VALIDACIÓN CRM ${version||"SIN VERSIÓN"} FALLÓ`);failures.forEach(item=>console.error(`- ${item}`));process.exit(1)}
console.log(`VALIDACIÓN CRM ${version} CORRECTA`);
console.log(`- Build ${build}`);
console.log(`- ${jsFiles.length} archivos JavaScript bajo un único app-entry.`);
console.log("- Inventario V11.25 integra captura, exprés, metraje, stickers, revisión, historial, existencias, kardex e inteligencia.");
console.log("- Navegación gobernada por capacidades del servidor: Operación y Control pueden coexistir en Super Admin.");
console.log("- Conteo ciego y aprobación contable permanecen como contratos obligatorios.");