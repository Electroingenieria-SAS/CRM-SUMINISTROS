import { fmt } from "../../../core/format.js";
import { readMaterialPicker } from "../../../services/materials.js";

export function salesMaterialDemand(card){
  const picker=card.querySelector("[data-material-picker]");
  const material=readMaterialPicker(picker,false);
  const mode=card.dataset.mode||"DIRECT";
  if(mode==="CUTS"){
    return [...card.querySelectorAll(".sales-cut-row")].reduce((sum,row)=>sum+(Number(row.querySelector("[data-cut-pieces]").value)||0)*(Number(row.querySelector("[data-cut-length]").value)||0),0);
  }
  return Number(card.querySelector("[data-sales-quantity]").value)||0;
}

export function syncSalesMaterialDemand(card){
  const picker=card.querySelector("[data-material-picker]");
  const material=readMaterialPicker(picker,false);
  const mode=card.dataset.mode||"DIRECT";
  card.querySelectorAll(".sales-cut-row").forEach(row=>{const pieces=Number(row.querySelector("[data-cut-pieces]").value)||0,length=Number(row.querySelector("[data-cut-length]").value)||0;row.querySelector("[data-cut-total]").textContent=`${fmt.number(pieces*length,3)} m`;});
  const total=salesMaterialDemand(card);
  const atp=Number(material.availableToPromise||0);
  const projected=atp-total;
  card.dataset.shortage=String(Math.max(-projected,0));
  const cells=card.querySelectorAll("[data-demand-summary] strong");
  if(cells[0])cells[0].textContent=`${fmt.number(total,3)} ${fmt.escape(material.unit||"UND")}`;
  if(cells[1])cells[1].textContent=`${fmt.number(atp,3)} ${fmt.escape(material.unit||"UND")}`;
  if(cells[2]){cells[2].textContent=`${fmt.number(Math.max(projected,0),3)} ${fmt.escape(material.unit||"UND")}`;cells[2].classList.toggle("warning",projected<0);}
  const status=card.querySelector("[data-demand-status]");
  if(!material.materialMasterId){status.innerHTML="";return}
  if(total<=0){status.className="sales-demand-status neutral";status.innerHTML='<strong>Define la cantidad.</strong><span>La reserva se calculará cuando completes este material.</span>';return}
  if(projected>=0){status.className="sales-demand-status success";status.innerHTML=`<strong>Disponibilidad suficiente</strong><span>Al crear el pedido quedarán reservados ${fmt.number(total,3)} ${fmt.escape(material.unit)} de forma lógica. Logística escogerá el origen físico.</span>`;}
  else{status.className="sales-demand-status warning";status.innerHTML=`<strong>Faltante proyectado: ${fmt.number(Math.abs(projected),3)} ${fmt.escape(material.unit)}</strong><span>El pedido puede registrarse, pero quedará trazada la necesidad por encima de la disponibilidad comercial actual.</span>`;}
}
