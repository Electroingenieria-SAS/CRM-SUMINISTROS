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
const pkgLock=JSON.parse(read("package-lock.json"));
const config=read("assets/js/config.js");
const version=config.match(/version:\s*"([^"]+)"/)?.[1]||"";
const build=config.match(/build:\s*"([^"]+)"/)?.[1]||"";
const index=read("index.html");
const entry=read("assets/js/app-entry.js");
const main=read("assets/js/main.js");
const sw=read("service-worker.js");
const vercel=read("vercel.json");
const inventory=read("assets/js/modules/inventory.js");
const service=read("assets/js/services/inventory.js");
const home=read("assets/js/modules/inventory-home-v11250.js");
const operator=read("assets/js/modules/inventory-operator-v11250.js");
const plan=read("assets/js/modules/inventory-plan-v11250.js");
const review=read("assets/js/modules/inventory-review-v11250.js");
const stock=read("assets/js/modules/inventory-stock-v11250.js");
const ledger=read("assets/js/modules/inventory-ledger-v11250.js");
const control=read("assets/js/modules/inventory-control-v11250.js");
const exportsModule=read("assets/js/modules/inventory-export-v11250.js");
const ui=read("assets/js/modules/inventory-ui-v11240.js");
const inventoryDialogs=read("assets/js/modules/inventory-dialogs-v11260.js");
const responsive=read("assets/js/modules/responsive-foundation-v11190.js");
const popupUx=read("assets/js/modules/popup-ux-v1190.js");
const inventoryMigration=read("supabase/migrations/095_inventory_accounting_blind_count_v11_23_0.sql");
const expressMigration=read("supabase/migrations/096_inventory_express_super_admin_review_v11_23_1.sql");
const scheduleMigration=read("supabase/migrations/097_restore_inventory_control_plan_v11_23_2.sql");
const rlsAuditMigration=read("supabase/migrations/098_profiles_rls_scope_v11_27_0.sql");
const workPerfMigration=read("supabase/migrations/099_work_my_day_role_cache_v11_27_0.sql");
const inventoryFilterMigration=read("supabase/migrations/100_inventory_filtered_hotpath_v11_27_0.sql");
const inventoryPlanMigration=read("supabase/migrations/101_inventory_count_plan_hotpath_v11_27_0.sql");
const coreCss=read("assets/css/core-shell.css");
const experienceCss=read("assets/css/experience.css");
const jsFiles=walk(path.join(root,"assets/js")).filter(file=>file.endsWith(".js"));
const jsRuntime=jsFiles.map(file=>fs.readFileSync(file,"utf8")).join("\n");
const normalizedJsRuntime=jsRuntime
  .replace(/\bArray\s*\.\s*from\s*\(/g,"Array_from(")
  .replace(/\bObject\s*\.\s*fromEntries\s*\(/g,"Object_fromEntries(");

// Release identity.
check(version==="11.27.0","CONFIG.version debe ser 11.27.0.");
check(build==="2026-09-11.01","CONFIG.build debe ser 2026-09-11.01.");
check(pkg.version===version,"package.json y CONFIG.version deben coincidir.");
check(pkgLock.version===version&&pkgLock.packages?.[""]?.version===version,"package-lock.json debe coincidir con la versión vigente.");
check(index.includes(`app-entry.js?v=${version}`),"index.html debe cargar el entrypoint de la versión vigente.");
check((index.match(/<script\s+type="module"\s+src="\.\/assets\/js\//g)||[]).length===1,"index.html debe tener un único entrypoint ES Module local.");
check(entry.includes('import "./main.js";'),"app-entry.js debe delegar a main.js.");
check(entry.includes('import "./modules/inventory-dialogs-v11260.js";'),"app-entry.js debe instalar el sistema único de diálogos guiados de Inventario.");
check(entry.includes('import "./modules/inventory-visual-v11270.js";'),"app-entry.js debe instalar la capa visual V11.27 de Inventario.");
check(!entry.includes("inventory-modal-v11253.js")&&!entry.includes("inventory-modal-workspace-v11254.js"),"app-entry.js no debe cargar propietarios modales históricos.");

// Canonical CSS architecture.
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

// PWA and Vercel routing.
check(sw.includes('// previous-cache: crm-suministros-v11-26-0-20260910-01'),"previous-cache PWA debe apuntar a V11.26.0.");
check(sw.includes('const CACHE="crm-suministros-v11-27-0-20260911-01";'),"CACHE activo PWA no corresponde a V11.27.0.");
check(sw.includes('caches.match(event.request,{ignoreSearch:true})'),"PWA debe resolver assets versionados.");
check(index.includes('<link rel="manifest" href="./manifest.webmanifest">'),"index.html debe declarar el manifest PWA.");
check(vercel.includes('manifest\\\\.webmanifest')||vercel.includes('/manifest.webmanifest'),"Vercel debe excluir o tratar explícitamente el manifest real.");
check(vercel.includes('/service-worker.js')&&vercel.includes('no-cache, no-store, must-revalidate'),"Service worker debe revalidarse en cada release.");

// Browser/backend boundaries.
const bannedRuntime=/\b(QA_BOT|erp_x_qa_|erp_x_run_qa_|erp_x_sandbox_|sandboxMode|manualSandbox|TEST-QA-|erp-e2e-bot)\b/i;
check(!bannedRuntime.test(jsRuntime),"El frontend productivo conserva referencias QA/Sandbox.");
check(!/\.from\s*\(/.test(normalizedJsRuntime),"El navegador no debe acceder a tablas directamente; use RPC.");

// Security/performance audit corrections.
check(rlsAuditMigration.includes('drop policy if exists erp_active_read on public.profiles'),"Migración 098 debe retirar la policy RLS permisiva redundante.");
check(workPerfMigration.includes('erp_supply.current_roles()')&&workPerfMigration.includes('v_roles'),"Migración 099 debe cachear roles de Mi jornada una sola vez.");
check(inventoryFilterMigration.includes("when v_search='' then true")&&inventoryFilterMigration.includes('else erp_supply.material_norm('),"Migración 100 debe diferir la normalización textual cuando no hay búsqueda.");
check(inventoryPlanMigration.includes("where l.inventory_item_id=s.item_id and l.source_active"),"Migración 101 debe construir detalle de lotes solo para el plan seleccionado.");
check(responsive.includes("pendingScopes")&&responsive.includes("queueScope(node)"),"Responsive foundation debe procesar únicamente UI dinámica afectada.");
check(!responsive.includes('normalize(document.querySelector("#app")||document)'),"Responsive foundation no debe reescanear #app en cada mutación.");
check(popupUx.includes("pendingModals")&&popupUx.includes('document.querySelector("#modal-root")||document.body'),"Popup UX debe observar el modal-root y procesar solo modales afectados.");
check(!popupUx.includes('requestAnimationFrame(()=>{\n    scheduled=false;\n    enhanceAll();'),"Popup UX no debe reescanear todos los modales en cada mutación.");

// Accounting/security invariants remain untouched.
for(const token of [
  "erp_supply.inventory_count_reports",
  "erp_x_inventory_count_submit",
  "erp_x_inventory_count_review",
  "erp_x_inventory_count_center",
  "inventory_count_is_blind_operator",
  "drop function if exists public.erp_x_inventory_cycle_count",
  "drop function if exists public.erp_x_inventory_cycle_control"
])check(inventoryMigration.includes(token),`Migración 095 incompleta: falta ${token}.`);
check(inventoryMigration.includes("Vista de existencias restringida durante el conteo ciego"),"Falta el bloqueo de existencias para el auxiliar.");
check(expressMigration.includes("erp_x_inventory_express_reports")&&expressMigration.includes("erp_supply.has_role('super_admin')"),"Migración 096 perdió la revisión exprés exclusiva.");
check(scheduleMigration.includes("inventory_count_schedule_core")&&scheduleMigration.includes("remainingToday")&&scheduleMigration.includes("countedToday"),"Migración 097 perdió el avance real de jornada.");

// Single-owner Inventory architecture.
const requiredInventory=[
  "assets/js/modules/inventory.js",
  "assets/js/modules/inventory-ui-v11240.js",
  "assets/js/modules/inventory-dialogs-v11260.js",
  "assets/js/modules/inventory-home-v11250.js",
  "assets/js/modules/inventory-operator-v11250.js",
  "assets/js/modules/inventory-plan-v11250.js",
  "assets/js/modules/inventory-review-v11250.js",
  "assets/js/modules/inventory-stock-v11250.js",
  "assets/js/modules/inventory-ledger-v11250.js",
  "assets/js/modules/inventory-control-v11250.js",
  "assets/js/modules/inventory-export-v11250.js",
  "assets/js/services/inventory.js"
];
for(const file of requiredInventory)check(exists(file),`Falta propietario vigente de Inventario: ${file}`);
const retiredInventory=[
  "assets/js/modules/inventory-modal-v11253.js",
  "assets/js/modules/inventory-modal-workspace-v11254.js",
  "assets/js/modules/inventory-control-v11230.js",
  "assets/js/modules/inventory-operator-v11230.js",
  "assets/js/modules/inventory-plan-v11232.js",
  "assets/js/modules/inventory-review-v11230.js",
  "assets/js/modules/inventory-stock-v11230.js",
  "assets/js/modules/inventory-cycle-v11220.js",
  "assets/js/modules/inventory-control-v11220.js",
  "assets/js/modules/inventory-stock.js"
];
for(const file of retiredInventory)check(!exists(file),`Inventario conserva propietario histórico retirado: ${file}`);

// Functional Inventory contract.
check(inventory.includes('inventoryCountCenter')&&inventory.includes('access.operator')&&inventory.includes('access.controller'),"Inventario debe gobernarse por capacidades del servidor.");
for(const view of ["home","capture","express","count","labels","plan","review","history","stock","ledger","control"])check(inventory.includes(`\"${view}\"`),`Falta vista de Inventario: ${view}`);
check(inventory.includes('express-review'),"Super Admin perdió Revisión exprés.");
check(inventory.includes('inventory-nav-v11251')&&inventory.includes('Control y auditoría')&&inventory.includes('inventory-nav-groups-v11251'),"Inventario perdió la navegación agrupada.");
check(inventory.includes('overflow-wrap:anywhere')&&inventory.includes('@media(max-width:760px)')&&inventory.includes('@media(max-width:480px)'),"Inventario perdió defensas responsive contra desbordes.");
check(home.includes("Conteo no programado")&&home.includes("Etiquetas y stickers")&&home.includes("Movimientos"),"Inicio no expone las funciones críticas.");
check(operator.includes("REGISTRAR CONTEO")&&operator.includes("Conteo exprés")&&operator.includes("Metraje")&&operator.includes("Imprimir jornada")&&operator.includes("Exportar CSV"),"Captura perdió conteo, exprés, metraje o stickers.");
check(operator.includes("inventoryCountSubmit")&&operator.includes("inventoryCountResolve")&&operator.includes("inventoryCountSearch"),"Captura no usa los contratos seguros de conteo.");
check(plan.includes("PARETO ADAPTATIVO")&&plan.includes("Exportar CSV")&&plan.includes("businessScore"),"Plan perdió Pareto o exportación.");
check(review.includes("Aprobar y aplicar")&&review.includes("Solicitar reconteo")&&review.includes("Exportar CSV")&&review.includes("ALL"),"Revisión/Historial perdió decisiones o exportación.");
check(review.includes('inventory-audit-card-v11251')&&review.includes('inventory-audit-filter-v11251')&&review.includes('inventory-audit-tabs-v11251'),"Revisión/Exprés/Historial perdió su composición de auditoría.");
check(review.includes('inventory-comparison-row-v11251')&&review.includes('Reservado')&&review.includes('Bloqueado')&&review.includes('Diferencia / impacto'),"Detalle de revisión perdió comparación física estructurada.");
check(!review.includes('inventoryEnterpriseRow'),"Revisión volvió a usar la fila genérica que causaba desbordes.");
check(stock.includes("Actualizar Siesa")&&stock.includes("Exportar CSV")&&stock.includes("inventoryMovements"),"Existencias perdió sincronización, exportación o trazabilidad.");
check(ledger.includes("KARDEX")&&ledger.includes("inventoryMovements")&&ledger.includes("Exportar CSV"),"Movimientos no implementa kardex exportable.");
check(control.includes("PARETO ADAPTATIVO")&&control.includes("Exportar análisis"),"Inteligencia perdió Pareto o exportación.");
check(exportsModule.includes("downloadCsv")&&exportsModule.includes("URL.createObjectURL"),"Falta utilidad de exportación CSV.");
check(ui.includes("v115-goods-row")&&ui.includes("bindListFilter"),"Falta el sistema visual WMS común.");
check(ui.includes('inventory-enterprise-row-v11252')&&ui.includes('has-actions')&&ui.includes('no-actions'),"Inventario perdió el contrato de filas con/sin acciones.");
check(ui.includes('const actionsHtml=hasActions?')&&ui.includes('const hasActions=Boolean(actionHtml)'),"inventoryEnterpriseRow volvió a reservar una zona de acción sin comprobar contenido.");
check(!ui.includes('<div class="page-actions">${actions}</div>'),"inventoryEnterpriseRow conserva el contenedor de acciones incondicional histórico.");
check(ui.includes('no-controls')&&ui.includes('Sin distribución Pareto'),"La auditoría de contenedores vacíos perdió toolbar o Pareto defensivo.");
check(service.includes("erp_x_inventory_count_submit")&&service.includes("erp_x_inventory_count_review")&&service.includes("erp_x_inventory_express_reports"),"El servicio de Inventario perdió contratos contables.");
check(!service.includes("erp_x_inventory_cycle_count"),"El servicio aún referencia conteo directo V11.22.");

// Guided-dialog UX contract.
for(const token of [
  "inventory-dialog-v11260",
  "inventory-dialog-guide-v11260",
  "inventory-dialog-count-v11260",
  "inventory-dialog-review-v11260",
  "inventory-dialog-stock-v11260",
  "inventory-dialog-plan-v11260",
  "inventory-dialog-scanner-v11260",
  "inventory-dialog-labels-v11260",
  "inventory-dialog-identified-v11260",
  "inventory-dialog-sync-v11260",
  "MutationObserver",
  "#modal-root",
  "state.currentModule"
])check(inventoryDialogs.includes(token),`Sistema de diálogos guiados incompleto: falta ${token}.`);
for(const width of ["1120px","1040px","1000px","960px","940px","820px","720px"])check(inventoryDialogs.includes(`--inventory-dialog-width:${width}`),`Falta ancho contenido: ${width}.`);
check(inventoryDialogs.includes('calc(100vw - 96px)'),"Desktop debe conservar margen lateral visible.");
check(!inventoryDialogs.includes('width:min(86vw')&&!inventoryDialogs.includes('width:min(88vw')&&!inventoryDialogs.includes('width:min(94vw'),"Inventario volvió a geometrías casi full-screen en escritorio.");
check(inventoryDialogs.includes('min-height:48px')&&inventoryDialogs.includes('font-size:16px')&&inventoryDialogs.includes('width:46px')&&inventoryDialogs.includes('height:46px'),"Controles o acciones ya no cumplen accesibilidad táctil/visual.");
check(inventoryDialogs.includes('Qué debes hacer')&&inventoryDialogs.includes('Confirma la referencia')&&inventoryDialogs.includes('Escribe la cantidad física'),"Falta guía de operación simple en los diálogos.");
check(inventoryDialogs.includes('grid-template-columns:repeat(3,minmax(0,1fr))'),"Revisión debe agrupar comparación por lote en tres columnas legibles.");
check(inventoryDialogs.includes('@media(max-width:820px)')&&inventoryDialogs.includes('@media(max-width:620px)'),"Faltan breakpoints de tablet/móvil.");
check(inventoryDialogs.includes('simplifyFooter')&&inventoryDialogs.includes('single-action-v11260'),"Los diálogos informativos deben evitar Cancelar + Cerrar duplicados.");

// Delivery architecture.
const workflows=walk(path.join(root,".github/workflows")).filter(file=>/\.ya?ml$/i.test(file)).map(rel);
check(workflows.length===1&&workflows[0]===".github/workflows/validate-crm.yml","Debe existir una sola CI canónica.");
check(vercel.includes('"main": true')&&vercel.includes('"*": false'),"Vercel debe desplegar automáticamente solo main.");
check(exists(".vercelignore"),"Falta .vercelignore.");
check(main.includes('installPacoAssistant();')&&main.includes('initRouter('),"main.js perdió el arranque principal.");

if(failures.length){
  console.error(`VALIDACIÓN CRM ${version||"SIN VERSIÓN"} FALLÓ`);
  failures.forEach(item=>console.error(`- ${item}`));
  process.exit(1);
}
console.log(`VALIDACIÓN CRM ${version} CORRECTA`);
console.log(`- Build ${build}`);
console.log(`- ${jsFiles.length} archivos JavaScript bajo un único app-entry.`);
console.log("- Inventario conserva captura, exprés, metraje, stickers, revisión, historial, existencias, kardex e inteligencia.");
console.log("- V11.27.0 conserva un solo sistema de diálogos guiados y la capa visual premium.");
console.log("- Observers responsive y popup procesan únicamente el ámbito dinámico afectado.");
console.log("- PWA, Vercel, RLS y hotpaths SQL quedan incorporados al contrato canónico.");
console.log("- Conteo ciego, RLS granular y aprobación contable permanecen como contratos obligatorios.");