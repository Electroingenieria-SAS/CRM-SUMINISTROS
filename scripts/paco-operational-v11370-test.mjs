import fs from "node:fs";
import assert from "node:assert/strict";

const wrapper=fs.readFileSync(new URL("../assets/js/modules/paco-assistant-v11200.js",import.meta.url),"utf8");
const engine=fs.readFileSync(new URL("../assets/js/modules/paco-operational-v11370.js",import.meta.url),"utf8");
const css=fs.readFileSync(new URL("../assets/runtime-css/paco-operational-v11370.css",import.meta.url),"utf8");

assert.match(wrapper,/export \{installPacoAssistant\} from "\.\/paco-operational-v11370\.js";/);
assert.equal(wrapper.includes("GUIDES"),false,"El entrypoint anterior no debe conservar el asistente legado.");
assert.equal(wrapper.includes("password"),false,"El entrypoint anterior no debe conservar cambio de contraseña.");

for(const token of [
  'const VERSION="11.37.0"',
  "MONITOR_MS=60000",
  "ORDER_WARN_SECONDS=3600",
  "IDLE_WARN_SECONDS=1800",
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
  "diagnoseOrderById",
  "paco-op-toast-stack"
]){
  assert.equal(engine.includes(token),true,`PACO operacional debe conservar ${token}`);
}

assert.equal(engine.includes("api.pacoSnapshot()"),true,"El monitor debe usar un único snapshot operacional.");
assert.equal(engine.includes("MONITOR_MS=60000"),true,"El polling operativo debe permanecer en un minuto.");

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

for(const token of [
  "paco-op-panel",
  "paco-op-voice",
  "paco-op-badge",
  "paco-op-toast-stack",
  "paco-op-toast",
  "@media(max-width:720px)"
]){
  assert.equal(css.includes(token),true,`CSS PACO debe conservar ${token}`);
}

console.log("PACO operational assistant v11.37.0 tests: OK");
