import { fmt } from "../../../../core/format.js";
import { icon } from "../../../../core/icons.js";
import { isPdf, formatBytes } from "../pdf/file-metadata.js";

export function readOnlyLines(items){
  if(!items.length)return '<div class="reception-file-warning"><strong>El asesor no registró materiales.</strong><p>Usa Asignar información para leer el PDF.</p></div>';
  return `<div class="reception-lines-preview">${items.map(item=>`<article><div><strong>${fmt.escape(item.reference||item.sku||item.description)}</strong><p>${fmt.escape(item.description)}</p></div><span>${fmt.number(item.quantity,3)} ${fmt.escape(item.unit||"UND")}</span>${item.requires_cut?'<b>Corte</b>':""}</article>`).join("")}</div>`;
}

export function advisorFiles(files){
  if(!files.length)return '<div class="reception-file-warning"><strong>No hay archivos cargados.</strong><p>La información podrá asignarse manualmente o mediante un PDF local.</p></div>';
  return `<section class="reception-files"><header><strong>Archivos enviados por el asesor</strong><span>${files.length} soporte(s)</span></header><div>${files.map(file=>`<article><span class="reception-file-icon">${isPdf(file)?"PDF":"DOC"}</span><div><strong>${fmt.escape(file.file_name)}</strong><small>${fmt.escape(file.file_category||"EVIDENCE")} · ${formatBytes(file.size_bytes)}</small></div>${file.web_view_link?`<a class="btn btn-ghost" href="${fmt.escape(file.web_view_link)}" target="_blank" rel="noopener">Abrir</a>`:""}</article>`).join("")}</div></section>`;
}

export function fullDetails(data){
  return `<div class="simple-detail-sections"><section><h4>Información principal</h4><div class="detail-grid">${detail("Cliente",data.order.client_name)}${detail("Tipo",fmt.label(data.order.order_type_code))}${detail("Pago",fmt.payment(data.order.payment_condition_code))}${detail("Ruta",fmt.route(data.order.delivery_route_code))}${detail("Creado",fmt.date(data.order.created_at))}</div></section><section><h4>Comentarios y reportes</h4>${(data.comments||[]).length?`<div class="timeline">${data.comments.slice(-8).reverse().map(row=>`<div class="timeline-item"><h4>${fmt.escape(fmt.label(row.type||"Comentario"))} · ${fmt.escape(row.author)}</h4><p>${fmt.escape(row.body)}</p><time>${fmt.date(row.createdAt)}</time></div>`).join("")}</div>`:'<p class="cell-sub">Sin registros.</p>'}</section></div>`;
}

export function detail(label,value){return `<div class="info-box"><label>${fmt.escape(label)}</label><strong>${fmt.escape(value??"—")}</strong></div>`}

export function orderSummary(data){
  const order=data.order;
  return `<section class="reception-order-strip reception-order-summary">
    <div><small>Responsable actual</small><strong>${fmt.escape(data.assigneeLabel||"—")}</strong></div>
    <div><small>Pago</small><strong>${fmt.escape(fmt.payment(order.payment_condition_code))}</strong></div>
    <div><small>Entrega</small><strong>${fmt.escape(fmt.route(order.delivery_route_code))}</strong></div>
    <div><small>Archivos del asesor</small><strong>${(data.files||[]).length}</strong></div>
  </section>`;
}

export function summaryDisclosure(data){
  return `<details class="reception-summary-disclosure">
    <summary><span aria-hidden="true">${icon("orders")}</span><div><strong>Ver resumen del pedido</strong><small>Pago, entrega, responsable y soportes</small></div><b aria-hidden="true">+</b></summary>
    ${orderSummary(data)}
  </details>`;
}

export function disclosure({title,action,iconName,content}){
  return `<details class="reception-disclosure">
    <summary><span aria-hidden="true">${icon(iconName)}</span><div><strong>${fmt.escape(title)}</strong><small>${fmt.escape(action)}</small></div><b aria-hidden="true">+</b></summary>
    ${content}
  </details>`;
}

export function progressBar(stage){
  const current={REVIEW:2,PDF:2,EDIT:3,ASSIGN:4}[stage]||2;
  return `<div class="reception-progress reception-stepper">${["Tomar","Revisar","Corregir","Asignar"].map((label,index)=>`<div class="${index+1<current?"done":index+1===current?"current":""}"><span>${index+1}</span><small>${label}</small></div>`).join("")}</div>`;
}

export function summaryChip(label,value){return `<span class="reception-summary-chip"><small>${fmt.escape(label)}</small><strong>${fmt.escape(value)}</strong></span>`}
