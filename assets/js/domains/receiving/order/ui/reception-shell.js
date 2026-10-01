import { fmt } from "../../../../core/format.js";
import { fullDetails, summaryDisclosure } from "./order-context.js";

export function baseShell(data,content,{showDetails=false,stage="STATUS"}={}){
  const order=data.order;
  const nextEnabled=stage!=="STATUS";
  return `<div class="modal-overlay simple-process-overlay">
    <section class="modal simple-process-modal wide reception-process-modal receiving-order receiving-order-focus" data-order-id="${fmt.escape(order.id)}" data-receiving-stage="${fmt.escape(stage)}">
      <header class="modal-head simple-process-head reception-process-head">
        <div><span class="wizard-kicker">RECEPCIÓN DE PEDIDOS</span><h3>${fmt.escape(order.order_number)}</h3><p>${fmt.escape(order.client_name)} · ${fmt.escape(fmt.label(order.order_type_code))}</p></div>
        <button class="icon-btn" data-close aria-label="Cerrar">×</button>
      </header>
      <div class="modal-body simple-process-body reception-process-body">
        ${stage==="TAKE"?"":summaryDisclosure(data)}
        ${content}
        ${showDetails?`<details class="simple-details reception-full-details"><summary>Ver información completa del pedido</summary>${fullDetails(data)}</details>`:""}
      </div>
      ${receptionFooter(order.current_step_code,nextEnabled)}
    </section>
  </div>`;
}

function receptionFooter(step,nextEnabled){
  return `<footer class="modal-foot parallel-work-footer">
    <div class="parallel-work-note"><span aria-hidden="true">⇄</span><div><strong>Trabajo en paralelo habilitado</strong><small>Los pedidos tomados permanecen asignados. Puedes cerrar esta ventana y atender otro sin perder el avance.</small></div></div>
    <div class="parallel-work-actions"><button class="btn btn-ghost" data-take-another="${fmt.escape(String(step||""))}">Cerrar y tomar otro</button><button class="btn btn-primary" data-reception-next ${nextEnabled?"":'disabled aria-disabled="true" title="No hay una acción disponible en este estado"'}>Siguiente</button></div>
  </footer>`;
}

export function bindClose(host){
  host.querySelectorAll("[data-close]").forEach(button=>{button.onclick=()=>host.replaceChildren()});
}

export function bindDisclosureMarkers(host){
  host.querySelectorAll(".reception-summary-disclosure,.reception-disclosure").forEach(details=>{
    const marker=details.querySelector("summary>b");
    if(!marker)return;
    const sync=()=>{marker.textContent=details.open?"−":"+"};
    details.ontoggle=sync;
    sync();
  });
}
