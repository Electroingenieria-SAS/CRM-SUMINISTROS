import assert from "node:assert/strict";
import fs from "node:fs";

const migration=fs.readFileSync(new URL("../supabase/migrations/130_logistics_intelligence_control_v11_41_0.sql",import.meta.url),"utf8");
const dashboard=fs.readFileSync(new URL("../assets/js/modules/freight-intelligence-v11410.js",import.meta.url),"utf8");
const api=fs.readFileSync(new URL("../assets/js/services/api.js",import.meta.url),"utf8");
const paco=fs.readFileSync(new URL("../assets/js/modules/paco-operational-v11370.js",import.meta.url),"utf8");
const operational=fs.readFileSync(new URL("../assets/js/modules/operational-v112.js",import.meta.url),"utf8");
const main=fs.readFileSync(new URL("../assets/js/main.js",import.meta.url),"utf8");

for(const token of [
  "erp_x_freight_intelligence_dashboard",
  "erp_x_freight_alerts",
  "freight_eval_v1141",
  "potential_savings",
  "logistics_pct_of_sale",
  "cost_per_kg",
  "delivery_risk",
  "estimated_arrival_p80",
  "medianAbsErrorPct",
  "within25Pct",
  "expectedMid",
  "'version','11.41.0'"
]) assert.equal(migration.includes(token),true,`Migración V11.41 debe incluir ${token}`);

for(const token of [
  "Predicho vs real",
  "Ahorro potencial",
  "PRÓXIMO PRESUPUESTO LOGÍSTICO",
  "PRECISIÓN MENSUAL",
  "Costo logístico",
  "data-fi-order"
]) assert.equal(dashboard.includes(token),true,`Dashboard logístico debe incluir ${token}`);

assert.equal(api.includes("freightIntelligence:"),true);
assert.equal(api.includes("freightAlerts:"),true);
assert.equal(main.includes("enhanceFreightIntelligenceDashboard"),true);

for(const token of ["freightAlerts","Flete crítico","Entrega en riesgo","freightIntelligenceMessage"]) assert.equal(paco.includes(token),true,`PACO debe integrar ${token}`);
for(const token of ["data-v1141-carrier-guard","carrierPredictionV1141","Control predictivo"]) assert.equal(operational.includes(token),true,`Guía debe integrar ${token}`);

assert.equal(migration.includes("revoke all on function erp_supply.freight_eval_v1141"),true);
assert.equal(migration.includes("grant execute on function public.erp_x_freight_intelligence_dashboard"),true);
assert.equal(migration.includes("grant execute on function public.erp_x_freight_alerts"),true);

console.log("logistics intelligence control v11.41.0 tests: OK");
