import {renderInventoryHome} from "./inventory-home-v11250.js";
import {renderInventoryOperator} from "./inventory-operator-v11250.js";
import {renderInventoryPlan} from "./inventory-plan-v11250.js";
import {renderInventoryReview} from "./inventory-review-v11250.js";
import {renderInventoryStock} from "./inventory-stock-v11250.js";
import {renderInventoryLedger} from "./inventory-ledger-v11250.js";
import {renderInventoryControl} from "./inventory-control-v11250.js";
import {inventoryCountCenter} from "../services/inventory.js";
import {state} from "../core/state.js";
import {empty,loading,toast} from "../core/ui.js";

const KEY="crm_inventory_view_v11250";
const localDay=()=>new Intl.DateTimeFormat("en-CA",{timeZone:state.organization?.timezone||"America/Bogota",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const hasRole=role=>(state.profile?.roles||[]).includes(role);

export async function renderInventory(root){
  const center=await inventoryCountCenter(localDay()),access=center.access||{};
  const operator=Boolean(access.operator),controller=Boolean(access.controller),superAdmin=hasRole("super_admin");
  if(!operator&&!controller){root.innerHTML=empty("Inventario restringido","Tu perfil no tiene funciones activas de Inventario.");return}
  const views=[["home","Inicio"]];
  if(operator)views.push(["capture","Registrar conteo"],["express","Conteo exprés"],["count","Mi jornada"],["labels","Etiquetas"]);
  if(controller)views.push(["plan","Plan"],["review","Revisión"],["history","Historial"],["stock","Existencias"],["ledger","Movimientos"],["control","Inteligencia"]);
  if(superAdmin&&controller)views.splice(views.findIndex(x=>x[0]==="history"),0,["express-review","Revisión exprés"]);
  let current=sessionStorage.getItem(KEY);if(!views.some(([id])=>id===current))current="home";
  const helper=operator&&controller?"Operación, control y administración en un solo espacio.":operator?"Cuenta, mide cable, escanea e imprime etiquetas sin ver saldos.":"Planifica, revisa, consulta y audita el inventario.";
  root.innerHTML=`<section class="inventory-filter-shell-v11109"><div class="inventory-search-main-v11109"><label>Centro de Inventario</label><small>${helper}</small></div><div class="inventory-stock-tabs-v11109">${views.map(([id,label])=>`<button type="button" data-inventory-view="${id}" class="${id===current?"active":""}">${label}</button>`).join("")}</div></section><div id="inventory-workspace-v11250">${loading()}</div>`;
  const host=root.querySelector("#inventory-workspace-v11250"),buttons=[...root.querySelectorAll("[data-inventory-view]")];
  const open=async view=>{current=views.some(([id])=>id===view)?view:"home";sessionStorage.setItem(KEY,current);buttons.forEach(b=>b.classList.toggle("active",b.dataset.inventoryView===current));host.innerHTML=loading();if(current==="home")return renderInventoryHome(host,{onNavigate:open});if(current==="capture"||current==="express")return renderInventoryOperator(host,{view:"capture"});if(current==="count")return renderInventoryOperator(host,{view:"count"});if(current==="labels")return renderInventoryOperator(host,{view:"labels"});if(current==="plan")return renderInventoryPlan(host);if(current==="review")return renderInventoryReview(host,{status:"SUBMITTED",scope:"ALL"});if(current==="express-review")return renderInventoryReview(host,{status:"SUBMITTED",scope:"EXPRESS"});if(current==="history")return renderInventoryReview(host,{status:"ALL",scope:"ALL",history:true});if(current==="stock")return renderInventoryStock(host);if(current==="ledger")return renderInventoryLedger(host);return renderInventoryControl(host)};
  buttons.forEach(button=>button.onclick=()=>open(button.dataset.inventoryView).catch(error=>{toast(error.message,"error",8000);host.innerHTML=empty("No fue posible cargar Inventario",error.message)}));
  await open(current);
}
