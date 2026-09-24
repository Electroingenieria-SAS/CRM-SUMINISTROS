import {api} from "../services/api.js";
import {fmt} from "../core/format.js";
import {loading} from "../core/ui.js";

const money=value=>{try{return new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(Number(value||0))}catch{return fmt.number(value||0)}};
const num=value=>Number.isFinite(Number(value))?Number(value):0;
const pct=value=>value==null?"—":`${fmt.number(value,1)}%`;
const riskLabel=value=>({LATE:"Tarde",AT_RISK:"En riesgo",ON_TIME:"A tiempo",ON_TRACK:"En seguimiento",NO_DATE:"Sin fecha"})[String(value||"").toUpperCase()]||"—";
const anomalyLabel=value=>({CRITICAL:"Crítica",HIGH:"Alta",FAVORABLE:"Favorable",NORMAL:"Normal",NONE:"Sin evaluación"})[String(value||"").toUpperCase()]||"—";

export async function enhanceFreightIntelligenceDashboard(root){
  if(!root||document.body.dataset.freightIntelLoading==="1")return;
  root.querySelector("[data-freight-intelligence-v1141]")?.remove();
  const today=new Date();
  const to=today.toISOString().slice(0,10);
  const from=new Date(today.getTime()-89*864e5).toISOString().slice(0,10);
  const section=document.createElement("section");
  section.className="card freight-intel-v1141";
  section.dataset.freightIntelligenceV1141="1";
  section.innerHTML=`
    <header class="card-head freight-intel-head-v1141">
      <div><span class="freight-intel-kicker-v1141">Inteligencia logística predictiva</span><h3>Predicho vs real · ahorro · riesgo · presupuesto</h3><p>Convierte el histórico de fletes y los costos reales del CRM en control operativo continuo.</p></div>
      <div class="freight-intel-filters-v1141"><label>Desde<input class="control" type="date" data-fi-from value="${from}"></label><label>Hasta<input class="control" type="date" data-fi-to value="${to}"></label><button class="btn btn-search" data-fi-refresh>Actualizar</button></div>
    </header>
    <div class="card-body" data-fi-content>${loading("Calculando inteligencia logística…")}</div>`;
  root.append(section);
  section.querySelector("[data-fi-refresh]").onclick=()=>loadFreightIntelligence(section);
  await loadFreightIntelligence(section);
}

async function loadFreightIntelligence(section){
  const host=section.querySelector("[data-fi-content]");
  const from=section.querySelector("[data-fi-from]")?.value||null;
  const to=section.querySelector("[data-fi-to]")?.value||null;
  host.innerHTML=loading("Comparando predicciones con costos reales…");
  try{
    const data=await api.freightIntelligence(from,to);
    renderFreightIntelligence(host,data||{});
  }catch(error){
    host.innerHTML=`<div class="module-error"><h4>No fue posible cargar la inteligencia logística</h4><p class="danger">${fmt.escape(error.message||String(error))}</p></div>`;
  }
}

