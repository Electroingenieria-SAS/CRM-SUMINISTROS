

export function validateFrontendSecurity({ check, exists, responsive, popupUx, coreUi, adminWrapper, adminVerification, workflow }){
  check(coreUi.includes("export function sanitizeHtml")&&coreUi.includes("BLOCKED_HTML_TAGS")&&coreUi.includes("UNSAFE_URL"),"core/ui.js debe mantener la barrera central XSS.");
  check(adminWrapper.includes("admin-user-verification-v11320.js")&&adminVerification.includes("impersonation_session"),"Administración debe mantener la verificación de usuario separada y trazable.");
  check(workflow.includes("authenticated shell, critical modules and native API")&&workflow.includes("ERP_QA_EMAIL")&&workflow.includes("ERP_QA_PASSWORD"),"CI debe ejecutar el E2E autenticado como gate obligatorio.");
  check(workflow.includes("github/codeql-action/init@v4")&&workflow.includes("actions/dependency-review-action@v5")&&workflow.includes("trufflesecurity/trufflehog@v3.97.5"),"CI debe conservar CodeQL, Dependency Review y TruffleHog.");
  check(exists("supabase/production-migration-ledger.json")&&exists("scripts/migration-ledger-check.mjs")&&exists("docs/DISASTER_RECOVERY.md"),"Falta el contrato de procedencia/DR de migraciones V11.32.0.");
  check(exists(".gitignore")&&exists(".env.example"),"Faltan controles base .gitignore/.env.example.");
  check(exists("scripts/git-history-security-check.mjs"),"Falta el scanner de secretos sobre historial Git.");
  check(responsive.includes("pendingScopes")&&responsive.includes("queueScope(node)"),"Responsive foundation debe procesar únicamente UI dinámica afectada.");
  check(!responsive.includes('normalize(document.querySelector("#app")||document)'),"Responsive foundation no debe reescanear #app en cada mutación.");
  check(popupUx.includes("pendingModals")&&popupUx.includes('document.querySelector("#modal-root")||document.body'),"Popup UX debe observar el modal-root y procesar solo modales afectados.");
  check(!popupUx.includes('requestAnimationFrame(()=>{\n    scheduled=false;\n    enhanceAll();'),"Popup UX no debe reescanear todos los modales en cada mutación.");
}
