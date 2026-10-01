import { fmt } from "../../../../core/format.js";
import { num } from "../shared/flow-values.js";
import { coverageLabel } from "../ui/metric.js";

export function flowTraceabilityHtml(flowView){return `
    <section class="flow-verification-v11120">
      <header>
        <div><span class="flow-section-kicker-v11120">Trazabilidad del cálculo</span><h3>Verificación del análisis</h3></div>
        <span class="flow-coverage-v11120 ${flowView.coverageClass}">${coverageLabel(flowView.coverageClass)}</span>
      </header>
      <div class="flow-verification-grid-v11120">
        <div><small>Periodo</small><strong>${fmt.escape(String(flowView.range.from||"—"))} → ${fmt.escape(String(flowView.range.to||"—"))}</strong><span>${fmt.number(flowView.range.days||0)} día(s)</span></div>
        <div><small>Tareas terminadas</small><strong>${fmt.number(flowView.completed)}</strong><span>${fmt.number(flowView.steps.filter(step=>num(step.tasks)>0).length)} etapa(s) con muestra</span></div>
        <div><small>Pedidos cerrados</small><strong>${fmt.number(flowView.closed)}</strong><span>${fmt.number(flowView.summary.ordersWithPromise||0)} con promesa registrada</span></div>
        <div><small>Último cálculo</small><strong>${fmt.date(flowView.data.generatedAt)}</strong><span>Calendario laboral institucional</span></div>
      </div>
      <p class="flow-method-note-v11120"><strong>Método:</strong> toque = sesiones trabajadas; lead time de etapa = creación de tarea → finalización dentro del calendario laboral; espera = lead time de etapa − toque; lead time del pedido = creación → cierre. Los pedidos visibles permiten abrir el detalle original para contrastar la trazabilidad.</p>
    </section>`;}