function renderFreightIntelligence(host,data){
  const s=data.summary||{},alerts=data.alerts||[],rows=data.rows||[],budget=data.budget||{};
  host.innerHTML=`
    <section class="freight-intel-kpis-v1141">
      ${kpi("Costo real",money(s.actualCarrierCost),"Fletes registrados")}
      ${kpi("Predicción evaluada",money(s.predictedCost),`${fmt.number(s.evaluatedPredictions||0)} envíos comparables`)}
      ${kpi("Error mediano",pct(s.medianAbsErrorPct),"Precisión real del modelo",toneForError(s.medianAbsErrorPct))}
      ${kpi("Dentro de ±25%",pct(s.within25Pct),"Predicciones acertadas",num(s.within25Pct)>=70?"good":"warn")}
      ${kpi("Ahorro potencial",money(s.potentialSavings),"Diferencia vs opción económica",num(s.potentialSavings)>0?"warn":"good")}
      ${kpi("Alertas",fmt.number(s.anomalies||0),`${fmt.number(s.criticalAnomalies||0)} críticas`,num(s.anomalies)>0?"danger":"good")}
      ${kpi("Entregas en riesgo",fmt.number(s.atRiskDeliveries||0),"Fecha solicitada vs ETA",num(s.atRiskDeliveries)>0?"warn":"good")}
      ${kpi("Costo logístico / venta",pct(s.avgLogisticsPctOfSale),"Promedio observado")}
    </section>

    <section class="freight-intel-budget-v1141">
      <div><span>PRÓXIMO PRESUPUESTO LOGÍSTICO</span><strong>${money(budget.expectedMid||0)}</strong><p>${fmt.number(budget.orders||0)} pedido(s) nacional(es) activo(s) sin costo real registrado.</p></div>
      <div class="freight-budget-range-v1141"><small>Rango esperado</small><b>${money(budget.expectedLow||0)} – ${money(budget.expectedHigh||0)}</b></div>
    </section>

    <div class="freight-intel-grid-v1141">
      <section class="freight-intel-panel-v1141"><header><div><span>ALERTAS</span><h4>Fletes y entregas que requieren atención</h4></div><b>${alerts.length}</b></header>${alertsHtml(alerts)}</section>
      <section class="freight-intel-panel-v1141"><header><div><span>TRANSPORTADORAS</span><h4>Desempeño económico y predictivo</h4></div></header>${carriersHtml(data.carriers||[])}</section>
      <section class="freight-intel-panel-v1141 wide"><header><div><span>PRECISIÓN MENSUAL</span><h4>Cómo aprende el modelo con datos reales</h4></div></header>${monthlyHtml(data.monthly||[])}</section>
      <section class="freight-intel-panel-v1141"><header><div><span>DESTINOS</span><h4>Costo por kg y participación logística</h4></div></header>${destinationsHtml(data.destinations||[])}</section>
      <section class="freight-intel-panel-v1141"><header><div><span>CLIENTES</span><h4>Costo logístico y ahorro potencial</h4></div></header>${clientsHtml(data.clients||[])}</section>
      <section class="freight-intel-panel-v1141 wide"><header><div><span>ENVÍOS</span><h4>Auditoría predicho vs real</h4></div></header>${rowsHtml(rows)}</section>
    </div>`;
  host.querySelectorAll("[data-fi-order]").forEach(button=>button.onclick=()=>window.dispatchEvent(new CustomEvent("erp:open-order",{detail:button.dataset.fiOrder})));
}

function kpi(label,value,detail,tone=""){
  return `<article class="freight-kpi-v1141 ${tone}"><span>${fmt.escape(label)}</span><strong>${fmt.escape(String(value))}</strong><small>${fmt.escape(detail)}</small></article>`;
}
function toneForError(value){const n=num(value);return n===0?"":n<=15?"good":n<=25?"warn":"danger"}

