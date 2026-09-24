import assert from "node:assert/strict";
import fs from "node:fs";

const orders=fs.readFileSync(new URL("../assets/js/modules/orders.js",import.meta.url),"utf8");
const workforce=fs.readFileSync(new URL("../assets/js/modules/workforce.js",import.meta.url),"utf8");
const operational=fs.readFileSync(new URL("../assets/js/modules/operational-v112.js",import.meta.url),"utf8");
const api=fs.readFileSync(new URL("../assets/js/services/api.js",import.meta.url),"utf8");
const migration=fs.readFileSync(new URL("../supabase/migrations/125_customer_freight_intelligence_v11_39_0.sql",import.meta.url),"utf8");
const permissions=fs.readFileSync(new URL("../supabase/migrations/126_customer_freight_intelligence_permissions_v11_39_0.sql",import.meta.url),"utf8");
const paymentTruth=fs.readFileSync(new URL("../supabase/migrations/127_customer_payment_truth_v11_39_1.sql",import.meta.url),"utf8");
const financialFlow=fs.readFileSync(new URL("../assets/js/modules/financial-flow.js",import.meta.url),"utf8");

assert.equal(orders.includes('formSelect("priority"'),false,"Creación de pedidos no debe exponer prioridad manual.");
assert.equal(orders.includes('name="priority"'),false,"No debe existir campo manual priority en el wizard.");

for(const token of [
  "data-customer-intelligence",
  "data-freight-estimate",
  "api.customerIntelligence",
  "api.freightEstimate",
  "customerSegmentBadgeFromPriority",
  "Segmento cliente",
  "Flete estimado"
]) assert.equal(orders.includes(token),true,`Pedidos debe integrar ${token}`);

for(const token of [
  "customerIntelligence:",
  "customerRanking:",
  "freightEstimate:"
]) assert.equal(api.includes(token),true,`API debe exponer ${token}`);

for(const token of [
  "customer_value_profile",
  "erp_x_customer_ranking",
  "freight_estimate_internal",
  "trg_orders_customer_priority_v1139",
  "'orderCount',0.5",
  "'paidAmount',0.5",
  "v_total_orders>=20",
  "v_clients>=5",
  "v_orders>=3",
  "WEIGHT",
  "PACKAGE_COUNT",
  "VOLUME",
  "ROUTE_HISTORY",
  "invoiceWebViewLink",
  "distanceKind",
  "transitKind"
]) assert.equal(migration.includes(token),true,`Migración inteligencia debe conservar ${token}`);

assert.equal(/create\s+table/i.test(migration+permissions),false,"V11.39.0 no debe crear tablas de aprendizaje.");
assert.equal(/create\s+(unique\s+)?index/i.test(migration+permissions),false,"V11.39.0 no debe crear índices nuevos para aprendizaje.");

for(const token of [
  "customer_order_value_v11391",
  "PAYMENT_AMOUNT",
  "CAJA_FACTURACION",
  "INVOICE_AMOUNT_FALLBACK",
  "PAYMENT_WITH_INVOICE_FALLBACK",
  "actualPaymentOrders",
  "invoiceFallbackOrders",
  "paymentCoveragePct",
  "v_segment:='PREMIUM'",
  "v_priority:='URGENT'",
  "'version','11.39.1'"
]) assert.equal(paymentTruth.includes(token),true,`V11.39.1 debe conservar ${token}`);

assert.equal(paymentTruth.includes("v_priority:='HIGH'"),false,"Premium no puede escribir HIGH: orders.priority solo admite LOW/MEDIUM/URGENT.");

for(const token of [
  "Valor pagado confirmado",
  "paymentReference",
  "paymentConfirmed:true",
  'paymentMeasurementVersion:"11.39.1"'
]) assert.equal(financialFlow.includes(token),true,`Caja debe registrar pago real mediante ${token}`);

for(const token of [
  "can_access_module('sales','read')",
  "can_access_module('shipping','read')",
  "No autorizado para consultar ranking de clientes"
]) assert.equal(permissions.includes(token),true,`Permisos deben incluir ${token}`);

for(const token of [
  "data-v1139-billing-filter",
  "invoiceWebViewLink",
  "Ver factura ↗",
  "distanceKm",
  "transitHours",
  "metricKindLabel",
  "packageVolumeM3"
]) assert.equal(operational.includes(token),true,`Centro de Operaciones debe integrar ${token}`);

for(const token of [
  "customerRanking",
  "VALOR COMERCIAL",
  "Pareto y ranking automático de clientes",
  "customerRankingHtml"
]) assert.equal(workforce.includes(token),true,`Indicadores debe integrar ${token}`);

console.log("customer + freight intelligence v11.39.1 tests: OK");
