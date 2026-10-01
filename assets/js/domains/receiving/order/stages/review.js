import { fmt } from "../../../../core/format.js";
import { readOnlyLines, advisorFiles } from "../ui/order-context.js";

export function reviewStage(data){
  const items=data.items||[];
  return `<section class="reception-stage-card">
    <div class="reception-stage-heading"><div><span class="reception-step-tag">Paso 2 de 4</span><h4>Revisa lo que cargó el asesor</h4><p>Consulta la información y los soportes antes de decidir cómo continuar.</p></div></div>
    <div class="reception-advisor-grid">
      <article><small>Asesor</small><strong>${fmt.escape(data.order.seller_name||data.order.metadata?.sellerName||"Registrado en el pedido")}</strong></article>
      <article><small>Cliente</small><strong>${fmt.escape(data.order.client_name)}</strong></article>
      <article><small>Referencia externa</small><strong>${fmt.escape(data.order.external_reference||"—")}</strong></article>
      <article><small>Materiales informados</small><strong>${items.length}</strong></article>
    </div>
    ${advisorFiles(data.files||[])}
    <div class="reception-current-lines">${readOnlyLines(items)}</div>
    <div class="reception-decision-grid">
      <button type="button" class="reception-decision-card correct" data-info-correct>
        <span>✓</span><strong>Información correcta</strong><small>Conservar exactamente las líneas registradas por el asesor.</small>
      </button>
      <button type="button" class="reception-decision-card assign" data-info-assign>
        <span>PDF</span><strong>Asignar información</strong><small>Leer el PDF, identificar líneas y cortes, y corregir el resultado.</small>
      </button>
    </div>
  </section>`;
}
