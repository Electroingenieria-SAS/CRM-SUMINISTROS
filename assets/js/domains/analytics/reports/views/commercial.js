import { fmt } from "../../../../core/format.js";
import { state } from "../reports-state.js";
import { money } from "../shared/report-values.js";
import { kpi } from "../ui/kpi.js";
import { barPanel } from "../charts/bar-chart.js";

export function renderCommercial(){
  const summary=state.data.summary||{};
  return `<section class="bi-tab-section-v11140">
    <div class="bi-kpis-v11140">
      ${kpi("Facturas",fmt.number(summary.invoiceCount),`${fmt.number(summary.invoicedOrders)} pedidos`)}
      ${kpi("Valor facturado",money(summary.invoiceAmount),"Periodo seleccionado",null,null,"good")}
      ${kpi("Ticket promedio",money(summary.avgTicket),"Por pedido facturado")}
      ${kpi("Pedidos creados",fmt.number(summary.orders),`${fmt.number(summary.closedOrders)} cerrados`)}
    </div>
    <div class="bi-grid-2-v11140">
      ${barPanel("Asesores",state.data.dimensions?.sellers,"Pedidos registrados por asesor")}
      ${barPanel("Clientes",state.data.dimensions?.clients,"Clientes con mayor recurrencia")}
      ${barPanel("Tipos de pedido",state.data.dimensions?.types,"Mezcla de operación")}
      ${barPanel("Rutas de entrega",state.data.dimensions?.routes,"Preferencia de ruta comercial")}
    </div>
  </section>`;
}
