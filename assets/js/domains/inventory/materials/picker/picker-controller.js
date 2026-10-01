import { api } from "../../../../services/api.js";
import { fmt } from "../../../../core/format.js";
import { updateStockLabels } from "../stock/material-stock.js";
import { displayMaterial, hydrateInitial } from "./selected-material.js";
import { readMaterialPicker } from "./read-material.js";

export function bindMaterialPicker(container,{onChange}={}){
  if(!container||container.dataset.materialBound==="1")return;
  container.dataset.materialBound="1";
  const query=container.querySelector("[data-material-query]");
  const results=container.querySelector("[data-material-results]");
  const variant=container.querySelector("[data-material-variant]");
  let timer=null,seq=0;
  const hide=()=>{results.hidden=true;results.innerHTML=""};
  const search=async()=>{
    const text=query.value.trim();
    if(text.length<2){hide();return}
    const request=++seq;
    results.hidden=false;
    results.innerHTML='<div class="material-search-loading">Buscando en el maestro oficial…</div>';
    try{
      const items=await api.materialSearch(text,15);
      if(request!==seq)return;
      results.innerHTML=items.length?items.map(item=>`<button type="button" class="material-result" data-material-result="${fmt.escape(item.id)}">
        <span class="material-result-ref">${fmt.escape(item.reference)}</span>
        <strong>${fmt.escape(item.name)}</strong>
        <small>${fmt.escape(item.unit)}${item.variants?.length?` · ${item.variants.length} variante(s)`:""}</small>
        <div class="material-result-stock"><b>Disponible venta ${Number(item.availableToPromise??item.available??0).toLocaleString("es-CO",{maximumFractionDigits:3})}</b><em>Físico ${Number(item.physicalAvailable||0).toLocaleString("es-CO",{maximumFractionDigits:3})}</em><em>Reservado ERP ${Number(item.erpReserved||0).toLocaleString("es-CO",{maximumFractionDigits:3})}</em></div>
      </button>`).join(""):'<div class="material-search-empty">No existe una coincidencia oficial. Revisa la referencia o el nombre.</div>';
      results.querySelectorAll("[data-material-result]").forEach(button=>button.addEventListener("click",()=>{
        const item=items.find(x=>x.id===button.dataset.materialResult);
        if(!item)return;
        displayMaterial(container,item,null);hide();onChange?.(readMaterialPicker(container,false));
      }));
    }catch(error){results.innerHTML=`<div class="material-search-empty">${fmt.escape(error.message)}</div>`}
  };
  query.addEventListener("input",()=>{
    // Editar el texto después de una selección obliga a volver a escoger el material.
    if(container.__material&&query.value!==`${container.__material.reference} · ${container.__material.name}`){
      container.__material=null;
      container.dataset.materialId="";
      container.dataset.materialReference="";
      container.dataset.materialName="";
      container.dataset.materialVariantId="";
      container.dataset.materialVariantLabel="";
      container.querySelector("[data-material-selected]").hidden=true;
      container.querySelector("[data-material-variant-wrap]").hidden=true;
      container.classList.remove("selected");
      onChange?.(readMaterialPicker(container,false));
    }
    clearTimeout(timer);timer=setTimeout(search,220);
  });
  query.addEventListener("focus",()=>{if(query.value.trim().length>=2&&!container.__material){clearTimeout(timer);timer=setTimeout(search,80)}});
  query.addEventListener("keydown",event=>{if(event.key==="Escape")hide()});
  variant.addEventListener("change",()=>{
    const option=variant.selectedOptions[0];
    container.dataset.materialVariantId=variant.value||"";
    container.dataset.materialVariantLabel=variant.value?(option?.dataset.label||option?.textContent?.split(" · ")[0]||""):"";
    updateStockLabels(container);
    onChange?.(readMaterialPicker(container,false));
  });
  container.addEventListener("focusout",()=>setTimeout(()=>{if(!container.contains(document.activeElement))hide()},0));
  hydrateInitial(container);
}
