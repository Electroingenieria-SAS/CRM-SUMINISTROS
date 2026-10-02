import { fmt } from "../../../../core/format.js";
import { state } from "../reports-state.js";
import { safe, num, pct } from "../shared/report-values.js";

export function renderQuality(){
  const quality=state.data.quality||{};
  const values=[
    ["Completitud general",quality.orderFieldCompletenessPct],
    ["Documento cliente",quality.clientDocumentPct],
    ["Ciudad",quality.clientCityPct],
    ["Dirección",quality.clientAddressPct],
    ["Promesa/fecha requerida",quality.promisePct],
    ["Valor de factura",quality.invoiceAmountPct],
    ["Trazabilidad de entrega",quality.deliveryTrackingPct]
  ];
  const valid=values.map(([,value])=>num(value)).filter(Number.isFinite);
  const score=valid.length?valid.reduce((sum,value)=>sum+value,0)/valid.length:0;
  return `<section class="bi-tab-section-v11140">
    <div class="bi-grid-v11140">
      <article class="bi-panel-v11140">
        <header><div><h3>Índice de calidad de información</h3><p>Completitud de campos relevantes para análisis y trazabilidad.</p></div></header>
        <div class="bi-ring-layout-v11140">
          <div class="bi-ring-v11140" style="--value:${Math.max(0,Math.min(100,score))}"><div><strong>${pct(score)}</strong><span>calidad promedio</span></div></div>
          <div class="bi-quality-list-v11140">${values.map(([label,value])=>qualityRow(label,value)).join("")}</div>
        </div>
      </article>
      <article class="bi-panel-v11140">
        <header><div><h3>Excepciones de captura</h3><p>Registros que deben revisarse para mantener KPIs confiables.</p></div></header>
        <div class="bi-insights-v11140">
          ${exceptionCard("Sesiones de tarea abiertas",quality.openTaskSessions)}
          ${exceptionCard("Actividades abiertas",quality.openWorkExecutions)}
          ${exceptionCard("Pedidos sin líneas",quality.ordersWithoutItems)}
          ${exceptionCard("Pedidos sin tareas",quality.ordersWithoutTasks)}
        </div>
      </article>
    </div>
    <div class="bi-data-note-v11140">Un KPI con baja completitud debe interpretarse como una señal de captura insuficiente. El tablero separa la calidad del dato del desempeño para evitar conclusiones incorrectas.</div>
  </section>`;
}

export function qualityRow(label,value){
  const n=num(value);
  return `<div class="bi-quality-row-v11140"><span>${safe(label)}</span><span class="track"><i style="width:${Math.max(0,Math.min(100,n))}%"></i></span><b>${pct(n)}</b></div>`;
}

export function exceptionCard(label,value){
  const n=num(value);
  return `<div class="bi-insight-v11140"><strong>${safe(label)}</strong><p><span class="${n?"bi-number-risk":"bi-number-good"}">${fmt.number(n)}</span> registro(s).</p></div>`;
}
