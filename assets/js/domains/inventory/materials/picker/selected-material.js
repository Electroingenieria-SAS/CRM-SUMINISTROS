import { api } from "../../../../services/api.js";
import { fmt } from "../../../../core/format.js";
import { updateStockLabels } from "../stock/material-stock.js";
import { readMaterialPicker } from "./read-material.js";

export function displayMaterial(container,material,preferredVariantId=null){
  container.__material=material;
  container.dataset.materialId=material.id||"";
  container.dataset.materialReference=material.reference||"";
  container.dataset.materialName=material.name||"";
  container.dataset.materialUnit=material.unit||"UND";
  container.dataset.materialWeight=String(Number(material.weight||0));
  const query=container.querySelector("[data-material-query]");
  if(query)query.value=`${material.reference} · ${material.name}`;
  const selected=container.querySelector("[data-material-selected]");
  if(selected)selected.hidden=false;
  container.classList.add("selected");
  container.querySelector("[data-material-reference-label]").textContent=material.reference||"—";
  container.querySelector("[data-material-name-label]").textContent=material.name||"—";
  container.querySelector("[data-material-unit-label]").textContent=material.unit||"UND";
  const variants=Array.isArray(material.variants)?material.variants:[];
  const wrap=container.querySelector("[data-material-variant-wrap]");
  const select=container.querySelector("[data-material-variant]");
  container.dataset.variantRequired=variants.length>1?"true":"false";
  if(!variants.length){
    wrap.hidden=true;
    select.innerHTML='<option value="">Sin variante</option>';
    container.dataset.materialVariantId="";
    container.dataset.materialVariantLabel="";
  }else{
    wrap.hidden=false;
    select.innerHTML=`<option value="">${variants.length>1?"Selecciona color / variante":"Variante"}</option>${variants.map(v=>`<option value="${fmt.escape(v.id)}" data-label="${fmt.escape(v.label)}">${fmt.escape(v.label)} · disp. ${Number(v.availableToPromise??v.available??0).toLocaleString("es-CO",{maximumFractionDigits:3})}</option>`).join("")}`;
    let target=preferredVariantId||container.dataset.materialVariantId||"";
    if(!target&&variants.length===1)target=variants[0].id;
    if(target&&variants.some(v=>v.id===target))select.value=target;
    else select.value="";
    const option=select.selectedOptions[0];
    container.dataset.materialVariantId=select.value||"";
    container.dataset.materialVariantLabel=select.value?(option?.dataset.label||option?.textContent?.split(" · ")[0]||""):"";
  }
  updateStockLabels(container);
  container.dispatchEvent(new CustomEvent("material:selected",{bubbles:true,detail:readMaterialPicker(container,false)}));
}

export async function hydrateInitial(container){
  const id=container.dataset.materialId;
  const reference=container.dataset.materialReference;
  if(!id&&!reference)return;
  try{
    const results=await api.materialSearch(reference||"",20);
    const match=(results||[]).find(item=>item.id===id)||(results||[]).find(item=>item.reference===reference);
    if(match)displayMaterial(container,match,container.dataset.materialVariantId||null);
  }catch(error){console.warn("No fue posible hidratar material oficial",error)}
}
