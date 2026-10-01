import { api } from "../../../services/api.js";
import { fmt } from "../../../core/format.js";
import { readOrigins } from "./origin-selection.js";

export async function loadOriginPlan(row,item,savedOrigins=[]){
  if(!row||!item||item.requires_cut)return;
  const wrap=row.querySelector("[data-origin-wrap]");if(!wrap)return;
  wrap.hidden=false;
  if(row.dataset.originLoaded==="true")return;
  row.dataset.originLoaded="loading";
  wrap.innerHTML='<div class="picking-origin-loading">Consultando inventario oficial y ubicación…</div>';
  const plan=await api.pickingOriginPlan(item.id);
  row.__originPlan=plan;
  const candidates=plan.candidates||[];
  const savedMap=new Map((savedOrigins||[]).map(origin=>[origin.lotId,Number(origin.quantity||0)]));
  const suggestedMap=new Map((plan.suggestedPlan||[]).map(origin=>[origin.lotId,Number(origin.quantity||0)]));
  const selection=savedMap.size?savedMap:suggestedMap;
  if(!candidates.length){
    wrap.innerHTML=`<div class="picking-origin-empty"><strong>Sin existencia física disponible</strong><span>Marca No encontrado o registra una Novedad si el inventario físico no coincide.</span></div>`;
    row.dataset.originLoaded="true";return;
  }
  wrap.innerHTML=`<div class="picking-origin-head"><div><strong>Origen físico</strong><p>El ERP propone de dónde tomar la mercancía. Puedes cambiarlo si físicamente la encuentras en otra ubicación.</p></div><span>${fmt.number(plan.required,3)} ${fmt.escape(plan.unit)}</span></div>
    ${Number(plan.shortage||0)>0?`<div class="picking-origin-shortage">El inventario actual no alcanza: faltan ${fmt.number(plan.shortage,3)} ${fmt.escape(plan.unit)}.</div>`:""}
    <div class="picking-origin-options">${candidates.map(candidate=>{const qty=selection.get(candidate.lotId)||0;return `<div class="picking-origin-option ${qty>0?"selected":""}" data-origin-option>
      <input type="checkbox" data-origin-check value="${fmt.escape(candidate.lotId)}" ${qty>0?"checked":""}>
      <span class="picking-origin-loc"><strong>${fmt.escape([candidate.warehouseCode,candidate.location].filter(Boolean).join(" · ")||"Ubicación")}</strong><small>${fmt.escape([candidate.locationName,candidate.lotNumber&&`Lote ${candidate.lotNumber}`,candidate.serialNumber].filter(Boolean).join(" · ")||"Sin detalle adicional")}</small></span>
      <span class="picking-origin-available">Disp. <b>${fmt.number(candidate.available,3)}</b></span>
      <label class="picking-origin-qty"><small>Tomar</small><input class="control" data-origin-qty type="number" min="0" max="${Number(candidate.available)}" step="any" value="${qty||""}" ${qty>0?"":"disabled"}></label>
      ${candidate.recommended?'<em>Recomendado</em>':""}
    </label>`}).join("")}</div>
    <div class="picking-origin-total" data-origin-total></div>`;
  row.dataset.originLoaded="true";
  const update=()=>{
    wrap.querySelectorAll("[data-origin-option]").forEach(option=>{const check=option.querySelector("[data-origin-check]"),input=option.querySelector("[data-origin-qty]");input.disabled=!check.checked;if(!check.checked)input.value="";option.classList.toggle("selected",check.checked)});
    const origins=readOrigins(row),sum=origins.reduce((acc,origin)=>acc+origin.quantity,0),required=Number(plan.required||item.quantity||0),valid=Math.abs(sum-required)<=0.0001;
    row.dataset.originValid=String(valid);
    const total=wrap.querySelector("[data-origin-total]");if(total){total.className=`picking-origin-total ${valid?"valid":"invalid"}`;total.innerHTML=`<span>Asignado <strong>${fmt.number(sum,3)} / ${fmt.number(required,3)} ${fmt.escape(plan.unit)}</strong></span><b>${valid?"Origen completo":"Ajusta las cantidades"}</b>`;}
    row.dispatchEvent(new CustomEvent("picking:origin-change",{bubbles:true}));
  };
  wrap.querySelectorAll("[data-origin-check]").forEach(check=>check.addEventListener("change",update));
  wrap.querySelectorAll("[data-origin-qty]").forEach(input=>input.addEventListener("input",update));
  update();
}
