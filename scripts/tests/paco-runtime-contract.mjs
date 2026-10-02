

export function validatePacoRuntime({ check, exists, sw, pacoEntry, pacoOperational, pacoLanguage, pacoOperationalCss, pacoMigration }){
  check(exists("scripts/paco-language-v11373-test.mjs"),"Falta corpus de entrenamiento requerido por PACO V11.39.0.");
  check(exists("assets/runtime-css/paco-operational-v11370.css"),"Falta CSS PACO V11.39.0.");
  check(sw.includes("./assets/js/domains/paco/index.js")&&sw.includes("./assets/js/domains/paco/language/index.js")&&sw.includes("./assets/runtime-css/paco-operational-v11370.css"),"PWA debe precachear PACO V11.39.0 y su motor de lenguaje.");
  check(pacoEntry.includes('installPacoAssistant')&&pacoEntry.includes('./controller.js')&&!pacoEntry.includes('GUIDES'),"PACO debe tener una API pública de composición sin implementación duplicada.");
  check(
    pacoOperational.includes('api.pacoSnapshot()')
      &&pacoOperational.includes('MONITOR_MS=60000')
      &&pacoOperational.includes('DIGEST_INTERVAL_MS=30*60*1000')
      &&pacoOperational.includes('IDLE_WARN_SECONDS=20*60')
      &&pacoOperational.includes('api.workStart')
      &&pacoOperational.includes('SpeechSynthesisUtterance')
      &&pacoOperational.includes('buildOperationalDigest')
      &&pacoOperational.includes('testVoice')
      &&pacoOperational.includes('MALE_VOICE_HINTS')
      &&pacoOperational.includes('LATAM_SPANISH')
      &&pacoOperational.includes('data-paco-voice-select')
      &&pacoOperational.includes('detectPacoIntent')
      &&pacoOperational.includes('compatibilitySnapshot')
      &&pacoOperational.includes('snapshotRpcUnavailableUntil')
      &&pacoOperational.includes('cancelFlowMessage')
      &&pacoOperational.includes('restartPaco'),
    "PACO V11.39.0 perdió snapshot, lenguaje entrenado, resiliencia, controles, monitoreo, resumen, alerta, registro guiado o voz."
  );
  check(!pacoOperational.includes('api.workPlanner(todayIso()'),"PACO no debe volver al polling pesado del planner.");
  check(pacoLanguage.includes('INTENT_ALIASES')&&pacoLanguage.includes('CRM_MODULE_KNOWLEDGE')&&pacoLanguage.includes('detectPacoIntent')&&pacoLanguage.includes('matchCrmModule'),"Motor de lenguaje PACO incompleto.");
  check(pacoOperationalCss.includes('paco-op-toast-stack')&&pacoOperationalCss.includes('paco-op-badge'),"CSS operacional de PACO incompleto.");
  check(pacoMigration.includes('erp_x_paco_snapshot')&&!/create\\s+table/i.test(pacoMigration)&&!/create\\s+(unique\\s+)?index/i.test(pacoMigration),"Migración PACO debe limitarse a RPC sin tablas ni índices.");
}
