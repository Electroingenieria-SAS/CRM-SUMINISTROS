import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {renderFreightAuditRows,riskLabel} from "../../assets/js/domains/freight-intelligence/audit-table.js";

const cop=value=>"$ "+Number(value).toLocaleString("es-CO");
const sample=[{
  orderId:"64e1d111-b5c7-4f12-9ef3-324fed04ca20",
  orderNumber:"PEDIDO PRUEBA",
  clientName:"CLIENTE DE PRUEBA",
  carrier:"ENVÍA",
  predictedMid:150000,
  actualCost:140000,
  anomalyLevel:"FAVORABLE",
  deviationPct:-6.7,
  potentialSavings:10000,
  deliveryRisk:"ON_TIME"
}];

test("auditoría muestra pedido como acción profesional accesible",()=>{
  const html=renderFreightAuditRows(sample,cop);
  assert.match(html,/class="freight-order-action-v1141"/);
  assert.match(html,/type="button"/);
  assert.match(html,/data-fi-order="64e1d111-b5c7-4f12-9ef3-324fed04ca20"/);
  assert.match(html,/aria-label="Abrir pedido PEDIDO PRUEBA"/);
  assert.match(html,/aria-hidden="true"/);
  assert.doesNotMatch(html,/class="link-btn"/);
  assert.match(html,/CLIENTE DE PRUEBA/);
});

test("auditoría mantiene las siete columnas y los valores originales",()=>{
  const html=renderFreightAuditRows(sample,cop);
  for(const label of ["Pedido","Transportadora","Predicho","Real","Desviación","Ahorro potencial","Riesgo"]){
    assert.ok(html.includes('data-label="'+label+'"'),"Campo móvil "+label);
    assert.ok(htm