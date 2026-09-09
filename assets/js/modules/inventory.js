import {renderInventoryOperator} from "./inventory-operator-v11230.js";
import {renderInventoryPlan} from "./inventory-plan-v11232.js";
import {renderInventoryReview} from "./inventory-review-v11230.js";
import {renderInventoryStock} from "./inventory-stock-v11230.js";
import {renderInventoryControl} from "./inventory-control-v11230.js";
import {state} from "../core/state.js";
import {empty,loading,toast} from "../core/ui.js";

const CONTROL_ROLES=new Set(["jefe_logistica","lider_logistica","coordinador_logistico","auditoria","gerencia","super_admin"]);
const roles=()=>state.profile?.roles||[];
const isController=()=>roles().some(role=>CONTROL_ROLES.has(role));
const isSuperAdmin=()=>roles().includes("super_admin");
const isBlindOperator=()=>roles().includes("aux_logistica")&&!isController();
const KEY="crm_inventory_view_v11232";

export async function renderInventory(root){
  const controller=isController(),operator=isBlindOperator(),superAdmin=isSuperAdmin();
  let views=[];
  if(operator)views=[["count","Contar"],["labels","Etiquetas"]];
  else if(controller)views=[["plan","Plan de conteos"],["review","Revisión"],...(superAdmin?[["express","Conteo exprés"]]:[]),["stock","Existencias"],["control","Inteligencia"]];
  else{
    root.innerHTML=empty("Inventario restringido","Tu perfil no tiene una experiencia de Inventario asignada.");
    return;
  }
  let current=sessionStorage.getItem(KEY);
  if(!views.some(([id])=>id===current))current=views[0][0];

  root.innerHTML=`<section class="inventory-filter-shell-v11109"><div class="inventory-search-main-v11109"><label>Inventario</label><small>${operator?"Tu espacio está diseñado solo para contar, medir cable e imprimir identificaciones.":superAdmin?"Plan diario, revisión, conteo exprés, existencias e inteligencia de inventario.":"Plan diario, revisión, existencias e inteligencia de inventario."}</small></div><div class="inventory-stock-tabs-v11109">${views.map(([id,label])=>`<button type="button" data-inventory-view="${id}" class="${id===current?"active":""}">${label}</button>`).join("")}</div></section><div id="inventory-workspace-v11232">${loading()}</div>`;
  const host=root.querySelector("#inventory-workspace-v11232"),buttons=[...root.querySelectorAll("[data-inventory-view]")];
  const open=async view=>{
    current=views.some(([id])=>id===view)?view:views[0][0];
    sessionStorage.setItem(KEY,current);
    buttons.forEach(button=>button.classList.toggle("active",button.dataset.inventoryView===current));
    host.innerHTML=loading();
    if(operator){
      if(current==="labels")return renderInventoryOperator(host,{view:"labels"});
      return renderInventoryOperator(host,{view:"count"});
    }
    if(current==="plan")return renderInventoryPlan(host);
    if(current==="review")return renderInventoryReview(host,{status:"SUBMITTED",scope:"ALL"});
    if(current==="express")return renderInventoryReview(host,{status:"SUBMITTED",scope:"EXPRESS"});
    if(current==="stock")return renderInventoryStock(host);
    return renderInventoryControl(host);
  };
  buttons.forEach(button=>button.onclick=()=>open(button.dataset.inventoryView).catch(error=>{toast(error.message,"error",8000);host.innerHTML=empty("No fue posible cargar Inventario",error.message)}));
  await open(current);
}
