import fs from "node:fs";
import assert from "node:assert/strict";

const wrapper=fs.readFileSync(new URL("../assets/js/modules/paco-assistant-v11200.js",import.meta.url),"utf8");
const engine=fs.readFileSync(new URL("../assets/js/modules/paco-operational-v11370.js",import.meta.url),"utf8");
const css=fs.readFileSync(new URL("../assets/runtime-css/paco-operational-v11370.css",import.meta.url),"utf8");

assert.match(wrapper,/export \{installPacoAssistant\} from "\.\/paco-operational-v11370\.js";/);
assert.equal(wrapper.includes("GUIDES"),false,"El entrypoint anterior no debe conservar el asistente legado.");
assert.equal(wrapper.includes("password"),false,"El entrypoint anterior no debe conservar cambio de contraseña.");

for(const token of [
  'const VERSION="11.37.2"',
  "MONITOR_MS=60000",
  "DIGEST_INTERVAL_MS=30*60*1000",
  "ORDER_WARN_SECONDS=3600",
  "IDLE_WARN_SECONDS=20*60",
  "MANAGER_ROLES",
  "AUX_ROLES",
  "api.pacoSnapshot",
  "api.listOrders",
  "api.workCatalog",
  "api.workStart",
  "monitorTransitions",
  "monitorThresholds",
  "idleAuxiliaries",
  "delayedOrders",
  "longActivities",
  "buildOperationalDigest",
  "digestVoiceText",
  "deliverDigest",
  "stageBreakdown",
  "orderRowsHtml",
  "testVoice",
  "MALE_VOICE_HINTS",
  "LATAM_SPANISH",
  "isLikelyMaleVoice",
  "renderVoiceOptions",
  "paco_voice_id_v11372",
  "teamActivityMessage",
  "unassignedOrdersMessage",
  "longWorkMessage",
  "capabilitiesMessage",
  "speechSynthesis",
  "SpeechSynthesisUtterance",
  "editDistance",
  "fuzzyPhrase",
  "activitySuggestions",
  "activity-start",
  'action==="summary-now"',
  'action==="unassigned"',
  'action==="team"',
  'action==="long-work"',
  'action==="shipped"',
  'action==="novelties"',
  "diagnoseOrderById",
  "paco-op-toast-stack"
]){
  assert.equal(engine.includes(token),true,`PACO operacional debe conservar ${token}`);
}

assert.equal(engine.includes("api.pacoSnapshot()"),true,"El monitor debe usar un único snapshot operacional.");
assert.equal(engine.includes("MONITOR_MS=60000"),true,"El polling operativo debe permanecer en un minuto.");
assert.equal(engine.includes("DIGEST_INTERVAL_MS=30*60*1000"),true,"El resumen operativo automático debe emitirse cada 30 minutos.");
assert.equal(engine.includes("IDLE_WARN_SECONDS=20*60"),true,"La alerta de inactividad debe comenzar a los 20 minutos.");
assert.equal(engine.includes("resumen cada 30 min"),true,"La interfaz debe declarar la frecuencia del resumen.");
assert.equal(engine.includes("Probar voz"),true,"PACO debe ofrecer una prueba de voz explícita.");
assert.equal(engine.includes("Voz masculina latinoamericana"),true,"PACO debe declarar la preferencia masculina latinoamericana.");
assert.equal(engine.includes("data-paco-voice-select"),true,"PACO debe permitir escoger una voz latina disponible.");
assert.equal(engine.includes("LATAM_SPANISH"),true,"La selección automática debe priorizar español latinoamericano.");
assert.equal(engine.includes("Sin actividad >20 min"),true,"El resumen debe mostrar auxiliares con más de 20 minutos sin actividad.");

for(const role of ["jefe_logistica","lider_logistica","coordinador_logistico","aux_logistica","auxiliar_corte"]){
  assert.equal(engine.includes(role),true,`PACO debe reconocer el rol ${role}`);
}

for(const phrase of [
  "registrar actividad",
  "pedidos demorados",
  "quien esta desocupado",
  "actividades terminadas",
  "pedidos despachados",
  "novedades",
  "estado del equipo",
  "pedidos sin responsable",
  "actividades largas",
  "que puedes hacer"
]){
  assert.equal(engine.includes(phrase),true,`PACO debe comprender la intención ${phrase}`);
}

for(const removed of ["getSupabase","password-self","setToolsOpen","Centro de herramientas","MutationObserver","api.workPlanner(todayIso()","api.workPeople(null)"]){
  assert.equal(engine.includes(removed),false,`PACO nuevo no debe reintroducir ${removed}`);
}

const generatedActions=[...engine.matchAll(/action:"([^"]+)"/g)].map(match=>match[1]);
const handledActions=new Set([...engine.matchAll(/action==="([^"]+)"/g)].map(match=>match[1]));
for(const action of new Set(generatedActions)){
  assert.equal(handledActions.has(action),true,`Todo botón PACO debe tener handler funcional: ${action}`);
}

for(const token of [
  "paco-op-panel",
  "paco-op-voice",
  "paco-op-badge",
  "paco-op-toast-stack",
  "paco-op-toast",
  "paco-op-launcher-glyph",
  "paco-op-message-stack",
  "paco-op-order-list",
  "paco-op-order-row",
  "paco-op-input-shell",
  "paco-op-voice-picker",
  "@media(max-width:720px)"
]){
  assert.equal(css.includes(token),true,`CSS PACO debe conservar ${token}`);
}

console.log("PACO operational assistant v11.37.2 masculine Latin voice tests: OK");
