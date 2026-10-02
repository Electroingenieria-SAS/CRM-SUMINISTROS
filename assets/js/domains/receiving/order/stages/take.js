import { fmt } from "../../../../core/format.js";
import { icon } from "../../../../core/icons.js";

function fact(label,value){return `<span><small>${fmt.escape(label)}</small><strong>${fmt.escape(value)}</strong></span>`}

export function takeStage(data,{label="Tomar pedido",blocked=false}={}){
  const order=data.order;
  return `<section class="reception-take-focus">
    <div class="reception-take-main">
      <span class="reception-take-icon" aria-hidden="true">${icon("receiving")}</span>
      <div class="reception-take-copy"><small>PEDIDO A RECIBIR</small><h4>${fmt.escape(order.order_number||"Pedido")}</h4><p>${fmt.escape(order.client_name)} · ${fmt.escape(fmt.label(order.order_type_code))}</p></div>
      <div class="reception-take-facts">${fact("Pago",fmt.payment(order.payment_condition_code))}${fact("Entrega",fmt.route(order.delivery_route_code))}${fact("Responsable",data.assigneeLabel||"—")}${fact("Soportes",String((data.files||[]).length))}</div>
    </div>
    <aside class="reception-take-route"><small>LO QUE HARÁS</small><ol><li><span>1</span><div><strong>Revisar</strong><p>Confirma que la información coincida.</p></div></li><li><span>2</span><div><strong>Corregir si hace falta</strong><p>Usa el PDF solo cuando sea necesario.</p></div></li><li><span>3</span><div><strong>Asignar</strong><p>Envía el pedido al siguiente responsable.</p></div></li></ol></aside>
  </section>
  <section class="reception-take-card reception-take">
    <span class="reception-step-tag">Paso 1 de 4</span><h4>¿Listo para iniciar?</h4><p>Al tomar el pedido quedará reservado para tu gestión.</p>
    <button type="button" class="btn btn-primary reception-take-button reception-main-action reception-primary" data-take-order ${blocked?"disabled":""}><span class="reception-button-icon" aria-hidden="true">${icon("play")}</span><span data-button-label>${fmt.escape(label)}</span></button>
    ${blocked?`<div class="reception-assigned-warning">Este pedido está asignado a <strong>${fmt.escape(data.assigneeLabel||"Sin asignar")}</strong> y tu usuario no tiene permiso para tomarlo.</div>`:""}
  </section>`;
}
