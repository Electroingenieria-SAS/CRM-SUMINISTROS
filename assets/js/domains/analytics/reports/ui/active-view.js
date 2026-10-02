import { DATASETS } from "../catalog/datasets.js";
import { state, reportsMount } from "../reports-state.js";
import { renderExecutive } from "../views/executive.js";
import { renderOperation } from "../views/operation.js";
import { renderCommercial } from "../views/commercial.js";
import { renderLogistics } from "../views/logistics.js";
import { renderPeople } from "../views/people.js";
import { renderQuality } from "../views/quality.js";
import { renderExplorer, renderExplorerResult } from "../explorer/explorer-view.js";
import { loadExplorer } from "../explorer/load-analysis.js";
import { renderSaved, openSaved, deleteView } from "../saved/saved-views.js";
import { exportDetail } from "../exports/report-export.js";
import { openSaveModal } from "../saved/save-view-dialog.js";

export function renderActive(){
  const content=reportsMount.rootNode?.querySelector("[data-bi-content]");
  if(!content||!state.data)return;
  const renderers={
    executive:renderExecutive,
    operation:renderOperation,
    commercial:renderCommercial,
    logistics:renderLogistics,
    people:renderPeople,
    explorer:renderExplorer,
    quality:renderQuality,
    saved:renderSaved
  };
  content.innerHTML=(renderers[state.tab]||renderExecutive)();
  bindActive();
}

export function bindActive(){
  if(state.tab==="explorer"){
    const dataset=reportsMount.rootNode.querySelector("[data-exp-dataset]");
    dataset?.addEventListener("change",()=>{
      state.explorer.dataset=dataset.value;
      const meta=DATASETS[dataset.value];
      state.explorer.dimension=Object.keys(meta.dimensions)[0];
      state.explorer.metric=Object.keys(meta.metrics)[0];
      state.explorer.result=null;
      renderActive();
    });
    reportsMount.rootNode.querySelector("[data-exp-dimension]")?.addEventListener("change",event=>state.explorer.dimension=event.target.value);
    reportsMount.rootNode.querySelector("[data-exp-metric]")?.addEventListener("change",event=>state.explorer.metric=event.target.value);
    reportsMount.rootNode.querySelector("[data-exp-limit]")?.addEventListener("change",event=>state.explorer.limit=Number(event.target.value));
    reportsMount.rootNode.querySelectorAll("[data-exp-chart]").forEach(button=>button.addEventListener("click",()=>{
      state.explorer.chart=button.dataset.expChart;
      reportsMount.rootNode.querySelectorAll("[data-exp-chart]").forEach(node=>node.classList.toggle("active",node===button));
      if(state.explorer.result)reportsMount.rootNode.querySelector("[data-exp-result]").innerHTML=renderExplorerResult();
    }));
    reportsMount.rootNode.querySelector("[data-exp-run]")?.addEventListener("click",loadExplorer);
    reportsMount.rootNode.querySelector("[data-exp-save]")?.addEventListener("click",openSaveModal);
    reportsMount.rootNode.querySelectorAll("[data-exp-detail]").forEach(button=>button.addEventListener("click",()=>exportDetail(button.dataset.expDetail)));
    if(!state.explorer.result)loadExplorer();
  }

  if(state.tab==="saved"){
    reportsMount.rootNode.querySelectorAll("[data-view-open]").forEach(button=>button.addEventListener("click",()=>openSaved(button.dataset.viewOpen)));
    reportsMount.rootNode.querySelectorAll("[data-view-delete]").forEach(button=>button.addEventListener("click",()=>deleteView(button.dataset.viewDelete)));
  }
}
