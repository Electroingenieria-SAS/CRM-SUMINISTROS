import fs from "node:fs";
import assert from "node:assert/strict";

const paco=fs.readFileSync(new URL("../assets/js/modules/paco-assistant-v11200.js",import.meta.url),"utf8");
const api=fs.readFileSync(new URL("../assets/js/services/api.js",import.meta.url),"utf8");
const css=fs.readFileSync(new URL("../assets/css/experience.css",import.meta.url),"utf8");
const migration=fs.readFileSync(new URL("../supabase/migrations/121_paco_virtual_assistant_v11_37_0.sql",import.meta.url),"utf8");

for(const token of [
  'const VERSION="11.37.0"',
  "speechSynthesis",
  '"es-CO"',
  "editDistance",
  "phraseScore",
  "ACTIVITY_QUERY",
  "api.workStart",
  "api.workPause",
  "api.workResume",
  "api.workFinish",
  "api.pacoSnapshot",
  "ORDER_QUEUE_LONG",
  "AUX_IDLE",
  "ACTIVITY_LONG",
  "ACTIVITY_DONE",
  "ORDER_DISPATCHED",
  "ORDER_ISSUE",
  "requestSnapshotSoon",
  "sessionStorage",
  "paco2-unread"
]){
  assert.equal(paco.includes(token),true,`PACO V11.37.0 debe conservar ${token}`);
}

for(const removed of [
  "change_password",
  "paco2-tools-grid",
  "data-paco-tool",
  "MutationObserver"
]){
  assert.equal(paco.includes(removed),false,`PACO no debe revivir funcionalidad anterior: ${removed}`);
}

assert.equal(api.includes('pacoSnapshot:(since=null,limit=30)=>rpc("erp_x_paco_snapshot"'),true,"API debe exponer un único snapshot PACO.");

for(const token of [
  ".paco2-panel{display:none!important}",
  ".paco2-message.user",
  ".paco2-inline-alert",
  ".paco2-unread",
  ".paco2-voice",
  ".paco2-composer",
  ".paco2-action.tone-primary"
]){
  assert.equal(css.includes(token),true,`CSS PACO debe conservar ${token}`);
}

for(const token of [
  "erp_x_paco_snapshot",
  "business_seconds_between",
  "ORDER_QUEUE_LONG",
  "AUX_IDLE",
  "ACTIVITY_LONG",
  "ACTIVITY_DONE",
  "ORDER_DISPATCHED",
  "ORDER_ISSUE",
  "pollAfterSeconds",
  "p_limit"
]){
  assert.equal(migration.includes(token),true,`Snapshot PACO debe contener ${token}`);
}

assert.equal(/create\s+table/i.test(migration),false,"PACO V11.37.0 no debe crear tablas.");
assert.equal(/create\s+(unique\s+)?index/i.test(migration),false,"PACO V11.37.0 no debe crear índices sin evidencia de necesidad.");
assert.equal(/\binsert\s+into\b/i.test(migration),false,"Polling PACO no debe escribir filas.");
assert.equal(/\bupdate\s+erp_supply\b/i.test(migration),false,"Polling PACO no debe actualizar filas.");
assert.equal(/\bdelete\s+from\b/i.test(migration),false,"Polling PACO no debe eliminar filas.");
assert.equal(migration.includes("stable\nsecurity definer"),true,"Snapshot PACO debe ser estable y usar SECURITY DEFINER.");
assert.equal(migration.includes("revoke all on function public.erp_x_paco_snapshot"),true,"Snapshot PACO debe revocar acceso público.");
assert.equal(migration.includes("grant execute on function public.erp_x_paco_snapshot"),true,"Snapshot PACO debe conceder solo ejecución autenticada.");

console.log("paco virtual assistant v11.37.0 tests: OK");
