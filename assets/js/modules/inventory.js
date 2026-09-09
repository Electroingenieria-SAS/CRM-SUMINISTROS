import {renderInventory as renderStock} from "./inventory-stock.js";
import {renderInventoryCycle} from "./inventory-cycle-v11220.js";
import {renderInventoryControl} from "./inventory-control-v11220.js";
import {can,state} from "../core/state.js";
import {empty,loading,toast} from "../core/ui.js";

const KEY="crm_inventory_view_v11220";
const executive=()=>state.profile?.roles?.some(role=>role==="super_admin"||role==="gerencia");

export async function renderInventory(root){
  const isExecutive=executive();
  const canCount=can("inventory","canUpdate");
  const views=["stock",...(canCount||isExecutive?["cycle"]:[]),...(isExecutive?["control"]:[])];
  let current=views.includes(sessionStorage.getItem(KEY))?sessionStorage.getItem(KEY):"stock";
  root.innerHTML=`<section class="inventory-filter-shell-v11109"><div class="inventory-search-main-v11109"><label>Centro de inventario</label><small>Siesa + operación CRM + conteo físico + VSM, sin motores paralelos.</small></div><div class="inventory-stock-tabs-v11109">${views.map(view=>`<button type="button" data-inventory-view="${view}">${view==="stock"?"Existencias":view==="cycle"?"Conteo cíclico":"Contabilización"}</button>`).join("")}</div></section><div id="inventory-workspace-v11220">${loading()}</div>`;
  const host=root.querySelector("#inventory-workspace-v11220"),buttons=[...root.querySelectorAll("[data-inventory-view]")];
  const open=async view=>{
    current=views.includes(view)?view:"stock";
    sessionStorage.setItem(KEY,current);
    buttons.forEach(button=>button.classList.toggle("active",button.dataset.inventoryView===current));
    host.innerHTML=loading();
    if(current==="stock")return renderStock(host);
    if(current==="cycle")return renderInventoryCycle(host);
    if(!isExecutive){host.innerHTML=empty("Acceso restringido","Solo Superadministración y Gerencia pueden ver Contabilización.");return}
    return renderInventoryControl(host);
  };
  buttons.forEach(button=>button.onclick=()=>open(button.dataset.inventoryView).catch(error=>{toast(error.message,"error",7000);host.innerHTML=empty("No fue posible cargar Inventario",error.message)}));
  await open(current);
}
