

export function validateWorkforceBootstrap({ check, exists, entry, sw, workforceTimelineMigration, workforceCalendarMigration, workforce, workforceTimeline, workforceTimelineCss, workforceEvidenceManager, workforceCalendar, workforceCalendarCss }){
  check(entry.includes('import "./main.js";'),"app-entry.js debe delegar a main.js.");
  check(exists("assets/js/domains/workforce/timeline/index.js"),"Falta módulo timeline V11.35.0.");
  check(exists("assets/runtime-css/workforce-timeline-v11350.css"),"Falta CSS timeline V11.35.0.");
  check(sw.includes("./assets/js/domains/workforce/timeline/index.js"),"PWA debe precachear el módulo timeline.");
  check(sw.includes("./assets/runtime-css/workforce-timeline-v11350.css"),"PWA debe precachear el CSS timeline.");
  check(workforce.includes("composePlannerTimeline")&&workforce.includes("renderWorkforceCalendarBoard")&&workforce.includes("bindWorkforceCalendar"),"Workforce debe delegar el cronograma al motor V11.36.0.");
  check(workforce.includes("work-indicator-hero-v11363")&&workforce.includes("analyticsBalance(analytics.summary)"),"Indicadores Workforce V11.36.4 incompletos.");
  check(exists("scripts/workforce-order-automation-v11380-test.mjs"),"Falta contrato V11.38.0 de ocupación automática de pedidos.");
  check(exists("scripts/order-stage-status-v11381-test.mjs"),"Falta contrato V11.38.1 del chip Estado por etapa.");
  check(workforceTimelineMigration.includes("erp_x_work_planner_detail")&&workforceTimelineMigration.includes("erp_x_work_evidence_preview_allowed"),"Migración V11.35.0 incompleta.");
  check(!/create\\s+table/i.test(workforceTimelineMigration)&&!/create\\s+(unique\\s+)?index/i.test(workforceTimelineMigration),"V11.35.0 no debe crear tablas ni índices redundantes.");
  check(workforceTimeline.includes("loadPreview")&&workforceTimelineCss.includes("work-timeline-sheet-v11350"),"Tarjeta timeline/evidencia bajo demanda incompleta.");
  check(exists("assets/js/domains/workforce/calendar/index.js"),"Falta motor calendario V11.36.0.");
  check(exists("assets/js/domains/workforce/evidence/index.js"),"Falta gestor evidencia V11.36.0.");
  check(exists("assets/runtime-css/workforce-calendar-v11360.css"),"Falta CSS calendario V11.36.0.");
  check(sw.includes("./assets/js/domains/workforce/calendar/index.js"),"PWA debe precachear motor calendario V11.36.0.");
  check(sw.includes("./assets/js/domains/workforce/evidence/index.js"),"PWA debe precachear gestor evidencia V11.36.0.");
  check(sw.includes("./assets/runtime-css/workforce-calendar-v11360.css"),"PWA debe precachear CSS calendario V11.36.0.");
  check(exists("assets/js/domains/paco/index.js"),"Falta runtime PACO V11.39.0.");
  check(exists("assets/js/domains/paco/language/index.js"),"Falta motor de lenguaje requerido por PACO V11.39.0.");
  check(workforceCalendarMigration.includes('"previewEvidenceId"')&&workforceCalendarMigration.includes('"previewDriveFileId"'),"Feed V11.36.0 debe entregar referencias mínimas de preview.");
  check(!/create\\s+table/i.test(workforceCalendarMigration)&&!/create\\s+(unique\\s+)?index/i.test(workforceCalendarMigration),"V11.36.0 no debe crear tablas ni índices.");
  check(workforceEvidenceManager.includes("createWorkEvidenceManager")&&workforceEvidenceManager.includes("maxBytes"),"Gestor de evidencia debe centralizar caché acotada por memoria.");
  check(workforceCalendar.includes("IntersectionObserver")&&workforceCalendarCss.includes("work-calendar-event-title-v11360"),"Motor de cronograma visual incompleto.");
  check(entry.includes('import "./modules/inventory-dialogs-v11260.js";'),"app-entry.js debe instalar el sistema único de diálogos guiados de Inventario.");
}
