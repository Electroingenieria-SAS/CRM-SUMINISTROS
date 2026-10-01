import { fmt } from "../../../../core/format.js";
import { icon } from "../../../../core/icons.js";
import { readOnlyLines, advisorFiles, disclosure } from "../ui/order-context.js";

export function reviewStage(data){
  const items=data.items||[];
  const reference=data.order.external_reference||"";
  return `<section class="reception-stage-card">
    <div class="reception-stage-heading"><div><span class="reception-step-tag">Paso 2</span><h4>Revisa y decide</h4><p>Si la información coincide, continúa. Si no, revisa el PDF.</p></div></div>
    <div class="reception-advisor-grid reception-advisor-summary">
      <article><small>Asesor</small><strong>${fmt.escape(data.order.seller_name||data.order.metadata?.sellerName||"Registrado en el pedido")}</strong></article>
      ${reference?`<article><small>Referencia externa</small><strong>${fmt.escape(reference)}</strong></article>`:""}
      <article><small>Materiales informados</small><strong>${items.length}</strong></article>
    </div>
    ${disclosure({title:"Soportes del asesor",action:"Abrir archivos",iconName:"imports",content:advisorFiles(data.files||[])})}
    ${disclosure({title:"Materiales del pedido",action:"Ver materiales",iconName:"inventory",content:`<div class="reception-current-lines">${readOnlyLines(items)}</div>`})}
    <div class="reception-decision-grid">
      <button type="button" class="reception-decision-card correct reception-choice success" data-info-correct><span aria-hidden="true">${icon("check")}</span><strong>Todo está correcto</strong><small>Continuar sin modificar materiales.</small></button>
      <button type="button" class="reception-decision-card assign reception-choice secondary" data-info-assign><span aria-hidden="true">${icon("imports")}</span><strong>Revisar con PDF</strong><small>Leer el documento y corregir solo lo necesario.</small></button>
    </div>
  </section>`;
}
