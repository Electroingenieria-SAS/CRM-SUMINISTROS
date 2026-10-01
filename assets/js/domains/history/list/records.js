import { fmt } from "../../../core/format.js";
import { state } from "../history-state.js";
import { n, money, duration } from "../shared/history-values.js";
import { kpi, pctOf, facetButtons } from "./facets.js";
import { historyTable, emptyHistory } from "./history-table.js";

export function renderRecords(){
  const d=state.data,s=d.summary||{},rows=d.rows||[];
  const pages=Math.max(1,Math.ceil(n(s.total)/n(d.pageSize||state.pageSize)));
  return `<section class="history-section-v11150">
    <div class="history-kpis-v11150">
      ${kpi("Registros históricos",fmt.number(s.total),`${fmt.number(s.native)} nativos · ${fmt.number(s.imported)} importados`)}
      ${kpi("Clientes únicos",fmt.number(s.uniqueClients),"Según documento disponible")}
      ${kpi("Con entrega confirmada",fmt.number(s.withDelivery),pctOf(s.withDelivery,s.total),"good")}
      ${kpi("Con factura registrada",fmt.number(s.withInvoice),`${money(s.invoiceAmount)} acumulado`,"money")}
      ${kpi("Ciclo promedio",duration(s.avgCycleSeconds),"Creación → cierre", "time")}
    </div>

    <section class="history-facets-v11150">
      <div class="history-facet-group-v11150"><span>Tipo</span>${facetButtons("type",d.facets?.types,state.orderType)}</div>
      <div class="history-facet-group-v11150"><span>Ruta</span>${facetButtons("route",d.facets?.routes,state.route)}</div>
      <div class="history-facet-group-v11150"><span>Ciudad</span>${facetButtons("city",d.facets?.cities,state.city,8)}</div>
    </section>

    <section class="history-panel-v11150 history-ledger-v11150">
      <header><div><h3>Archivo consolidado</h3><p>Registro histórico consultable y trazable. Pulsa cualquier fila para abrir su expediente.</p></div><div class="history-range-v11150">${fmt.number(s.total)} registros · pág. ${state.page}/${pages}</div></header>
      ${rows.length?historyTable(rows):emptyHistory()}
      <footer class="history-pagination-v11150">
        <span>Mostrando ${fmt.number(rows.length)} de ${fmt.number(s.total)}</span>
        <div><button class="btn btn-ghost" data-history-page="${Math.max(1,state.page-1)}" ${state.page<=1?"disabled":""}>Anterior</button><button class="btn btn-ghost" data-history-page="${Math.min(pages,state.page+1)}" ${state.page>=pages?"disabled":""}>Siguiente</button></div>
      </footer>
    </section>
  </section>`;
}
