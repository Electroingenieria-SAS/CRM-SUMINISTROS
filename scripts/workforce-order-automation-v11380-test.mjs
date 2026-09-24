import assert from "node:assert/strict";
import fs from "node:fs";

const migration=fs.readFileSync(new URL("../supabase/migrations/122_automatic_order_workforce_v11_38_0.sql",import.meta.url),"utf8");
const specialMigration=fs.readFileSync(new URL("../supabase/migrations/123_workforce_special_treatment_metrics_v11_38_0.sql",import.meta.url),"utf8");
const timeline=fs.readFileSync(new URL("../assets/js/modules/workforce-timeline-v11350.js",import.meta.url),"utf8");
const calendar=fs.readFileSync(new URL("../assets/js/modules/workforce-calendar-v11360.js",import.meta.url),"utf8");
const workforce=fs.readFileSync(new URL("../assets/js/modules/workforce.js",import.meta.url),"utf8");
const api=fs.readFileSync(new URL("../assets/js/services/api.js",import.meta.url),"utf8");
const paco=fs.readFileSync(new URL("../assets/js/modules/paco-operational-v11370.js",import.meta.url),"utf8");
const orders=fs.readFileSync(new URL("../assets/js/modules/orders.js",import.meta.url),"utf8");

for(const sql of [migration,specialMigration]){
  assert.equal(/create\s+table/i.test(sql),false,"V11.38.0 no debe crear tablas nuevas.");
  assert.equal(/create\s+(unique\s+)?index/i.test(sql),false,"V11.38.0 no debe crear índices nuevos.");
}

for(const token of [
  "erp_supply.task_sessions",
  "erp_supply.cut_executions",
  "erp_supply.work_executions",
  "operationalExecutions",
  "erp_x_work_operational_detail",
  "workforceSpecialTreatment",
  "Tratamiento especial",
  "erp_x_paco_snapshot"
]){
  assert.equal(migration.includes(token),true,`Migración operativa debe conservar ${token}`);
}

assert.equal(
  migration.includes("t.step_code='CORTE'")&&migration.includes("cut_execution_requirements"),
  true,
  "Debe evitarse duplicar Corte cuando existe ejecución específica."
);

assert.equal(
  specialMigration.includes("not erp_supply.workforce_special_treatment(p.id)"),
  true,
  "Alexander/tratamiento especial debe quedar fuera del agregado del equipo."
);
assert.equal(
  specialMigration.includes("'mode','SPECIAL'"),
  true,
  "Consulta individual de tratamiento especial debe responder modo SPECIAL."
);

for(const token of [
  "operationalExecutions",
  "timelineFromOperational",
  'sourceType:"ORDER_PROCESS"',
  "taskSessionId",
  "cutExecutionId"
]){
  assert.equal(timeline.includes(token),true,`Timeline debe integrar trabajo de pedido: ${token}`);
}

for(const token of [
  "workOperationalDetail",
  "data-assignment-open",
  "specialTreatment",
  "work-calendar-special-slot-v11380",
  "eventOverlapsSlot",
  "Tratamiento especial"
]){
  assert.equal(calendar.includes(token)||api.includes(token),true,`Calendario/API debe integrar ${token}`);
}

assert.equal(
  calendar.includes("rows.filter(row=>row.plannedStart&&eventOverlapsSlot(row,slot))"),
  true,
  "Día debe marcar todas las franjas solapadas por una ejecución real."
);
assert.equal(
  calendar.includes("eventSlotIndex(row,slots)===index"),
  false,
  "Día no debe limitar una ejecución únicamente a la franja donde comenzó."
);

assert.equal(
  workforce.includes("const assignments=timeline.filter"),
  true,
  "Capacidad visible debe calcularse desde timeline unificado."
);

for(const token of [
  "person.specialTreatment",
  "Proceso automático del pedido",
  "snapshotExecutions(snapshot)"
]){
  assert.equal(paco.includes(token),true,`PACO debe comprender ocupación automática/especial: ${token}`);
}

assert.equal(
  orders.includes("<small>Etapa actual</small>"),
  true,
  "Resumen del pedido debe mostrar explícitamente la etapa actual."
);
assert.equal(
  orders.includes("<small>Estado de etapa</small>"),
  true,
  "Resumen del pedido debe separar etapa de estado."
);

const generated=[...paco.matchAll(/action:"([^"]+)"/g)].map(match=>match[1]);
const handled=new Set([...paco.matchAll(/action==="([^"]+)"/g)].map(match=>match[1]));
for(const action of new Set(generated)){
  assert.equal(handled.has(action),true,`PACO no puede generar botón sin handler: ${action}`);
}

console.log("Workforce automatic order occupation V11.38.0 tests: OK");
