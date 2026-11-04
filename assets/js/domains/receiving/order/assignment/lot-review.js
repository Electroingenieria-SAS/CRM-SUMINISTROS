import { fmt } from "../../../../core/format.js";
import { normalizeReceptionLotNumbers, receptionLotNumbersText, validateReceptionLineLots } from "../lines/reception-lot-values.js";

export function receptionLotReviewCards(lines){
  const rows=(lines||[]).map((line,index)=>{
    const name=line.reference||line.sku||line.description||`Material ${index+1}`;
    const lots=receptionLotNumbersText(line.lotNumbers);
    const source=line.lotSource==="PDF"?"Detectado en PDF · verificar":"Ingreso manual";
    return `<article class="reception-lot-review-card" data-reception-lot-index="${index}">
      <div class="reception-lot-review-heading">
        <div><span>MATERIAL ${index+1}</span><strong>${fmt.escape(name)}</strong><small>${fmt.escape(line.description||"")} · ${fmt.number(line.quantity,3)} ${fmt.escape(line.unit||"UND")}</small></div>
        <em>${fmt.escape(source)}</em>
      </div>
      <div class="reception-lot-review-controls">
        <label>Número(s) de lote *<input class="control" type="text" data-reception-lot-input value="${fmt.escape(lots)}" placeholder="Ej. LT-1026, LT-1027" autocomplete="off" maxlength="1024" aria-label="Lotes del material ${index+1}" required><small>Admite varios lotes separados por coma o punto y coma. Puedes corregir los valores extraídos del PDF.</small></label>
        <label class="reception-lot-review-check"><input type="checkbox" data-reception-lot-verified ${line.lotReviewed===true?"checked":""}><span>He revisado el material y confirmé sus números de lote</span></label>
      </div>
      <p class="reception-lot-review-status" aria-live="polite" data-reception-lot-status></p>
    </article>`;
  }).join("");
  return `<section class="reception-lot-review-section" data-reception-lot-review>
    <div class="reception-lot-review-intro"><div><span>CONTROL OBLIGATORIO · DOBLE REVISIÓN</span><h4>Verifica los lotes de cada material</h4><p>El PDF puede proponer los lotes; también puedes ingresarlos manualmente. Revísalos uno por uno antes de enviar el pedido. Esta identificación documental no reemplaza la selección física de inventario.</p></div><strong data-lot-review-progress>0/${(lines||[]).length} verificados</strong></div>
    <div class="reception-lot-review-list">${rows}</div>
  </section>`;
}

export function bindReceptionLotReviewCards(host,data,draft,persistDraft){
  const cards=[...host.querySelectorAll("[data-reception-lot-index]")];
  const sync=()=>{
    let reviewed=0;
    for(const card of cards){
      const index=Number(card.dataset.receptionLotIndex);
      const input=card.querySelector("[data-reception-lot-input]");
      const checkbox=card.querySelector("[data-reception-lot-verified]");
      const line=draft.lines[index];
      const lots=normalizeReceptionLotNumbers(input.value);
      line.lotNumbers=lots;
      line.lotReviewed=checkbox.checked;
      const valid=lots.length>0&&line.lotReviewed&&lots.length<=20&&lots.every(item=>item.length<=80);
      if(valid)reviewed++;
      card.dataset.lotValid=String(valid);
      const status=card.querySelector("[data-reception-lot-status]");
      if(status)status.textContent=!lots.length?"Falta registrar el lote de este material.":!checkbox.checked?"Confirma los lotes después de revisarlos.":valid?"Lotes registrados y verificados.":"Revisa la longitud o cantidad de lotes.";
    }
    const progress=host.querySelector("[data-lot-review-progress]");
    if(progress)progress.textContent=`${reviewed}/${cards.length} verificados`;
  };
  for(const card of cards){
    const index=Number(card.dataset.receptionLotIndex);
    const input=card.querySelector("[data-reception-lot-input]");
    const checkbox=card.querySelector("[data-reception-lot-verified]");
    input.addEventListener("input",()=>{
      checkbox.checked=false;
      draft.lines[index].lotSource="MANUAL";
      card.querySelector("em").textContent="Ajustado manualmente";
      sync();
      persistDraft(data.order.id,draft);
    });
    checkbox.addEventListener("change",()=>{
      sync();
      persistDraft(data.order.id,draft);
    });
  }
  sync();
}

export function assertReceptionLotReview(draft){
  if(!Array.isArray(draft?.lines)||!draft.lines.length)throw new Error("El pedido no tiene materiales para verificar.");
  draft.lines.forEach((line,index)=>validateReceptionLineLots(line,index));
}
