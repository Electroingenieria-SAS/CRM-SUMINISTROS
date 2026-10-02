import { fmt } from "../../../core/format.js";
import { can } from "../../../core/state.js";
import { safe, money, date, label, sourceLabel, sourceClass, statusClass } from "../shared/history-values.js";

export function historyTable(rows){
  return `<div class="history-table-wrap-v11150"><table class="history-table-v11150">
    <thead><tr><th>Origen</th><th>Pedido / cliente</th><th>Tipo y ruta</th><th>Estado</th><th>Valor</th><th>Expediente</th><th>Fecha histórica</th><th></th></tr></thead>
    <tbody>${rows.map(row=>`<tr data-history-open="${safe(row.id)}">
      <td><span class="history-source-v11150 ${sourceClass(row.source)}">${sourceLabel(row.source)}</span>${row.importFileName?`<small>${safe(row.importFileName)}</small>`:""}</td>
      <td><strong>${safe(row.orderNumber)}</strong><span>${safe(row.clientName)}</span><small>${safe(row.clientDocument||row.clientCity||"")}</small></td>
      <td><strong>${safe(label(row.orderType))}</strong><span>${safe(fmt.route?.(row.route)||label(row.route))}</span></td>
      <td><span class="history-status-v11150 ${statusClass(row.status)}">${safe(label(row.status))}</span></td>
      <td><strong>${money(row.invoiceAmount)}</strong><small>${fmt.number(row.itemLines)} línea(s)</small></td>
      <td><span>${fmt.number(row.taskCount)} tareas</span><small>${row.deliveredAt?`Entregado ${date(row.deliveredAt)}`:"Sin entrega registrada"}</small></td>
      <td><strong>${date(row.closedAt||row.cancelledAt||row.updatedAt)}</strong><small>Creado ${date(row.createdAt)}</small></td>
      <td><button class="history-open-btn-v11150" data-history-open="${safe(row.id)}" aria-label="Abrir expediente">→</button></td>
    </tr>`).join("")}</tbody>
  </table></div>`;
}

export function emptyHistory(){
  return `<div class="history-empty-v11150"><div class="history-empty-icon-v11150">▦</div><h3>No hay registros con estos filtros</h3><p>El archivo puede estar vacío o los criterios actuales no encontrar coincidencias.</p>${can("imports","canCreate")?'<button class="btn btn-primary" data-history-import-empty>Importar histórico</button>':""}</div>`;
}
