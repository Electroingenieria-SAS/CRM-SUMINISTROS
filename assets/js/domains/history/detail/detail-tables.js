import { empty } from "../../../core/ui.js";
import { fmt } from "../../../core/format.js";
import { safe, money, date, dateTime, duration, label } from "../shared/history-values.js";

export function itemsPanel(items){if(!items.length)return empty("Sin materiales registrados","");return table(["Línea","Referencia","Descripción","Cantidad","Unidad","Estado"],items.map(i=>[i.line_number,i.reference||i.sku,i.description,i.quantity,i.unit,label(i.item_status)]))}

export function invoicePanel(rows){if(!rows.length)return empty("Sin facturas registradas","");return table(["Factura","Fecha","Valor","Estado","Peso","Cantidad"],rows.map(i=>[i.invoice_number,date(i.invoice_date),money(i.amount),label(i.status),i.package_weight_kg?`${i.package_weight_kg} kg`:"—",i.package_quantity||"—"]))}

export function deliveryPanel(rows){if(!rows.length)return empty("Sin entregas registradas","");return table(["Ruta","Estado","Transportadora","Guía","Despacho","Entrega","Costo"],rows.map(d=>[fmt.route?.(d.route_code)||label(d.route_code),label(d.status),d.carrier||"—",d.tracking_number||"—",dateTime(d.dispatched_at),dateTime(d.delivered_at),money(d.carrier_cost)]))}

export function tasksPanel(rows){if(!rows.length)return empty("El registro histórico no contiene tareas de flujo","");return `<div class="history-timeline-v11150">${rows.map(t=>`<div><i></i><section><header><strong>${safe(label(t.step_code))}</strong><span>${safe(label(t.status))}</span></header><p>${dateTime(t.started_at||t.assigned_at||t.created_at)} → ${dateTime(t.completed_at)}</p><small>Tiempo de negocio: ${duration(t.business_seconds)}${t.result_code?` · ${safe(label(t.result_code))}`:""}</small></section></div>`).join("")}</div>`}

export function auditPanel(rows){if(!rows.length)return empty("Sin eventos adicionales de auditoría","");return `<div class="history-audit-list-v11150">${rows.map(a=>`<article><time>${dateTime(a.createdAt)}</time><div><strong>${safe(label(a.action))}</strong><span>${safe(a.actor||"Sistema")}</span><pre>${safe(JSON.stringify(a.metadata||a.after||{},null,2))}</pre></div></article>`).join("")}</div>`}

export function table(headers,rows){return `<div class="history-table-wrap-v11150"><table class="history-table-v11150 compact"><thead><tr>${headers.map(h=>`<th>${safe(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(cell=>`<td>${safe(cell??"—")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`}
