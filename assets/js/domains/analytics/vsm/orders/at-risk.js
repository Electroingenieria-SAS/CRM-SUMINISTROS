import { fmt, priorityBadge, statusBadge } from "../../../../core/format.js";
import { num, hoursLabel } from "../shared/flow-values.js";

export function renderAtRisk(rows){
  if(!rows.length)return `<div class="flow-empty-v11120 good">No hay pedidos visibles con presión operativa en este momento.</div>`;
  return `<div class="table-wrap flow-table-wrap-v11120"><table class="flow-table-v11120 flow-order-table-v11120"><thead><tr><th>Pedido</th><th>Etapa</th><th>Estado</th><th>Aging</th><th>SLA</th><th>Responsable</th><th></th></tr></thead><tbody>${rows.map(row=>`
    <tr>
      <td data-label="Pedido"><strong>${fmt.escape(row.orderNumber)}</strong><small>${fmt.escape(row.clientName||"")}</small>${priorityBadge(row.priority)}</td>
      <td data-label="Etapa">${fmt.escape(row.stepName||fmt.step(row.stepCode))}</td>
      <td data-label="Estado">${statusBadge(row.status)}</td>
      <td data-label="Aging"><b class="${num(row.overdueHours)>0?"danger":""}">${hoursLabel(row.ageBusinessHours)}</b>${num(row.overdueHours)>0?`<small>+${hoursLabel(row.overdueHours)} sobre SLA</small>`:""}</td>
      <td data-label="SLA">${row.slaHours?hoursLabel(row.slaHours):"—"}</td>
      <td data-label="Responsable">${fmt.escape(row.assigneeName||"Sin asignar")}</td>
      <td data-label="Acción"><button class="btn btn-ghost flow-open-order-v11120" data-open-flow-order="${fmt.escape(row.orderId)}">Abrir</button></td>
    </tr>`).join("")}</tbody></table></div>`;
}

export function renderSlowest(rows){
  if(!rows.length)return `<div class="flow-empty-v11120">No hay pedidos cerrados visibles en el periodo.</div>`;
  return `<div class="table-wrap flow-table-wrap-v11120"><table class="flow-table-v11120 flow-order-table-v11120"><thead><tr><th>Pedido</th><th>Ruta</th><th>Lead laboral</th><th>Tiempo calendario</th><th>Promesa</th><th></th></tr></thead><tbody>${rows.map(row=>`
    <tr>
      <td data-label="Pedido"><strong>${fmt.escape(row.orderNumber)}</strong><small>${fmt.escape(row.clientName||"")}</small></td>
      <td data-label="Ruta">${fmt.escape(fmt.route(row.route))}</td>
      <td data-label="Lead laboral"><b>${hoursLabel(row.leadBusinessHours)}</b></td>
      <td data-label="Tiempo calendario">${hoursLabel(row.elapsedHours)}</td>
      <td data-label="Promesa">${row.promisedAt?`${row.onTime===true?'<span class="success">A tiempo</span>':row.onTime===false?'<span class="danger">Fuera de promesa</span>':"—"}<small>${fmt.date(row.promisedAt)}</small>`:"Sin promesa"}</td>
      <td data-label="Acción"><button class="btn btn-ghost flow-open-order-v11120" data-open-flow-order="${fmt.escape(row.orderId)}">Abrir</button></td>
    </tr>`).join("")}</tbody></table></div>`;
}

export function renderPartials(rows){
  return `<div class="table-wrap flow-table-wrap-v11120"><table class="flow-table-v11120"><thead><tr><th>Pedido</th><th>Cliente</th><th>Rondas</th><th>Primera salida</th><th>Tiempo real</th><th>Pendientes</th><th>Resultado</th></tr></thead><tbody>${rows.map(row=>`
    <tr><td data-label="Pedido"><strong>${fmt.escape(row.orderNumber)}</strong></td><td data-label="Cliente">${fmt.escape(row.clientName||"")}</td><td data-label="Rondas">${fmt.number(row.roundCount)}</td><td data-label="Primera salida">${hoursLabel(row.partialHours)}</td><td data-label="Tiempo real"><b>${hoursLabel(row.realHours)}</b></td><td data-label="Pendientes">${fmt.number(row.pendingItemCount)}</td><td data-label="Resultado"><span class="order-partial-tag">${row.status==="COMPLETE"?"Completado":"Pedido parcial"}</span></td></tr>`).join("")}</tbody></table></div>`;
}
