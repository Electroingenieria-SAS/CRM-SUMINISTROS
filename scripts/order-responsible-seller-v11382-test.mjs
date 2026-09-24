import assert from "node:assert/strict";
import fs from "node:fs";

const orders=fs.readFileSync(new URL("../assets/js/modules/orders.js",import.meta.url),"utf8");
const migration=fs.readFileSync(new URL("../supabase/migrations/124_order_responsible_seller_v11_38_2.sql",import.meta.url),"utf8");

for(const sqlToken of [
  "sync_task_session_responsible",
  "trg_task_session_responsible",
  "effective_assignee_id",
  "seller_profile_id",
  "'sellerName',seller_name",
  "'currentResponsibleName',v_responsible_name",
  "'assignedName',p.display_name"
]){
  assert.equal(migration.includes(sqlToken),true,`Falta contrato backend: ${sqlToken}`);
}

assert.equal(/create\s+table/i.test(migration),false,"V11.38.2 no debe crear tablas.");
assert.equal(/create\s+(unique\s+)?index/i.test(migration),false,"V11.38.2 no debe crear índices.");

for(const uiToken of [
  "<small>Responsable</small>",
  "<small>Vendedor</small>",
  "order.sellerName",
  "currentResponsibleName",
  'String(order.status||"").toUpperCase()==="CLOSED"?"—":"En cola"'
]){
  assert.equal(orders.includes(uiToken),true,`Falta contrato visual: ${uiToken}`);
}

assert.equal(
  orders.includes('fmt.escape(order.assigneeName||"En cola")'),
  false,
  "Responsable no debe depender del espejo genérico con fallback fijo."
);

console.log("Order responsible + seller V11.38.2 tests: OK");
