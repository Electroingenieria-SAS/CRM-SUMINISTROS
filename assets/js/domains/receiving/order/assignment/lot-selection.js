import { api } from "../../../../services/api.js";
import { fmt } from "../../../../core/format.js";

const epsilon=0.0001;

export async function loadReceptionOriginPlans(lines){
  return Promise.all(lines.map(line=>{
    if(line.requiresCut)return Promise.resolve(null); // Corte administra su propio origen físico.
    if(!line.materialMasterId)throw new Error(`El material ${line.reference||line.description} debe vincularse al maestro oficial antes de asignar un lote.`);
    return api.receptionOriginPlan(line.materialMasterId,line.materialVariantId||null,Number(line.quantity));
  }));
}

export function validateReceptionOriginPlan(plan,origins,required){
  if(!plan)return true;
  if(Number(plan.shortage||0)>epsilon)return origins.length===0;
  const candidates=new Map((plan.candidates||[]).map(item=>[item.lotId,Number(item.available)]));
  const seen=new Set();
  let total=0;
  for(const origin of origins){
    if(!candidates.has(origin.lotId)||seen.has(origin.lotId))return false;
    const amount=Number(origin.quantity);
    if(!Number.isFinite(amount)||amount<=0||amount>candidates.get(origin.lotId)+epsilon)return false;
    seen.add(origin.lotId);
    total+=amount;
  }
  return Math.abs(total-Number(required))<=epsilon;
}

function defaultOrigins(line,plan){
  const saved=Array.isArray(line.receptionOrigins)?line.receptionOrigins:[];
  if(validateReceptionOriginPlan(plan,saved,line.quantity))return saved;
  return plan.suggestedPlan||[];
}

export function receptionOriginCards(lines,plans){
  const entries=lines.map((line,index)=>{
    const plan=plans[index];
    if(!plan)return "";
    const shortage=Number(plan.shortage||0)>epsilon;
    const selected=new Map((shortage?[]:defaultOrigins(line,plan)).map(entry=>[entry.lotId,Number(entry.quantity)]));
    const label=fmt.escape(line.reference||line.sku||line.description||`Material ${index+1}`);
    const quantity=`${fmt.number(line.quantity,3)} ${fmt.escape(line.unit||"UND")}`;
    return `<article class="reception-origin-card" data-reception-origin-index="${index}">
      <header><div><strong>${label}</strong><small>${fmt.escape(line.description||"")} · ${quantity}</small></div><span>${fmt.number(plan.totalAvailable||0,3)} disponibles</span></header>
      ${shortage?`<p class="reception-origin-shortage">Inventario insuficiente para esta línea: faltan ${fmt.number(plan.shortage,3)}. No se asignará un lote inexistente y Alistamiento gestionará la novedad.</p>`:
        `<div class="reception-origin-options">${(plan.candidates||[]).map(candidate=>{
          const amount=selected.get(candidate.lotId)||0;
          const origin=[candidate.warehouseCode,candidate.location,candidate.lotNumber&&`Lote ${candidate.lotNumber}`].filter(Boolean).join(" · ");
          return `<div class="reception-origin-option" data-reception-origin-option>
             <label><input type="checkbox" data-lot-id="${fmt.escape(candidate.lotId)}" ${amount>0?"checked":""}><span><strong>${fmt.escape(origin||"Ubicación sin nombre")}</strong><small>Disponible: ${fmt.number(candidate.available,3)} ${fmt.escape(line.unit||"UND")}</small></span></label>
             <input class="control" data-origin-qty type="number" min="0.0001" max="${Number(candidate.available)}" step="any" value="${amount||""}" ${amount>0?"":"disabled"} aria-label="Cantidad a extraer del lote ${fmt.escape(origin)}">
          </div>`;
        }).join("")}</div><small class="reception-origin-total" data-reception-origin-total></small>`}
    </article>`;
  }).filter(Boolean);
  if(!entries.length)return "";
  return `<section class="reception-origin-section">
    <div class="reception-stage-heading"><div><h4>Lotes de origen para Alistamiento</h4><p>Logística define el lote y la cantidad que el auxiliar deberá recoger. Corte conserva su propio procedimiento.</p></div></div>
    <div class="reception-origin-list">${entries.join("")}</div>
  </section>`;
}

export function bindReceptionOriginCards(host,data,draft,plans,persistDraft){
  const cards=[...host.querySelectorAll("[data-reception-origin-index]")];
  const syncCard=card=>{
    const index=Number(card.dataset.receptionOriginIndex);
    const plan=plans[index];
    const row=draft.lines[index];
    const shortage=Number(plan.shortage||0)>epsilon;
    const origins=shortage?[]:[...card.querySelectorAll("[data-reception-origin-option]")].flatMap(option=>{
      const check=option.querySelector("[data-lot-id]");
      const amount=option.querySelector("[data-origin-qty]");
      amount.disabled=!check.checked;
      if(!check.checked){amount.value="";return [];}
      return [{lotId:check.dataset.lotId,quantity:Number(amount.value)}];
    });
    row.receptionOrigins=origins;
    const valid=validateReceptionOriginPlan(plan,origins,row.quantity);
    const total=origins.reduce((sum,item)=>sum+(Number(item.quantity)||0),0);
    const status=card.querySelector("[data-reception-origin-total]");
    if(status)status.textContent=valid?`Origen completo: ${fmt.number(total,3)} de ${fmt.number(row.quantity,3)}`:`Por asignar: ${fmt.number(total,3)} de ${fmt.number(row.quantity,3)}`;
    card.dataset.originValid=String(valid);
    persistDraft(data.order.id,draft);
  };
  for(const card of cards){
    card.addEventListener("change",()=>syncCard(card));
    card.addEventListener("input",event=>{if(event.target.matches("[data-origin-qty]"))syncCard(card);});
    syncCard(card);
  }
}

export function assertReceptionOriginCards(host,draft,plans){
  for(let i=0;i<plans.length;i++){
    if(!plans[i])continue;
    if(!validateReceptionOriginPlan(plans[i],draft.lines[i].receptionOrigins||[],draft.lines[i].quantity))
      throw new Error(`Revisa los lotes y cantidades de la línea ${i+1} antes de confirmar.`);
  }
}
