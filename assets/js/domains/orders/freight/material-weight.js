import { readMaterialPicker } from "../../../services/materials.js";
import { salesMaterialDemand } from "../create/material-demand.js";

export function estimatedSalesWeight(root){
  const cards=[...root.querySelectorAll("[data-sales-material]")];
  let total=0,complete=cards.length>0,weightedLines=0;
  for(const card of cards){
    const material=readMaterialPicker(card.querySelector("[data-material-picker]"),false);
    const demand=salesMaterialDemand(card);
    const weight=Number(material.weight||0);
    if(!material.materialMasterId||!(demand>0)||!(weight>0)){complete=false;continue}
    total+=weight*demand;weightedLines+=1;
  }
  return {weightKg:Math.round(total*1000)/1000,complete:complete&&weightedLines===cards.length,materialCount:cards.length,weightedLines};
}
