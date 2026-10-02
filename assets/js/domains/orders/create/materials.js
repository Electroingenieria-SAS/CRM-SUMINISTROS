import { bindMaterialPicker, readMaterialPicker } from "../../../services/materials.js";
import { salesMaterialCardHtml } from "./material-card.js";
import { syncSalesMaterialDemand } from "./material-demand.js";

export function bindSalesMaterialCard(card){
  const picker=card.querySelector("[data-material-picker]");
  const demand=card.querySelector("[data-sales-demand]");
  const modeWrap=card.querySelector("[data-sales-mode-wrap]");
  const quantity=card.querySelector("[data-sales-quantity]");
  const unitLabel=card.querySelector("[data-sales-unit]");
  const cutList=card.querySelector("[data-cut-list]");
  const addCut=()=>{
    const row=document.createElement("div");row.className="sales-cut-row";
    row.innerHTML=`<label><span>Piezas</span><input class="control" data-cut-pieces type="number" min="1" step="1" value="1"></label><span class="sales-cut-x">×</span><label><span>Longitud</span><div class="sales-quantity-control"><input class="control" data-cut-length type="number" min="0.0001" step="any" placeholder="0"><b>m</b></div></label><strong data-cut-total>0 m</strong><button type="button" class="icon-btn" data-remove-cut aria-label="Eliminar medida">×</button>`;
    cutList.append(row);
    row.querySelector("[data-remove-cut]").onclick=()=>{row.remove();syncSalesMaterialDemand(card)};
    row.querySelectorAll("input").forEach(input=>input.addEventListener("input",()=>syncSalesMaterialDemand(card)));
    syncSalesMaterialDemand(card);
  };
  bindMaterialPicker(picker,{onChange:()=>{
    const material=readMaterialPicker(picker,false);
    if(!material.materialMasterId){demand.hidden=true;return}
    demand.hidden=false;unitLabel.textContent=material.unit||"UND";
    const metric=String(material.unit||"").toUpperCase()==="M";
    modeWrap.hidden=!metric;
    if(!metric){card.dataset.mode="DIRECT";card.querySelectorAll("[data-sales-mode]").forEach(button=>button.classList.toggle("active",button.dataset.salesMode==="DIRECT"));}
    syncSalesMaterialMode(card);
    syncSalesMaterialDemand(card);
  }});
  card.querySelectorAll("[data-sales-mode]").forEach(button=>button.addEventListener("click",()=>{
    card.dataset.mode=button.dataset.salesMode;
    card.querySelectorAll("[data-sales-mode]").forEach(item=>item.classList.toggle("active",item===button));
    if(card.dataset.mode==="CUTS"&&!cutList.children.length)addCut();
    syncSalesMaterialMode(card);syncSalesMaterialDemand(card);
  }));
  card.querySelector("[data-add-cut]").onclick=addCut;
  quantity.addEventListener("input",()=>syncSalesMaterialDemand(card));
  card.querySelector("[data-remove-material]").onclick=()=>{const editor=card.parentElement;card.remove();renumberItems(editor)};
}

export function syncSalesMaterialMode(card){
  const mode=card.dataset.mode||"DIRECT";
  card.querySelector("[data-direct-demand]").hidden=mode!=="DIRECT";
  card.querySelector("[data-cuts-demand]").hidden=mode!=="CUTS";
}

export function renumberItems(editor){[...editor.querySelectorAll(".item-row-number")].forEach((element,index)=>element.textContent=String(index+1))}

export function bindOrderMaterials(assistant,scheduleFreightEstimate){
const editor=assistant.root.querySelector("#items-editor");
editor?.addEventListener("input",scheduleFreightEstimate);
editor?.addEventListener("change",scheduleFreightEstimate);
editor?.addEventListener("material:selected",scheduleFreightEstimate);
editor?.addEventListener("click",()=>setTimeout(scheduleFreightEstimate,0));
const add=()=>{
    const card=document.createElement("article");
    card.className="sales-material-card";
    card.dataset.salesMaterial="";
    card.dataset.mode="DIRECT";
    card.innerHTML=salesMaterialCardHtml();
    editor.append(card);
    bindSalesMaterialCard(card);
    renumberItems(editor);
  };
assistant.root.querySelector("#add-item").onclick=add;
add();
}
