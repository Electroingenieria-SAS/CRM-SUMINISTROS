import { fmt } from "../../../../core/format.js";
import { progress } from "./workflow-header.js";
import { locationSummary, shippingSummary } from "./delivery-summary.js";

export function workspace(data,stage,taskHtml,place){
  return `<section class="shipping-core-workspace-v11107">
    <aside class="shipping-core-context-v11107">${progress(stage)}<div class="shipping-core-context-note-v11107"><strong>Solo lo necesario</strong>Completa la tarea visible a la derecha. Los datos de consulta y las novedades están debajo.</div></aside>
    <section class="shipping-core-task-v11107">${taskHtml}</section>
  </section>${secondaryPanel(data,place)}`;
}

export function secondaryPanel(data,place){
  return `<details class="shipping-core-secondary-v11107">
    <summary><strong>Más información y novedades</strong><small>Destino, trazabilidad, excepciones y datos completos</small></summary>
    <div class="shipping-core-secondary-body-v11107">
      ${locationSummary(place)}
      <div data-order-support-slot></div>
      <div data-order-cancellation-slot></div>
      <details class="simple-details"><summary>Ver información completa del pedido</summary>${shippingSummary(data)}</details>
    </div>
  </details>`;
}

export function destinationCard(place,label="Destino"){
  return `<div class="shipping-core-destination-v11107"><small>${fmt.escape(label)}</small><strong>${fmt.escape(place.municipality||"Municipio no registrado")}${place.department?`, ${fmt.escape(place.department)}`:""}</strong><p>${fmt.escape(place.address||"Dirección no registrada")}</p></div>`;
}
