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
const inventoryWorkspaceCss=read("assets/runtime-css/inventory-workspace-v11251.css");
const inventoryDialogsCss=read("assets/runtime-css/inventory-dialogs-v11260.css");
const inventoryContract=inventory+"\n"+inventoryWorkspaceCss;
const inventoryDialogsContract=inventoryDialogs+"\n"+inventoryDialogsCss;
const responsive=read("assets/js/modules/responsive-foundation-v11190.js");
const popupUx=read("assets/js/modules/popup-ux-v1190.js");
const inventoryMigration=read("supabase/migrations/095_inventory_accounting_blind_count_v11_23_0.sql");
const expressMigration=read("supabase/migrations/096_inventory_express_super_admin_review_v11_23_1.sql");
const scheduleMigration=read("supabase/migrations/097_restore_inventory_control_plan_v11_23_2.sql");
const rlsAuditMigration=read("supabase/migrations/098_profiles_rls_scope_v11_27_0.sql");
const workPerfMigration=read("supabase/migrations/099_work_my_day_role_cache_v11_27_0.sql");
const inventoryFilterMigration=read("supabase/migrations/100_inventory_filtered_hotpath_v11_27_0.sql");
const inventoryPlanMigration=read("supabase/migrations/101_inventory_count_plan_hotpath_v11_27_0.sql");
const securityDefinerMigration=read("supabase/migrations/110_security_definer_contract_v11_30_1.sql");
const securityDefinerFixMigration=read("supabase/migrations/111_security_definer_contract_regex_fix_v11_30_1.sql");
const deliverySatisfactionMigration=read("supabase/migrations/112_delivery_satisfaction_distance_v11_31_0.sql");
const deliverySatisfactionIndexMigration=read("supabase/migrations/113_delivery_satisfaction_fk_indexes_v11_31_0.sql");
const hardeningMigration=read("supabase/migrations/114_impersonation_metrics_security_v11_32_0.sql");
const workforcePlannerMigration=read("supabase/migrations/115_workforce_planner_calendar_v11_33_0.sql");
const workforceTodayMigration=read("supabase/migrations/116_workforce_my_day_automation_v11_34_0.sql");
const workforceManagerMigration=read("supabase/migrations/117_workforce_manager_review_v11_34_1.sql");
const workforceCatalogMigration=read("supabase/migrations/118_workforce_catalog_taxonomy_v11_34_3.sql");
const workforceTimelineMigration=read("supabase/migrations/119_workforce_timeline_evidence_v11_35_0.sql");
const workforceCalendarMigration=read("supabase/migrations/120_workforce_calendar_feed_v11_36_0.sql");
const workforce=read("assets/js/modules/workforce.js");
const workforcePlanner=read("assets/js/modules/workforce-planner-v11330.js");
const workforceToday=read("assets/js/modules/workforce-today-v11340.js");
const workforceManager=read("assets/js/modules/workforce-time-review-v11340.js");
const workforceCatalog=read("assets/js/modules/workforce-catalog-v11343.js");
const workforceExperience=read("assets/js/modules/workforce-experience-v11344.js");
const workforceExperienceCss=read("assets/runtime-css/workforce-experience-v11344.css");
const workforceTimeline=read("assets/js/modules/workforce-timeline-v11350.js");
const workforceTimelineCss=read("assets/runtime-css/workforce-timeline-v11350.css");
const workforceEvidenceManager=read("assets/js/modules/workforce-evidence-manager-v11360.js");
const workforceCalendar=read("assets/js/modules/workforce-calendar-v11360.js");
const workforceCalendarCss=read("assets/runtime-css/workforce-calendar-v11360.css");
const approvalsModule=read("assets/js/modules/approvals.js");
const operational=read("assets/js/modules/operational-v112.js");
const coreUi=read("assets/js/core/ui.js");
const adminWrapper=read("assets/js/modules/admin.js");
const adminVerification=read("assets/js/modules/admin-user-verification-v11320.js");
const supabaseConfig=read("supabase/config.toml");
const workflow=read(".github/workflows/validate-crm.yml");
const shippingFlow=read("assets/js/modules/shipping-flow.js");
const sentOrders=read("assets/js/modules/sent-orders.js");
const api=read("assets/js/services/api.js");
const reportsEnterprise=read("assets/js/modules/reports-enterprise-v11140.js");
const analyticsCss=read("assets/css/analytics.css");
const operationsCss=read("assets/css/operations.css");
const coreCss=read("assets/css/core-shell.css");
const experienceCss=read("assets/css/experience.css");
const jsFiles=walk(path.join(root,"assets/js")).filter(file=>file.endsWith(".js"));
const jsRuntime=jsFiles.map(file=>fs.readFileSync(file,"utf8")).join("\n");
const normalizedJsRuntime=jsRuntime
  .replace(/\bArray\s*\.\s*from\s*\(/g,"Array_from(")
  .replace(/\bObject\s*\.\s*fromEntries\s*\(/g,"Object_fromEntries(");

// Release identity.
check(version==="11.36.5","CONFIG.version debe ser 11.36.5.");
check(build==="2026-09-24.20","CONFIG.build debe ser 2026-09-24.20.");
check(pkg.version===version,"package.json y CONFIG.version deben coincidir.");
check(pkgLock.version===version&&pkgLock.packages?.[""]?.version===version,"package-lock.json debe coincidir con la versión vigente.");
check(index.includes(`app-entry.js?v=${version}`),"index.html debe cargar el entrypoint de la versión vigente.");
check(config.includes("https://script.google.com/macros/s/AKfycbwjl1JCfE0eV92P6DCn6h8jIVIBlSwLOQj8U7Mz1_7YW2Xan8DPI5tpWJuiG7znSCSs/exec"),"CONFIG.drive.bridgeUrl debe apuntar a la implementación Apps Script 3.5.1 vigente.");
check((index.match(/<script\s+type="module"\s+src="\.\/assets\/js\//g)||[]).length===1,"index.html debe tener un único entrypoint ES Module local.");
check(entry.includes('import "./main.js";'),"app-entry.js debe delegar a main.js.");
check(exists("assets/js/modules/workforce-timeline-v11350.js"),"Falta módulo timeline V11.35.0.");
check(exists("assets/runtime-css/workforce-timeline-v11350.css"),"Falta CSS timeline V11.35.0.");
check(sw.includes("./assets/js/modules/workforce-timeline-v11350.js"),"PWA debe precachear el módulo timeline.");
check(sw.includes("./assets/runtime-css/workforce-timeline-v11350.css"),"PWA debe precachear el CSS timeline.");
check(workforce.includes("composePlannerTimeline")&&workforce.includes("renderWorkforceCalendarBoard")&&workforce.includes("bindWorkforceCalendar"),"Workforce debe delegar el cronograma al motor V11.36.0.");
check(workforce.includes("work-indicator-hero-v11363")&&workforce.includes("analyticsBalance(summary)"),"Indicadores Workforce V11.36.4 incompletos.");
check(analyticsCss.includes("work-indicator-metrics-v11363")&&analyticsCss.includes("work-indicator-team-v11363"),"CSS Indicadores Workforce V11.36.4 incompleto.");
check(workforceTimelineMigration.includes("erp_x_work_planner_detail")&&workforceTimelineMigration.includes("erp_x_work_evidence_preview_allowed"),"Migración V11.35.0 incompleta.");
check(!/create\\s+table/i.test(workforceTimelineMigration)&&!/create\\s+(unique\\s+)?index/i.test(workforceTimelineMigration),"V11.35.0 no debe crear tablas ni índices redundantes.");
check(workforceTimeline.includes("loadPreview")&&workforceTimelineCss.includes("work-timeline-sheet-v11350"),"Tarjeta timeline/evidencia bajo demanda incompleta.");
check(exists("assets/js/modules/workforce-calendar-v11360.js"),"Falta motor calendario V11.36.0.");
check(exists("assets/js/modules/workforce-evidence-manager-v11360.js"),"Falta gestor evidencia V11.36.0.");
check(exists("assets/runtime-css/workforce-calendar-v11360.css"),"Falta CSS calendario V11.36.0.");
check(sw.includes("./assets/js/modules/workforce-calendar-v11360.js"),"PWA debe precachear motor calendario V11.36.0.");
check(sw.includes("./assets/js/modules/workforce-evidence-manager-v11360.js"),"PWA debe precachear gestor evidencia V11.36.0.");
check(sw.includes("./assets/runtime-css/workforce-calendar-v11360.css"),"PWA debe precachear CSS calendario V11.36.0.");
check(workforceCalendarMigration.includes('"previewEvidenceId"')&&workforceCalendarMigration.includes('"previewDriveFileId"'),"Feed V11.36.0 debe entregar referencias mínimas de preview.");
check(!/create\\s+table/i.test(workforceCalendarMigration)&&!/create\\s+(unique\\s+)?index/i.test(workforceCalendarMigration),"V11.36.0 no debe crear tablas ni índices.");
check(workforceEvidenceManager.includes("createWorkEvidenceManager")&&workforceEvidenceManager.includes("maxBytes"),"Gestor de evidencia debe centralizar caché acotada por memoria.");
check(workforceCalendar.includes("IntersectionObserver")&&workforceCalendarCss.includes("work-calendar-event-title-v11360"),"Motor de cronograma visual incompleto.");
check(entry.includes('import "./modules/inventory-dialogs-v11260.js";'),"app-entry.js debe instalar el sistema único de diálogos guiados de Inventario.");
check(entry.includes('import "./modules/inventory-visual-v11270.js";'),"app-entry.js debe instalar la capa visual vigente de Inventario.");
check(!entry.includes("inventory-modal-v11253.js")&&!entry.includes("inventory-modal-workspace-v11254.js"),"app-entry.js no debe cargar propietarios modales históricos.");

// Canonical CSS architecture.
const canonicalCss=["assets/css/core-shell.css","assets/css/operations.css","assets/css/analytics.css","assets/css/experience.css"];
const cssRefs=[...index.matchAll(/href="\.\/([^"?#]+)(?:\?v=([^"#]+))?"/g)].filter(m=>m[1].endsWith(".css"));
check(cssRefs.length===4,"index.html debe cargar exactamente cuatro familias CSS canónicas.");
check(JSON.stringify(cssRefs.map(m=>m[1]))===JSON.stringify(canonicalCss),"El orden CSS canónico es inválido.");
check(cssRefs.every(m=>m[2]===version),"Todas las familias CSS deben usar la versión vigente.");
for(const cssPath of canonicalCss)check(exists(cssPath),`Falta CSS canónico: ${cssPath}`);
const runtimeCss=[
  "assets/runtime-css/guides-layout-v11291.css",
  "assets/runtime-css/receiving-workspace-v11290.css",
  "assets/runtime-css/inventory-dialogs-v11260.css",
  "assets/runtime-css/inventory-visual-v11270.css",
  "assets/runtime-css/inventory-ui-v11240.css",
  "assets/runtime-css/inventory-workspace-v11251.css"
];
for(const cssPath of runtimeCss){
  check(exists(cssPath),`Falta CSS runtime externalizado: ${cssPath}`);
  check(sw.includes("./"+cssPath),`PWA debe precachear ${cssPath}`);
}
check(walk(path.join(root,"assets/css")).filter(file=>file.endsWith(".css")).map(rel).every(file=>canonicalCss.includes(file)),"assets/css conserva una familia no canónica.");
check((coreCss.match(/:root\{/g)||[]).length===1,"core-shell.css debe conservar una sola raíz de tokens.");
check(coreCss.includes('font-family:"Century Gothic"'),"Falta tipografía institucional.");
check(experienceCss.includes('.paco2-panel{display:none!important}'),"Se perdió el contrato visual de Paco.");

// PWA and Vercel routing.
check(sw.includes('// previous-cache: crm-suministros-v11-36-4-20260923-19'),"previous-cache PWA debe apuntar a V11.36.4.");
check(sw.includes('const CACHE="crm-suministros-v11-36-5-20260924-20";'),"CACHE activo PWA no corresponde a V11.36.5.");
check(sw.includes('caches.match(event.request,{ignoreSearch:true})'),"PWA debe resolver assets versionados.");
check(index.includes('<link rel="manifest" href="./manifest.webmanifest">'),"index.html debe declarar el manifest PWA.");
check(vercel.includes('manifest\\\\.webmanifest')||vercel.includes('/manifest.webmanifest'),"Vercel debe excluir o tratar explícitamente el manifest real.");
check(vercel.includes('/service-worker.js')&&vercel.includes('no-cache, no-store, must-revalidate'),"Service worker debe revalidarse en cada release.");
check(!/style-src(?!-)[^;]*'unsafe-inline'/i.test(vercel),"CSP no debe permitir unsafe-inline en style-src general.");
check(/style-src-attr[^;]*'unsafe-inline'/i.test(vercel),"La excepción temporal debe limitarse a style-src-attr.");

// Browser/backend boundaries.
const bannedRuntime=/\b(QA_BOT|erp_x_qa_|erp_x_run_qa_|erp_x_sandbox_|sandboxMode|manualSandbox|TEST-QA-|erp-e2e-bot)\b/i;
check(!bannedRuntime.test(jsRuntime),"El frontend productivo conserva referencias QA/Sandbox.");
check(!/\.from\s*\(/.test(normalizedJsRuntime),"El navegador no debe acceder a tablas directamente; use RPC.");

// Workforce V11.34.5.
check(workforcePlanner.includes('plannerRangeForMode')&&workforcePlanner.includes('businessDaysForRange'),"Cronograma debe separar lógica laboral del módulo principal.");
check(workforcePlannerMigration.includes("'calendar'")&&workforcePlannerMigration.includes("activeStatus"),"RPC planner debe devolver calendario y estado activo en una sola respuesta.");
check(workforcePlannerMigration.includes("validate_work_assignment_business_window")&&workforcePlannerMigration.includes("OUTSIDE_WORKING_TIME"),"Base debe bloquear asignaciones fuera de jornada.");
check(coreCss.includes(".work-day-timeline-head")&&coreCss.includes(".work-week-grid-v11330")&&coreCss.includes(".work-month-grid-v11330"),"Falta capa visual Día/Semana/Mes del cronograma.");
check(workforceToday.includes("timeTrafficLight")&&workforceToday.includes("finalEvidenceType"),"Mi jornada debe separar semáforo y evidencia final en un módulo dedicado.");
check(workforce.includes("workday-guide")&&workforce.includes("catalogBrowserHtml")&&workforce.includes("work-active-console"),"Mi jornada V11.34.5 debe componer jerarquía segura y cronómetro legible.");
check(workforceCatalog.includes("catalogTaxonomy")&&workforceCatalog.includes("data-work-start-confirmed"),"Falta contrato de selección categoría → subcategoría → actividad.");
check(workforceCatalogMigration.includes('"uiCategoryLabel"')&&workforceCatalogMigration.includes('"uiSubcategory"'),"Migración 118 debe exponer taxonomía UI ligera.");
check(!workforce.includes("data-start-catalog"),"Mi jornada no debe reintroducir inicio directo por clic/touch.");
check(workforce.includes("workday-traffic-legend")&&workforce.includes("Más de 60 min · genera alerta"),"Mi jornada debe explicar el semáforo antes y durante la ejecución.");
check(workforce.includes("workday-no-schedule")&&!workforce.includes("workday-layout"),"Mi jornada debe evitar tarjetas vacías grandes y layouts estrechos heredados.");
check(workforceExperience.includes("ensureWorkforceExperienceStyles")&&workforceExperienceCss.includes("#workforce-content .btn{min-height:52px"),"Workforce debe tener una capa visual aislada con touch targets accesibles.");
check(workforceExperienceCss.includes(".work-catalog-choice-copy strong{font-size:16px")&&workforceExperienceCss.includes(".work-start-confirm-actions .btn{min-height:56px"),"Catálogo debe conservar tipografía y botones legibles para todas las edades.");
check(!coreCss.includes("V11.34.2 · Mi jornada visual")&&!coreCss.includes("V11.34.3 · Mi jornada jerárquica"),"core-shell no debe conservar implementaciones visuales duplicadas de Mi jornada.");
check(!exists("assets/js/modules/activity-browser-v113.js"),"El navegador legado activity-browser-v113.js debe permanecer eliminado.");
check(!read("assets/js/modules/bootstrap-v113.js").includes("activity-browser-v113"),"Bootstrap no debe volver a instalar el navegador legado de Jornada.");
check(!read("assets/css/operations.css").includes("workforce-quick-card")&&!read("assets/css/operations.css").includes("work-catalog-item")&&!read("assets/css/operations.css").includes("Desliza para explorar"),"operations.css no debe conservar el catálogo horizontal legado de Jornada.");
check(approvalsModule.includes('data-mode="WORKFORCE"')&&approvalsModule.includes("workforce-alert-banner")&&approvalsModule.includes("openWorkforceTimeReview"),"Excepciones debe mostrar alertas rojas de jornada y permitir revisarlas.");
check(!operational.includes("workManagerQueue")&&!operational.includes("openTimeReviewDialog"),"La revisión de tiempos no debe estar duplicada dentro de Mi jornada.");
check(workflow.includes("cancel-in-progress: true")&&workflow.includes("group: crm-suministros-github-pages"),"GitHub Actions debe impedir carreras de despliegue en Pages.");
check(workforceTodayMigration.includes("timeReviewRequired")&&workforceTodayMigration.includes("3600")&&workforceTodayMigration.includes("PHOTO_REQUIRED"),"Migración 116 debe automatizar revisión por tiempo y foto obligatoria.");
check(api.includes("workReviewTime")&&api.includes("erp_x_work_review_time"),"API frontend debe exponer la resolución de tiempos pendientes de revisión.");
check(workforceTodayMigration.includes("erp_x_work_review_time")&&workforceTodayMigration.includes("TIME_REVIEWED"),"Migración 116 debe permitir cerrar la revisión de tiempos con trazabilidad.");
check(workforceTodayMigration.includes("catálogo operativo liviano")&&workforceTodayMigration.includes("erp_x_work_catalog"),"Mi jornada debe evitar percentiles históricos en el catálogo operativo.");
check(coreCss.includes(".work-time-traffic")&&coreCss.includes(".work-photo-required"),"Falta capa visual de semáforo y cierre fotográfico.");
check(workforceManager.includes("timeReviewCardHtml")&&workforceManager.includes("recentTimeReviewHtml"),"Falta módulo de revisión gerencial de tiempos.");
check(workforceManagerMigration.includes("erp_x_work_manager_queue")&&workforceManagerMigration.includes("erp_x_work_review_time"),"Migración 117 debe exponer cola y cierre de revisión.");
check(workforceManagerMigration.includes("approvalRequired',false")&&workforceManagerMigration.includes("'MANUAL'"),"Mi jornada debe iniciar directamente sin aprobación previa.");
check(!workforceManagerMigration.includes("erp_x_work_quick_request")&&!workforceManagerMigration.includes("assignmentApprovals"),"No debe persistir el flujo de aprobación previa para Mi jornada.");
check(!operational.includes("data-v112-approval")&&!operational.includes("workPendingApprovals")&&!operational.includes("workQuickRequest"),"Frontend operativo no debe reintroducir aprobaciones previas.");
check(api.includes("workManagerQueue")&&api.includes("erp_x_work_manager_queue")&&api.includes("workReviewTime"),"API debe exponer únicamente la revisión posterior necesaria.");
check(coreCss.includes(".work-time-review-card")&&coreCss.includes(".work-time-review-recent"),"Falta capa visual de revisión gerencial.");

// Security/performance audit corrections.
check(rlsAuditMigration.includes('drop policy if exists erp_active_read on public.profiles'),"Migración 098 debe retirar la policy RLS permisiva redundante.");
check(workPerfMigration.includes('erp_supply.current_roles()')&&workPerfMigration.includes('v_roles'),"Migración 099 debe cachear roles de Mi jornada una sola vez.");
check(inventoryFilterMigration.includes("when v_search='' then true")&&inventoryFilterMigration.includes('else erp_supply.material_norm('),"Migración 100 debe diferir la normalización textual cuando no hay búsqueda.");
check(inventoryPlanMigration.includes("where l.inventory_item_id=s.item_id and l.source_active"),"Migración 101 debe construir detalle de lotes solo para el plan seleccionado.");
check(securityDefinerMigration.includes("erp_x_security_definer_contract_check")&&securityDefinerMigration.includes("from public,anon,authenticated")&&securityDefinerMigration.includes("grant execute on function public.erp_x_security_definer_contract_check() to service_role"),"Migración 110 debe crear el health contract SECURITY DEFINER como service-role-only.");
check(securityDefinerFixMigration.includes("auth[.]uid[(][)]")&&securityDefinerFixMigration.includes("erp_x_security_definer_contract_check"),"Migración 111 debe conservar el detector corregido de auth.uid().");
check(deliverySatisfactionMigration.includes("erp_x_shipping_confirm_satisfaction")&&deliverySatisfactionMigration.includes("distance_km")&&deliverySatisfactionMigration.includes("satisfaction_confirmed_at"),"Migración 112 debe instalar distancia y satisfacción post-entrega.");
check(deliverySatisfactionMigration.includes("DELIVERED_SATISFIED")&&deliverySatisfactionMigration.includes("postDeliveryConfirmationSeconds"),"Migración 112 debe conservar milestone y métricas post-entrega.");
check(deliverySatisfactionMigration.includes("revoke all on function public.erp_x_shipping_confirm_satisfaction")&&deliverySatisfactionMigration.includes("grant execute on function public.erp_x_shipping_confirm_satisfaction"),"RPC de satisfacción debe tener frontera de permisos explícita.");
check(api.includes("confirmShippingSatisfaction")&&api.includes("erp_x_shipping_confirm_satisfaction"),"API frontend debe exponer confirmación de satisfacción.");
check(shippingFlow.includes("Entregado con satisfacción")&&shippingFlow.includes("Distancia recorrida (km)")&&shippingFlow.includes("distanceSource"),"Shipping flow debe capturar satisfacción, distancia y fuente.");
check(sentOrders.includes("data-satisfaction")&&sentOrders.includes("distanceText")&&sentOrders.includes("satisfactionConfirmedAt"),"Pedidos enviados debe mostrar y permitir confirmar satisfacción.");
check(deliverySatisfactionMigration.includes("reports_delivery_explore_v1131")&&deliverySatisfactionMigration.includes("reports_delivery_export_v1131"),"Migración 112 debe integrar Entregas con Analítica y exportación.");
check(deliverySatisfactionIndexMigration.includes("distance_recorded_by")&&deliverySatisfactionIndexMigration.includes("satisfaction_confirmed_by"),"Migración 113 debe cubrir las FKs de actores post-entrega.");
check(deliverySatisfactionIndexMigration.includes("drop index if exists erp_supply.idx_deliveries_satisfaction_confirmed_v1131"),"Migración 113 debe retirar el índice temporal de satisfacción sin hot path.");
check(reportsEnterprise.includes("distance_km")&&reportsEnterprise.includes("avg_distance_km")&&reportsEnterprise.includes("avg_satisfaction_hours"),"Analítica debe exponer distancia y satisfacción del dataset Entregas.");
check(hardeningMigration.includes("admin_impersonation_sessions")&&hardeningMigration.includes("originalActorProfileId")&&hardeningMigration.includes("effectiveActorProfileId"),"Migración 114 debe conservar trazabilidad de impersonación con actor original y efectivo.");
check(hardeningMigration.includes("erp_x_auditoria_erp_metrics_user")&&hardeningMigration.includes("wr.organization_id=v_org"),"Migración 114 debe limitar métricas de integración a la organización autenticada.");
check(/\[functions\.erp-auditoria-metrics\][\s\S]*?verify_jwt\s*=\s*true/.test(supabaseConfig),"erp-auditoria-metrics debe exigir JWT en supabase/config.toml.");
check(coreUi.includes("export function sanitizeHtml")&&coreUi.includes("BLOCKED_HTML_TAGS")&&coreUi.includes("UNSAFE_URL"),"core/ui.js debe mantener la barrera central XSS.");
check(adminWrapper.includes("admin-user-verification-v11320.js")&&adminVerification.includes("impersonation_session"),"Administración debe mantener la verificación de usuario separada y trazable.");
check(workflow.includes("authenticated shell, critical modules and native API")&&workflow.includes("ERP_QA_EMAIL")&&workflow.includes("ERP_QA_PASSWORD"),"CI debe ejecutar el E2E autenticado como gate obligatorio.");
check(workflow.includes("github/codeql-action/init@v4")&&workflow.includes("actions/dependency-review-action@v5")&&workflow.includes("trufflesecurity/trufflehog@v3.97.5"),"CI debe conservar CodeQL, Dependency Review y TruffleHog.");
check(exists("supabase/production-migration-ledger.json")&&exists("scripts/migration-ledger-check.mjs")&&exists("docs/DISASTER_RECOVERY.md"),"Falta el contrato de procedencia/DR de migraciones V11.32.0.");

check(!analyticsCss.includes(".btn-danger,.btn.danger{"),"analytics.css no debe sobrescribir globalmente los botones danger.");
check(analyticsCss.includes(".admin-shell-v11160 .btn-danger,.admin-shell-v11160 .btn.danger{"),"Los estilos danger de Administración deben permanecer encapsulados.");
check(operationsCss.includes(".modal.popup-ux-v1190:not(.full):not(.split):not(.wizard-modal){width:min(680px,100%)}"),"El ancho base de popups comunes debe conservarse en 680px.");
check(operationsCss.includes("#modal-root .modal.popup-ux-v1190.simple-process-modal.wide")&&operationsCss.includes("width:min(1120px,calc(100vw - 80px))!important"),"Gestión rápida debe usar el ancho desktop V11.31.2 sin afectar otros popups.");
check(operationsCss.includes(".simple-process-head .wizard-kicker")&&operationsCss.includes("color:#0b65c7!important"),"Gestión rápida debe mostrar el kicker en azul.");
check(operationsCss.includes(".simple-process-head h3")&&operationsCss.includes("color:#0a4f91!important"),"Gestión rápida debe mostrar el número de pedido en azul.");
check(operationsCss.includes(".simple-process-head p")&&operationsCss.includes("color:#416e99!important"),"Gestión rápida debe mostrar cliente/etapa en azul legible.");
check(operationsCss.includes("grid-template-columns:repeat(5,minmax(0,1fr))!important"),"Gestión rápida debe aprovechar el ancho con cinco estados en desktop.");
check(exists(".gitignore")&&exists(".env.example"),"Faltan controles base .gitignore/.env.example.");
check(exists("scripts/git-history-security-check.mjs"),"Falta el scanner de secretos sobre historial Git.");
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
for(const view of ["home","capture","express","count","labels","plan","review","history","stock","ledger","control"])check(inventory.includes(`"${view}"`),`Falta vista de Inventario: ${view}`);
check(inventory.includes('express-review'),"Super Admin perdió Revisión exprés.");
check(inventory.includes('inventory-nav-v11251')&&inventory.includes('Control y auditoría')&&inventory.includes('inventory-nav-groups-v11251'),"Inventario perdió la navegación agrupada.");
check(inventoryContract.includes('overflow-wrap:anywhere')&&inventoryContract.includes('@media(max-width:760px)')&&inventoryContract.includes('@media(max-width:480px)'),"Inventario perdió defensas responsive contra desbordes.");
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
])check(inventoryDialogsContract.includes(token),`Sistema de diálogos guiados incompleto: falta ${token}.`);
for(const width of ["1120px","1040px","1000px","960px","940px","820px","720px"])check(inventoryDialogsContract.includes(`--inventory-dialog-width:${width}`),`Falta ancho contenido: ${width}.`);
check(inventoryDialogsContract.includes('calc(100vw - 96px)'),"Desktop debe conservar margen lateral visible.");
check(!inventoryDialogsContract.includes('width:min(86vw')&&!inventoryDialogsContract.includes('width:min(88vw')&&!inventoryDialogsContract.includes('width:min(94vw'),"Inventario volvió a geometrías casi full-screen en escritorio.");
check(inventoryDialogsContract.includes('min-height:48px')&&inventoryDialogsContract.includes('font-size:16px')&&inventoryDialogsContract.includes('width:46px')&&inventoryDialogsContract.includes('height:46px'),"Controles o acciones ya no cumplen accesibilidad táctil/visual.");
check(inventoryDialogs.includes('Qué debes hacer')&&inventoryDialogs.includes('Confirma la referencia')&&inventoryDialogs.includes('Escribe la cantidad física'),"Falta guía de operación simple en los diálogos.");
check(inventoryDialogsContract.includes('grid-template-columns:repeat(3,minmax(0,1fr))'),"Revisión debe agrupar comparación por lote en tres columnas legibles.");
check(inventoryDialogsContract.includes('@media(max-width:820px)')&&inventoryDialogsContract.includes('@media(max-width:620px)'),"Faltan breakpoints de tablet/móvil.");
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
console.log("- V11.36.5 integra Filtros en la barra del Cronograma, elimina la fila vacía y corrige el contador 0.");
console.log("- Observers responsive y popup procesan únicamente el ámbito dinámico afectado.");
console.log("- PWA, Vercel, RLS y hotpaths SQL quedan incorporados al contrato canónico.");
console.log("- Conteo ciego, RLS granular y aprobación contable permanecen como contratos obligatorios.");