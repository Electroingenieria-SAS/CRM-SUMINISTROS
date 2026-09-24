import assert from "node:assert/strict";
import fs from "node:fs";

const migration=fs.readFileSync(new URL("../supabase/migrations/129_freight_predictive_model_v11_40_0.sql",import.meta.url),"utf8");
const materials=fs.readFileSync(new URL("../assets/js/services/materials.js",import.meta.url),"utf8");
const orders=fs.readFileSync(new URL("../assets/js/modules/orders.js",import.meta.url),"utf8");
const api=fs.readFileSync(new URL("../assets/js/services/api.js",import.meta.url),"utf8");
const css=fs.readFileSync(new URL("../assets/css/operations.css",import.meta.url),"utf8");

for(const token of [
  "freight_prediction_models",
  "freight_route_reference",
  "EI_FREIGHT_RIDGE_WEIGHT",
  "erp_x_freight_predictions",
  "freight_model_predict_v1140",
  "COLVANES",
  "TCC",
  "VELOENVIOS",
  "749",
  "0.12106009847814918",
  "70.88948787061994",
  "92.99191374663073",
  "AGGREGATED_MODEL_NO_PII",
  "PRELIMINARY_ROUTE_HISTORY",
  "REFINED_WEIGHT_MODEL",
  "dimensionalUpliftRate",
  "onTimeRate",
  "medianDays",
  "No autorizado para consultar predicciones de flete"
]) assert.equal(migration.includes(token),true,`Migración predictiva debe incluir ${token}`);

assert.equal(migration.includes("client_name"),false,"El seed agregado no debe persistir nombres de clientes.");
assert.equal(migration.includes("client_phone"),false,"El seed agregado no debe persistir teléfonos.");
assert.equal(migration.includes("client_address"),false,"El seed agregado no debe persistir direcciones.");
assert.equal(migration.includes("recipient_name"),false,"El seed agregado no debe persistir destinatarios.");

for(const token of [
  "data-material-weight",
  "materialWeight",
  "weight:Number(container?.dataset.materialWeight||0)",
  "weight:Number(material.weight||line.weight||0)"
]) assert.equal(materials.includes(token),true,`Materiales debe transportar peso Siesa mediante ${token}`);

for(const token of [
  "freightPredictions:",
  'rpc("erp_x_freight_predictions"'
]) assert.equal(api.includes(token),true,`API debe integrar ${token}`);

for(const token of [
  "estimatedSalesWeight",
  "freightPredictionSnapshot",
  "freightPredictionsHtml",
  "api.freightPredictions",
  "estimatedMaterialWeightKg",
  "freightPredictionAtCreation",
  "PREDICCIÓN REFINADA",
  "749 despachos históricos",
  "Modelo validado fuera de muestra"
]) assert.equal(orders.includes(token),true,`Pedidos debe integrar ${token}`);

for(const token of [
  "sales-freight-carriers-v1140",
  "sales-freight-carrier-v1140",
  "sales-material-freight-v1140"
]) assert.equal(css.includes(token),true,`CSS debe integrar ${token}`);

assert.equal(/api\.freightPredictions\(\{department,city,weightKg\}\)/.test(orders),true,"Despacho nacional debe recalcular con peso estimado.");
assert.equal(orders.includes('route==="NATIONAL_DISPATCH"'),true,"El modelo transportador debe limitarse al despacho nacional.");
assert.equal(migration.includes("revoke all on table erp_supply.freight_prediction_models from public,anon,authenticated"),true,"Tabla de modelos no debe ser accesible directamente.");
assert.equal(migration.includes("revoke all on table erp_supply.freight_route_reference from public,anon,authenticated"),true,"Tabla agregada de rutas no debe ser accesible directamente.");

console.log("freight predictive model v11.40.0 tests: OK");
