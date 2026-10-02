import { fmt } from "../../../core/format.js";

export function itemRow(item,index,saved={}){
  const result=saved?.result||"";
  const novelty=saved?.novelty||item.metadata?.lastNovelty||"";
  const noveltyId=`picking-novelty-${index+1}`;
  return `<article class="picking-item-row" data-picking-item data-item-id="${fmt.escape(item.id)}" data-result="${fmt.escape(result)}" data-requires-cut="${item.requires_cut?"true":"false"}">
    <div class="picking-item-number">${index+1}</div>
    <div class="picking-item-data">
      <div><small>Referencia</small><strong>${fmt.escape(item.reference||item.sku||"—")}</strong></div>
      <div class="description"><small>Mercancía</small><strong>${fmt.escape(item.description)}</strong></div>
      <div><small>Cantidad</small><strong>${fmt.number(item.quantity,3)} ${fmt.escape(item.unit)}</strong></div>
      ${item.requires_cut?`<div><small>Origen</small><strong>Corte define el carreto</strong></div><div><small>Corte</small><strong>${item.requested_cut_length?`${fmt.number(item.requested_cut_length,3)} ${fmt.escape(item.unit)}`:"Requiere corte"}</strong></div>`:`<div><small>Origen físico</small><strong>Se confirma al encontrar</strong></div>`}
    </div>
    <div class="picking-mini-actions">
      <button type="button" class="picking-result found ${result==="FOUND"?"selected":""}" data-result="FOUND" aria-pressed="${result==="FOUND"?"true":"false"}"><span class="picking-result-icon" aria-hidden="true">✓</span><span>Encontrado</span></button>
      <button type="button" class="picking-result missing ${result==="MISSING"?"selected":""}" data-result="MISSING" aria-pressed="${result==="MISSING"?"true":"false"}"><span class="picking-result-icon" aria-hidden="true">!</span><span>No encontrado</span></button>
    </div>
    ${item.requires_cut?`<div class="picking-cut-origin-note" ${result==="FOUND"?"":"hidden"}><strong>Origen trazado por Corte</strong><span>El carreto y el consumo físico ya quedaron registrados en el subflujo de Corte.</span></div>`:`<div class="picking-origin" data-origin-wrap ${result==="FOUND"?"":"hidden"}><div class="picking-origin-loading">Marca Encontrado para consultar lotes y ubicaciones oficiales.</div></div>`}
    <div class="picking-novelty" data-novelty-wrap ${result==="MISSING"?"":"hidden"}>
      <label for="${noveltyId}">¿Por qué no se encontró? *</label>
      <textarea id="${noveltyId}" class="control" rows="2" placeholder="Ejemplo: referencia agotada, ubicación vacía o cantidad incompleta" ${result==="MISSING"?"required":""}>${fmt.escape(novelty)}</textarea>
      <small>El faltante quedará trazado en esta ronda y podrá generar una salida parcial.</small>
    </div>
  </article>`;
}
