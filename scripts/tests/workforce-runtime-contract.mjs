

export function validateWorkforceRuntime({ check, exists, read, workforcePlannerMigration, workforceTodayMigration, workforceManagerMigration, workforceCatalogMigration, workforce, workforcePlanner, workforceToday, workforceManager, workforceCatalog, workforceExperience, workforceExperienceCss, approvalsModule, operational, workflow, api, operationsCss, coreCss }){
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
  check(!operationsCss.includes("workforce-quick-card")&&!operationsCss.includes("work-catalog-item")&&!read("assets/css/operations.css").includes("Desliza para explorar"),"operations.css no debe conservar el catálogo horizontal legado de Jornada.");
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
}
