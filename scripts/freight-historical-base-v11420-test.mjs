import assert from "node:assert/strict";
import fs from "node:fs";

const migration=fs.readFileSync(new URL("../supabase/migrations/131_freight_historical_base_v11_42_0.sql",import.meta.url),"utf8");
const orders=fs.readFileSync(new URL("../assets/js/modules/orders.js",import.meta.url),"utf8");

for(const token of [
  "freight_city_key_v1142",
  "freight_department_key_v1142",
  "freight_reference_scope_v1142",
  "CITY_HISTORY",
  "DEPARTMENT_HISTORY",
  "NATIONAL_BASELINE",
  "UPLOADED_HISTORICAL_BASE",
  "historicalBaseSamples",
  "referenceSamples",
  "referenceScope",
  "HISTORICAL_BASE_ACTIVE",
  "'samples',v_model.sample_count",
  "'source','UPLOADED_FILE'",
  "'version','11.42.0'"
]) assert.equal(migration.includes(token),true,`Migración V11.42 debe incluir ${token}`);

for(const token of [
  "BOGOTA D C",
  "GUADALAJARA DE BUGA",
  "SANTA CRUZ DE LORICA",
  "VALLE DEL CAUCA",
  "GUAJIRA"
]) assert.equal(migration.includes(token),true,`Normalización geográfica debe cubrir ${token}`);

for(const token of [
  "BASE HISTÓRICA ACTIVA",
  "Base histórica activa desde ahora",
  "despachos ya están siendo usados",
  "freightReferenceScopeLabel",
  "referenceSamples",
  "Base histórica cargada"
]) assert.equal(orders.includes(token),true,`UI V11.42 debe incluir ${token}`);

assert.equal(orders.includes("Aún sin histórico suficiente"),false,"No debe mostrarse el falso mensaje genérico de histórico insuficiente.");
assert.equal(orders.includes("Sin histórico específico para esta modalidad"),true,"Las modalidades no nacionales deben separarse estadísticamente.");
assert.equal(migration.includes("revoke all on function erp_supply.freight_reference_scope_v1142"),true);
assert.equal(migration.includes("grant execute on function public.erp_x_freight_predictions"),true);

console.log("freight historical base v11.42.0 tests: OK");
