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
const architectureMigration=read("supabase/migrations/094_architecture_core_cleanup_v11_21_0.sql");
const inventoryMigration=read("supabase/migrations/095_inventory_accounting_blind_count_v11_23_0.sql");
const expressMigration=read("supabase/migrations/096_inventory_express_super_admin_review_v11_23_1.sql");
const scheduleMigration=read("supabase/migrations/097_restore_inventory_control_plan_v11_23_2.sql");
const inventoryModule=read("assets/js/modules/inventory.js"),inventoryService=read("assets/js/services/inventory.js"),inventoryReview=read("assets/js/modules/inventory-review-v11230.js"),inventoryPlan=read("assets/js/modules/inventory-plan-v11232.js"),inventoryControl=read("assets/js/modules/inventory-control-v11230.js");
const coreCss=read("assets/css/core-shell.css"),experienceCss=read("assets/css/experience.css");
const jsFiles=walk(path.join(root,"assets/js")).filter(file=>file.endsWith(".js"));
const jsRuntime=jsFiles.map(file=>fs.readFileSync(file,"utf8")).join("\n");
const normalizedJsRuntime=jsRuntime.replace(/\bArray\s*\.\s*from\s*\(/g,"Array_from(").replace(/\bObject\s*\.\s*fromEntries\s*\(/g,"Object_fromEntries(");

check(version==="11.23.2","CONFIG.version debe ser 11.23.2.");
check(build==="2026-09-09.03","CONFIG.build debe ser 2026-09-09.03.");
check(pkg.version===version,"package.json y CONFIG.version deben coincidir.");
check(index.includes(`app-entry.js?v=${version}`),"index.html debe cargar app-entry.js con la versión vigente.");
check((index.match(/<script\s+type="module"\s+src="\.\/assets\/js\//g)||[]).length===1,"index.html debe tener un único entrypoint ES Module local.");
check(entry.includes('import "./main.js";'),"app-entry.js debe delegar finalmente al núcleo main.js.");

const canonicalCss=["assets/css/core-shell.css","assets/css/operations.css","assets/css/analytics.css","assets/css/experience.css"];
const cssRefs=[...index.matchAll(/href="\.\/([^"?#]+)(?:\?v=([^"#]+))?"/g)].filter(m=>m[1].endsWith(".css"));
check(cssRefs.length===4,"index.html debe cargar exactamente cuatro familias CSS canónicas.");
check(JSON.stringify(cssRefs.map(m=>m[1]))===JSON.stringify(canonicalCss),"El orden CSS canónico debe ser core-shell → operations → analytics → experience.");
check(cssRefs.every(m=>m[2]===version),"Las cuatro familias CSS deben usar la versión única del release.");
for(const cssPath of canonicalCss)check(exists(cssPath),`Falta familia CSS canónica: ${cssPath}`);
const cssFiles=walk(path.join(root,"assets/css")).filter(file=>file.endsWith(".css")).map(rel).sort();
check(cssFiles.length===4&&cssFiles.every(file=>canonicalCss.includes(file)),"assets/css debe contener únicamente las cuatro familias canónicas.");
check((coreCss.match(/:root\{/g)||[]).length===1,"core-shell.css debe conservar una sola raíz de tokens visuales.");
check(coreCss.includes('font-family:"Century Gothic"'),"La tipografía institucional no está aplicada en core-shell.css.");
check(experienceCss.includes('.paco2-panel{display:none!important}')&&experienceCss.includes('.is-open .paco2-panel{display:flex!important}'),"El contrato visual de Paco no sobrevivió a la consolidación.");

const appShellBody=sw.match(/const APP_SHELL=\[([\s\S]*?)\];/)?.[1]||"";
check(Boolean(appShellBody),"service-worker.js debe declarar APP_SHELL.");
const swRefs=[...appShellBody.matchAll(/"(\.\/[^"?#]+)"/g)].map(m=>m[1]);
for(const asset of swRefs){if(asset!=="./")check(exists(asset.slice(2)),`Asset inexistente precacheado: ${asset}`)}
check(new Set(swRefs).size===swRefs.length,"service-worker.js contiene assets duplicados en APP_SHELL.");
for(const cssPath of canonicalCss)check(sw.includes(`./${cssPath}`),`PWA no precachea ${cssPath}.`);
check(!/assets\/css\/(?!core-shell|operations|analytics|experience)[^"']+\.css/.test(sw),"PWA conserva hojas CSS históricas.");
check(sw.includes('// previous-cache: crm-suministros-v11-23-1-20260909-02'),"previous-cache PWA debe apuntar a V11.23.1.");
check(sw.includes('const CACHE="crm-suministros-v11-23-2-20260909-03";'),"CACHE activo PWA no corresponde a V11.23.2 build 03.");
check(sw.includes('caches.match(event.request,{ignoreSearch:true})'),"PWA debe resolver assets versionados ignorando query string.");
check(sw.includes('event.request.mode==="navigate"'),"Service Worker debe conservar fallback exclusivo para navegación.");

const enhancementModules=["responsive-foundation-v11190.js","global-progress-v11100.js","bootstrap-v113.js","inventory-scan-bootstrap-v116.js","order-priority-v117.js","pagination-v1184.js","commercial-v1187.js","commercial-records-v1188.js","popup-ux-v1190.js","order-create-v1191.js","receiving-order-v1192.js","receiving-focus-v1193.js","receiving-polish-v1194.js","picking-focus-v1195.js","billing-focus-v1198.js","billing-upload-v1199.js","billing-invoice-reader-v1199.js","billing-multiformat-v11101.js","shipping-guide-reader-v11101.js","flow-performance-v11130.js"];
for(const moduleName of enhancementModules){check(entry.includes(`./modules/${moduleName}`),`app-entry.js no gobierna ${moduleName}.`);check(!index.includes(`/modules/${moduleName}`),`index.html todavía carga ${moduleName} como entrypoint paralelo.`)}

const bannedRuntime=/\b(QA_BOT|erp_x_qa_|erp_x_run_qa_|erp_x_sandbox_|sandboxMode|manualSandbox|TEST-QA-|erp-e2e-bot)\b/i;
check(!bannedRuntime.test(jsRuntime),"El frontend productivo conserva referencias QA/Sandbox.");
check(!/\.from\s*\(/.test(normalizedJsRuntime),"El navegador no debe acceder a tablas directamente; use RPC.");

for(const token of ["erp_supply.confirm_picking_round_core","erp_supply.execute_cut_group_core","erp_supply.resolve_cut_requirement_core","erp_supply.work_my_day_core","erp_supply.vsm_people_core"])check(architectureMigration.includes(token),`Migración 094 incompleta: falta ${token}.`);
for(const token of ["erp_supply.inventory_count_reports","erp_x_inventory_count_submit","erp_x_inventory_count_review","erp_x_inventory_count_plan","erp_x_inventory_count_center","inventory_count_is_blind_operator","drop function if exists public.erp_x_inventory_cycle_count","drop function if exists public.erp_x_inventory_cycle_control"])check(inventoryMigration.includes(token),`Migración 095 incompleta: falta ${token}.`);
check(inventoryMigration.includes("revoke all on table erp_supply.inventory_count_reports from public, anon, authenticated"),"La tabla de reportes debe permanecer detrás de RPC SECURITY DEFINER.");
check(inventoryMigration.includes("Vista de existencias restringida durante el conteo ciego"),"Falta el bloqueo servidor para consultas ricas del auxiliar.");
check(expressMigration.includes("erp_x_inventory_express_reports"),"Migración 096 no registra la cola exprés.");
check(expressMigration.includes("erp_supply.has_role('super_admin')"),"La cola exprés debe permanecer exclusiva de Super Admin.");
check(scheduleMigration.includes("inventory_count_schedule_core"),"Migración 097 no registra el plan diario canónico.");
check(scheduleMigration.includes("remainingToday")&&scheduleMigration.includes("countedToday"),"Migración 097 debe exponer avance real de la jornada.");
check(scheduleMigration.includes("revoke all on function erp_supply.inventory_count_schedule_core"),"El plan interno no debe quedar expuesto directamente al navegador.");
check(scheduleMigration.includes("v_engine->''plan''"),"Control debe recibir nuevamente el plan diario con Pareto.");

for(const file of ["assets/js/modules/inventory.js","assets/js/modules/inventory-operator-v11230.js","assets/js/modules/inventory-plan-v11232.js","assets/js/modules/inventory-review-v11230.js","assets/js/modules/inventory-stock-v11230.js","assets/js/modules/inventory-control-v11230.js","assets/js/services/inventory.js"])check(exists(file),`Falta propietario V11.23: ${file}`);
for(const legacy of ["assets/js/modules/inventory-stock.js","assets/js/modules/inventory-cycle-v11220.js","assets/js/modules/inventory-control-v11220.js"])check(!exists(legacy),`Inventario conserva módulo V11.22 retirado: ${legacy}`);
check(inventoryModule.includes('views=[["count","Contar"],["labels","Etiquetas"]]'),"El auxiliar debe conservar una experiencia mínima Contar/Etiquetas.");
check(inventoryModule.includes('["plan","Plan de conteos"]'),"Los perfiles de control deben recuperar Plan de conteos como primera vista.");
check(inventoryModule.includes('["express","Conteo exprés"]'),"Super Admin debe disponer de una pestaña Conteo exprés.");
check(inventoryModule.includes('current==="plan"'),"Inventario no enruta Plan de conteos.");
check(inventoryPlan.includes("PARETO ADAPTATIVO")&&inventoryPlan.includes("Pendientes hoy")&&inventoryPlan.includes("Pendientes anuales"),"Plan de conteos debe renderizar Pareto y pendientes diarios/anuales.");
check(inventoryPlan.includes("businessScore")&&inventoryPlan.includes("abcTurns")&&inventoryPlan.includes("abcCost"),"Plan de conteos perdió las señales de prioridad del motor.");
check(inventoryControl.includes("Pendientes hoy")&&inventoryControl.includes("PARETO ADAPTATIVO"),"Inteligencia debe conservar pendientes y Pareto.");
check(inventoryService.includes("erp_x_inventory_count_submit")&&inventoryService.includes("erp_x_inventory_count_review"),"El servicio de Inventario no usa los contratos V11.23.");
check(inventoryService.includes("erp_x_inventory_express_reports"),"El servicio no usa el contrato exclusivo de Conteo exprés.");
check(inventoryReview.includes('scope==="EXPRESS"')&&inventoryReview.includes("inventoryExpressReports"),"La vista de revisión no separa la cola exprés.");
check(!inventoryService.includes("erp_x_inventory_cycle_count"),"El servicio aún referencia conteo directo V11.22.");

const workflows=walk(path.join(root,".github/workflows")).filter(file=>/\.ya?ml$/i.test(file)).map(rel);
check(workflows.length===1&&workflows[0]===".github/workflows/validate-crm.yml","Debe existir una sola CI canónica: validate-crm.yml.");
check(vercel.includes('"main": true')&&vercel.includes('"*": false'),"Vercel debe desplegar automáticamente solo main.");
check(exists(".vercelignore"),"Falta .vercelignore.");
check(exists("supabase/functions/erp-admin-users/index.ts")&&exists("supabase/functions/erp-admin-impersonate/index.ts"),"Falta una Edge Function administrativa activa.");
check(main.includes('installPacoAssistant();')&&main.includes('initRouter('),"main.js debe conservar el arranque del asistente y router.");
check(exists("assets/js/modules/shipping-flow.js")&&exists("assets/js/modules/cutting-flow.js"),"Falta un módulo operativo crítico.");
check(exists("assets/js/modules/vsm.js")&&exists("assets/js/modules/reports-enterprise-v11140.js")&&exists("assets/js/modules/history-center-v11150.js"),"Falta un módulo analítico crítico.");

if(failures.length){console.error(`VALIDACIÓN CRM ${version||"SIN VERSIÓN"} FALLÓ`);failures.forEach(item=>console.error(`- ${item}`));process.exit(1)}
console.log(`VALIDACIÓN CRM ${version} CORRECTA`);
console.log(`- Build ${build}`);
console.log(`- ${jsFiles.length} archivos JavaScript bajo un único app-entry.`);
console.log("- Inventario V11.23 segregado: captura ciega → revisión → aplicación contable.");
console.log("- Plan diario y Pareto restaurados para Control con avance real de jornada.");
console.log("- Conteo exprés disponible como cola exclusiva de Super Admin.");
console.log("- Módulos V11.22 de conteo directo retirados del runtime.");
console.log("- CI única, Vercel solo desde main y PWA V11.23.2 coherente.");