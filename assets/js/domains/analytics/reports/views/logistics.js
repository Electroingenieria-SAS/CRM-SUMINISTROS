import { fmt } from "../../../../core/format.js";
import { state } from "../reports-state.js";
import { safe, num, pct, money, hours, pretty, empty } from "../shared/report-values.js";
import { kpi } from "../ui/kpi.js";
import { barPanel } from "../charts/bar-chart.js";

export function renderLogistics(){
  const summary=state.data.summary||{};
  return `<section class="bi-tab-section-v11140">
    <div class="bi-kpis-v11140">
      ${kpi("Entregas registradas",fmt.number(summary.deliveries),`${fmt.number(summary.delivered)} completadas`)}
      ${kpi("Costo de transporte",money(summary.shippingCost),"Costo capturado")}
      ${kpi("Inventario disponible",fmt.number(summary.inventoryAvailable,2),`${fmt.number(summary.inventorySkus)} referencias`,null,null,"good")}
      ${kpi("Inventario reservado",fmt.number(summary.inventoryReserved,2),`Bloqueado: ${fmt.number(summary.inventoryBlocked,2)}`,null,null,"warn")}
    </div>
    <article class="bi-panel-v11140"><header><div><h3>Desempeño logístico por ruta</h3><p>Entregas, cumplimiento, costo y tránsito observado.</p></div></header>${logisticsTable(state.data.logistics||[])}</article>
    <div class="bi-grid-v11140">
      <article class="bi-panel-v11140"><header><div><h3>Referencias con mayor disponibilidad</h3><p>Snapshot actual de inventario.</p></div></header>${inventoryTable(state.data.inventory||[])}</article>
      ${barPanel("Pedidos por ruta",state.data.dimensions?.routes,"Distribución de rutas en pedidos del periodo")}
    </div>
  </section>`;
}

export function logisticsTable(rows){
  if(!rows.length)return empty("No hay entregas registradas en el periodo.");
  return `<div class="bi-table-wrap-v11140"><table class="bi-table-v11140">
    <thead><tr><th>Ruta</th><th>Gestiones</th><th>Entregadas</th><th>Cumplimiento</th><th>Costo</th><th>Tránsito prom.</th></tr></thead>
    <tbody>${rows.map(row=>`<tr><td><strong>${safe(pretty(row.route))}</strong></td><td>${fmt.number(row.deliveries)}</td><td>${fmt.number(row.delivered)}</td><td>${pct(num(row.deliveries)?num(row.delivered)/num(row.deliveries)*100:0)}</td><td>${money(row.carrier_cost)}</td><td>${hours(row.avg_transit_seconds)}</td></tr>`).join("")}</tbody>
  </table></div>`;
}

export function inventoryTable(rows){
  if(!rows.length)return empty("No hay inventario disponible.");
  return `<div class="bi-table-wrap-v11140"><table class="bi-table-v11140">
    <thead><tr><th>Referencia</th><th>Descripción</th><th>Disponible</th><th>Reservado</th><th>Bloqueado</th><th>Lotes</th></tr></thead>
    <tbody>${rows.map(row=>`<tr><td><strong>${safe(row.reference)}</strong><small>${safe(row.unit)}</small></td><td>${safe(row.description)}</td><td>${fmt.number(row.available,2)}</td><td>${fmt.number(row.reserved,2)}</td><td>${fmt.number(row.blocked,2)}</td><td>${fmt.number(row.lots)}</td></tr>`).join("")}</tbody>
  </table></div>`;
}
