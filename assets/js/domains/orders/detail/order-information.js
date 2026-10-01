import { fmt } from "../../../core/format.js";
import { empty } from "../../../core/ui.js";

export function simpleDetails(data){
  const o=data.order;
  return `<div class="simple-detail-sections"><section><h4>Información principal</h4><div class="detail-grid">${info("Cliente",o.client_name)}${info("Tipo",fmt.label(o.order_type_code))}${info("Pago",fmt.payment(o.payment_condition_code))}${info("Ruta",fmt.route(o.delivery_route_code))}${info("Prioridad",fmt.label(o.priority))}${info("Creado",fmt.date(o.created_at))}</div></section><section><h4>Materiales</h4>${itemsTable(data.items||[])}</section><section><h4>Últimos movimientos</h4>${eventsMini(data.events||[])}</section><section><h4>Comentarios</h4>${commentsMini(data.comments||[])}</section></div>`;
}

export function info(label,value){return `<div class="info-box"><label>${fmt.escape(label)}</label><strong>${fmt.escape(value??"—")}</strong></div>`}

export function itemsTable(items){return items.length?`<div class="table-wrap mobile-card-table"><table><thead><tr><th>Material</th><th>Cantidad</th><th>Corte</th></tr></thead><tbody>${items.map(item=>`<tr><td data-label="Material"><strong>${fmt.escape(item.sku||item.description)}</strong><div class="cell-sub">${fmt.escape(item.description)}</div></td><td data-label="Cantidad">${fmt.number(item.quantity,3)} ${fmt.escape(item.unit)}</td><td data-label="Corte">${item.requires_cut?"Sí":"No"}</td></tr>`).join("")}</tbody></table></div>`:empty("Sin materiales")}

export function eventsMini(events){return events.length?`<div class="timeline">${events.slice(-8).reverse().map(event=>`<div class="timeline-item"><h4>${fmt.escape(fmt.action(event.actionCode||event.eventType))}</h4><p>${fmt.escape(event.actorName||"Sistema")}</p><time>${fmt.date(event.createdAt)}</time></div>`).join("")}</div>`:empty("Sin movimientos")}

export function commentsMini(rows){return rows.length?`<div class="timeline">${rows.slice(-6).reverse().map(row=>`<div class="timeline-item"><h4>${fmt.escape(row.author)}</h4><p>${fmt.escape(row.body)}</p><time>${fmt.date(row.createdAt)}</time></div>`).join("")}</div>`:empty("Sin comentarios")}
