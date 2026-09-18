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

const KEY="crm_inventory_view_v11251";
const localDay=()=>new Intl.DateTimeFormat("en-CA",{timeZone:state.organization?.timezone||"America/Bogota",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const hasRole=role=>(state.profile?.roles||[]).includes(role);

function ensureWorkspaceStyles(){
  if(document.getElementById("inventory-workspace-styles-v11251"))return;
  const link=document.createElement("link");
  link.id="inventory-workspace-styles-v11251";link.rel="stylesheet";link.href="./assets/runtime-css/inventory-workspace-v11251.css?v=11.30.2";
  document.head.appendChild(link);
}

function navGroup(label,items,current){if(!items.length)return"";return `<section class="inventory-nav-group-v11251"><small>${label}</small><div class="inventory-nav-actions-v11251">${items.map(([id,text])=>`<button type="button" data-inventory-view="${id}" class="${id===current?"active":""}" aria-current="${id===current?"page":"false"}">${text}</button>`).join("")}</div></section>`}

export async function renderInventory(root){
  ensureWorkspaceStyles();
  const center=await inventoryCountCenter(localDay()),access=center.access||{};
  const operator=Boolean(access.operator),controller=Boolean(access.controller),superAdmin=hasRole("super_admin");
  if(!operator&&!controller){root.innerHTML=empty("Inventario restringido","Tu perfil no tiene funciones activas de Inventario.");return}
  const overview=[["home","Inicio"]],operation=[],control=[],management=[];
  if(operator)operation.push(["capture","Registrar conteo"],["express","Conteo exprés"],["count","Mi jornada"],["labels","Etiquetas"]);
  if(controller){control.push(["plan","Plan"],["review","Revisión"]);if(superAdmin)control.push(["express-review","Revisión exprés"]);control.push(["history","Historial"]);management.push(["stock","Existencias"],["ledger","Movimientos"],["control","Inteligencia"])}
  const views=[...overview,...operation,...control,...management];
  let current=sessionStorage.getItem(KEY);if(!views.some(([id])=>id===current))current="home";
  const helper=operator&&controller?"Operación, revisión y control separados por función para trabajar sin perder contexto.":operator?"Cuenta, mide, escanea e imprime etiquetas desde un único centro operativo.":"Planifica, revisa, consulta y audita el inventario desde un centro de control.";
  root.innerHTML=`<div class="inventory-app-v11251"><section class="inventory-nav-v11251"><header class="inventory-nav-head-v11251"><div><span>CRM SUMINISTROS · INVENTARIO</span><strong>Centro de Inventario</strong><small>${helper}</small></div></header><div class="inventory-nav-groups-v11251">${navGroup("General",overview,current)}${navGroup("Operación",operation,current)}${navGroup("Control y auditoría",control,current)}${navGroup("Gestión",management,current)}</div></section><div id="inventory-workspace-v11251">${loading()}</div></div>`;
  const host=root.querySelector("#inventory-workspace-v11251"),buttons=[...root.querySelectorAll("[data-inventory-view]")];
  const open=async view=>{current=views.some(([id])=>id===view)?view:"home";sessionStorage.setItem(KEY,current);buttons.forEach(b=>{const active=b.dataset.inventoryView===current;b.classList.toggle("active",active);b.setAttribute("aria-current",active?"page":"false")});host.innerHTML=loading();if(current==="home")return renderInventoryHome(host,{onNavigate:open});if(current==="capture"||current==="express")return renderInventoryOperator(host,{view:"capture"});if(current==="count")return renderInventoryOperator(host,{view:"count"});if(current==="labels")return renderInventoryOperator(host,{view:"labels"});if(current==="plan")return renderInventoryPlan(host);if(current==="review")return renderInventoryReview(host,{status:"SUBMITTED",scope:"ALL"});if(current==="express-review")return renderInventoryReview(host,{status:"SUBMITTED",scope:"EXPRESS"});if(current==="history")return renderInventoryReview(host,{status:"ALL",scope:"ALL",history:true});if(current==="stock")return renderInventoryStock(host);if(current==="ledger")return renderInventoryLedger(host);return renderInventoryControl(host)};
  buttons.forEach(button=>button.onclick=()=>open(button.dataset.inventoryView).catch(error=>{toast(error.message,"error",8000);host.innerHTML=empty("No fue posible cargar Inventario",error.message)}));
  await open(current);
}
