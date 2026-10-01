import { fmt } from "../../../../core/format.js";
import { renderAtRisk, renderSlowest, renderPartials } from "../orders/at-risk.js";

export function flowOrdersHtml(flowView){return `
    <section class="flow-grid-v11120 flow-orders-grid-v11120">
      <article class="flow-panel-v11120">
        <header class="flow-panel-head-v11120 compact">
          <div><span class="flow-section-kicker-v11120">Intervención inmediata</span><h3>Pedidos que requieren atención</h3><p>Priorización por vencimiento de SLA, espera/bloqueo y prioridad del pedido.</p></div>
          <span class="flow-count-v11120">${fmt.number(flowView.atRisk.length)} visibles</span>
        </header>
        ${renderAtRisk(flowView.atRisk)}
      </article>

      <article class="flow-panel-v11120">
        <header class="flow-panel-head-v11120 compact">
          <div><span class="flow-section-kicker-v11120">Verificación extremo a extremo</span><h3>Pedidos con mayor lead time</h3><p>Pedidos cerrados del periodo ordenados por horas laborales de recorrido.</p></div>
          <span class="flow-count-v11120">${fmt.number(flowView.slowest.length)} visibles</span>
        </header>
        ${renderSlowest(flowView.slowest)}
      </article>
    </section>

    `;}

export function flowPartialHtml(flowView){return `${flowView.partials.length?`
      <section class="flow-panel-v11120">
        <header class="flow-panel-head-v11120">
          <div><span class="flow-section-kicker-v11120">Cumplimiento parcial</span><h3>Pedidos con más de una ronda de alistamiento</h3><p>Contrasta la primera salida con el tiempo real requerido para completar el pedido.</p></div>
          <span class="flow-count-v11120">${fmt.number(flowView.partials.length)} pedido(s)</span>
        </header>
        ${renderPartials(flowView.partials)}
      </section>`:`
      <div class="flow-partial-health-v11120" data-partial-health>No hay pedidos parciales registrados en el periodo seleccionado.</div>`}
`;}