function alertsHtml(rows){
  if(!rows.length)return empty("Sin alertas logísticas","No hay fletes anómalos ni entregas en riesgo en el rango.");
  return `<div class="freight-alert-list-v1141">${rows.map(row=>`<button data-fi-order="${fmt.escape(row.orderId||"")}" class="freight-alert-v1141 tone-${String(row.anomalyLevel||"normal").toLowerCase()}"><div><strong>${fmt.escape(row.orderNumber||"Pedido")}</strong><span>${fmt.escape(row.carrier||"Sin transportadora")} · ${fmt.escape(row.clientName||"")}</span><small>${fmt.escape(row.anomalyReason||riskLabel(row.deliveryRisk))}</small></div><aside><b>${row.actualCost!=null?money(row.actualCost):riskLabel(row.deliveryRisk)}</b><em>${row.deviationPct!=null?`${pct(row.deviationPct)} vs predicho`:row.estimatedArrivalP80?`P80 ${fmt.date(row.estimatedArrivalP80)}`:""}</em></aside></button>`).join("")}</div>`;
}
function carriersHtml(rows){
  if(!rows.length)return empty("Sin desempeño evaluable","La comparación aparecerá cuando existan costos reales de guías nuevas.");
  return `<div class="freight-rank-list-v1141">${rows.map((row,i)=>`<article><span>${String(i+1).padStart(2,"0")}</span><div><strong>${fmt.escape(row.carrier||"—")}</strong><small>${fmt.number(row.shipments||0)} envíos · error mediano ${pct(row.medianAbsErrorPct)} · a tiempo ${pct(row.onTimePct)}</small></div><aside><b>${money(row.actualCost)}</b><em>Ahorro potencial ${money(row.potentialSavings)}</em></aside></article>`).join("")}</div>`;
}
function monthlyHtml(rows){
  if(!rows.length)return empty("Aún sin meses evaluables","El tablero empezará a medir precisión con cada costo real capturado.");
  const max=Math.max(...rows.map(r=>num(r.actualCost)),1);
  return `<div class="freight-monthly-v1141">${rows.map(row=>`<article><div><strong>${fmt.escape(String(row.month||"").slice(0,7))}</strong><small>${fmt.number(row.evaluated||0)} predicciones · error mediano ${pct(row.medianAbsErrorPct)} · ±25% ${pct(row.within25Pct)}</small></div><div class="freight-bar-v1141"><span style="--fi-size:${Math.max(4,100*num(row.actualCost)/max)}%"></span></div><b>${money(row.actualCost)}</b></article>`).join("")}</div>`;
}
function destinationsHtml(rows){
  if(!rows.length)return empty("Sin costo real por destino","Se calculará automáticamente cuando existan despachos con costo.");
  return `<div class="freight-simple-list-v1141">${rows.slice(0,10).map(row=>`<article><div><strong>${fmt.escape(row.city||"—")}</strong><small>${fmt.escape(row.department||"")} · ${fmt.number(row.shipments||0)} envíos</small></div><aside><b>${row.avgCostPerKg?money(row.avgCostPerKg)+"/kg":"—"}</b><em>${row.avgLogisticsPctOfSale!=null?pct(row.avgLogisticsPctOfSale)+" de venta":""}</em></aside></article>`).join("")}</div>`;
}
function clientsHtml(rows){
  if(!rows.length)return empty("Sin costo logístico por cliente","Aparecerá al vincular fletes reales con facturación.");
  return `<div class="freight-simple-list-v1141">${rows.slice(0,10).map(row=>`<article><div><strong>${fmt.escape(row.clientName||"Cliente")}</strong><small>${fmt.number(row.shipments||0)} envíos · ${row.logisticsPct!=null?pct(row.logisticsPct)+" del valor facturado":"sin ratio"}</small></div><aside><b>${money(row.logisticsCost)}</b><em>Ahorro ${money(row.potentialSavings)}</em></aside></article>`).join("")}</div>`;
}
function rowsHtml(rows){
  if(!rows.length)return empty("Sin envíos nacionales en el rango","El histórico de evaluación comenzará con los pedidos creados desde V11.40.");
  return `<div class="freight-table-wrap-v1141"><table class="data-table freight-table-v1141"><thead><tr><th>Pedido</th><th>Transportadora</th><th>Predicho</th><th>Real</th><th>Desviación</th><th>Ahorro potencial</th><th>Riesgo</th></tr></thead><tbody>${rows.map(row=>`<tr><td><button class="link-btn" data-fi-order="${fmt.escape(row.orderId||"")}">${fmt.escape(row.orderNumber||"—")}</button><small>${fmt.escape(row.clientName||"")}</small></td><td>${fmt.escape(row.carrier||"—")}</td><td>${row.predictedMid!=null?money(row.predictedMid):"—"}</td><td>${row.actualCost!=null?money(row.actualCost):"Pendiente"}</td><td><span class="fi-badge-v1141 tone-${String(row.anomalyLevel||"none").toLowerCase()}">${fmt.escape(anomalyLabel(row.anomalyLevel))}</span>${row.deviationPct!=null?`<small>${pct(row.deviationPct)}</small>`:""}</td><td>${row.potentialSavings!=null?money(row.potentialSavings):"—"}</td><td><span class="fi-badge-v1141 tone-${String(row.deliveryRisk||"").toLowerCase()}">${fmt.escape(riskLabel(row.deliveryRisk))}</span></td></tr>`).join("")}</tbody></table></div>`;
}
function empty(title,detail){return `<div class="freight-empty-v1141"><span>◇</span><div><strong>${fmt.escape(title)}</strong><p>${fmt.escape(detail)}</p></div></div>`}
