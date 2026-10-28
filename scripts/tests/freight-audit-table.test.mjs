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
    assert.ok(html.includes(">"+label+"</th>"),"Cabecera "+label);
  }
  for(const value of ["ENVÍA","150.000","140.000","10.000","-6,7%","Favorable","A tiempo"]){
    assert.ok(html.includes(value),value);
  }
  assert.match(html,/role="region" tabindex="0"/);
  assert.match(html,/<caption/);
});

test("auditoría no crea botones sin identificador válido",()=>{
  const html=renderFreightAuditRows([{...sample,orderId:null}],cop);
  assert.match(html,/freight-order-unlinked-v1141/);
  assert.doesNotMatch(html,/data-fi-order=/);
  assert.doesNotMatch(html,/freight-order-action-v1141/);
});

test("auditoría presenta costo pendiente y riesgo sin fecha",()=>{
  const html=renderFreightAuditRows([{...sample,actualCost:null,predictedMid:null,potentialSavings:null,anomalyLevel:"NONE",deliveryRisk:"NO_DATE",deviationPct:null}],cop);
  assert.match(html,/>Pendiente</);
  assert.match(html,/>Sin evaluación</);
  assert.match(html,/>Sin fecha</);
  assert.match(html,/tone-no_date/);
  assert.equal(riskLabel("AT_RISK"),"En riesgo");
});

test("datos externos se escapan y no se convierten en HTML ejecutable",()=>{
  const html=renderFreightAuditRows([{...sample,orderId:'"><img src=x onerror=alert(1)>',orderNumber:'<svg onload=alert(1)>',clientName:"<script>evil()</script>",carrier:"<img src=x>"}],cop);
  assert.doesNotMatch(html,/<script>/);
  assert.doesNotMatch(html,/<img/);
  assert.doesNotMatch(html,/<svg onload/);
  assert.match(html,/&lt;script&gt;/);
  assert.match(html,/&lt;img/);
});

test("tonos de estados están limitados a clases conocidas",()=>{
  const html=renderFreightAuditRows([{...sample,anomalyLevel:'normal evil-class',deliveryRisk:'ON_TIME danger'}],cop);
  assert.match(html,/tone-none/);
  assert.match(html,/tone-no_date/);
  assert.doesNotMatch(html,/evil-class/);
  assert.doesNotMatch(html,/tone-on_time danger/);
});

test("tabla sin registros conserva el mensaje funcional",()=>{
  const html=renderFreightAuditRows([],cop);
  assert.match(html,/Sin envíos nacionales en el rango/);
  assert.doesNotMatch(html,/<table/);
});

test("CSS modular incluye escritorio, navegación táctil y focus visible",()=>{
  const css=fs.readFileSync(new URL("../../assets/css/modules/logistics/freight-audit-table.css",import.meta.url),"utf8");
  const imports=fs.readFileSync(new URL("../../assets/css/operations.css",import.meta.url),"utf8");
  const main=fs.readFileSync(new URL("../../assets/js/modules/freight-intelligence-v11410.js",import.meta.url),"utf8");
  assert.match(imports,/@import "modules\/logistics\/freight-audit-table.css"/);
  assert.match(css,/\.freight-order-action-v1141:focus-visible/);
  assert.match(css,/@media \(max-width:760px\)/);
  assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(main,/renderFreightAuditRows\(rows,money\)/);
  assert.match(main,/querySelectorAll\("\[data-fi-order\]"\)/);
});

