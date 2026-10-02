import { fmt } from "../../../../core/format.js";
import { toast } from "../../../../core/ui.js";
import { state, reportsMount } from "../reports-state.js";
import { safe, empty } from "../shared/report-values.js";
import { rpc } from "../data/report-rpc.js";
import { loadViews } from "../data/load-dashboard.js";
import { renderActive } from "../ui/active-view.js";

export function renderSaved(){
  const rows=state.views||[];
  return `<section class="bi-tab-section-v11140"><article class="bi-panel-v11140">
    <header><div><h3>Vistas guardadas</h3><p>Configuraciones propias y vistas compartidas del Explorador BI.</p></div><span>${fmt.number(rows.length)} vista(s)</span></header>
    ${rows.length?`<div class="bi-view-list-v11140">${rows.map(view=>`<article class="bi-view-card-v11140">
      <h4>${safe(view.name)}</h4><p>${safe(view.description||"Vista de análisis guardada")}</p>
      <div class="bi-view-meta-v11140"><span>${view.isShared?"Compartida":"Privada"}</span><span>${safe(view.ownerName)}</span></div>
      <div class="bi-view-actions-v11140"><button class="btn btn-primary" data-view-open="${safe(view.id)}">Abrir</button>${view.canEdit?`<button class="btn btn-ghost" data-view-delete="${safe(view.id)}">Eliminar</button>`:""}</div>
    </article>`).join("")}</div>`:empty("Todavía no hay vistas guardadas. Crea una desde Explorador BI.")}
  </article></section>`;
}

export function openSaved(id){
  const view=state.views.find(item=>item.id===id);
  if(!view)return;
  const config=view.config||{};
  state.explorer={...state.explorer,...config,result:null};
  if(config.from&&config.to){
    state.from=config.from;state.to=config.to;
    reportsMount.rootNode.querySelector("[data-bi-from]").value=state.from;
    reportsMount.rootNode.querySelector("[data-bi-to]").value=state.to;
  }
  state.tab="explorer";
  reportsMount.rootNode.querySelectorAll("[data-bi-tab]").forEach(node=>node.classList.toggle("active",node.dataset.biTab==="explorer"));
  renderActive();
}

export async function deleteView(id){
  if(!confirm("¿Eliminar esta vista guardada?"))return;
  try{
    await rpc("erp_x_reports_views",{p_action:"DELETE",p_payload:{id}});
    await loadViews();
    renderActive();
    toast("Vista eliminada.");
  }catch(error){toast(error.message,"error",7000)}
}
