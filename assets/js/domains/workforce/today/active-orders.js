import { api } from "../../../services/api.js";
import { ACTIVE_STATUSES, PRIORITY_WEIGHT } from "./parallel-work.js";
import { render } from "./active-orders-view.js";
import { activeOrdersState } from "./active-orders-state.js";

export function initActiveWork(){
  const slot=document.querySelector("#active-work-slot");
  if(!slot||activeOrdersState.boundSlot===slot)return;
  activeOrdersState.boundSlot=slot;

  slot.addEventListener("click",event=>{
    const toggle=event.target.closest("[data-active-work-toggle]");
    if(toggle){
      activeOrdersState.expanded=!activeOrdersState.expanded;
      render(slot);
      if(activeOrdersState.expanded)refreshActiveWork();
      return;
    }
    const order=event.target.closest("[data-active-work-order]");
    if(order){
      activeOrdersState.expanded=false;
      render(slot);
      window.dispatchEvent(new CustomEvent("erp:open-order",{detail:order.dataset.activeWorkOrder}));
      return;
    }
    if(event.target.closest("[data-active-work-refresh]"))refreshActiveWork(true);
  });

  if(!activeOrdersState.globalEventsBound){
    activeOrdersState.globalEventsBound=true;
    document.addEventListener("click",event=>{
      const current=document.querySelector("#active-work-slot");
      if(!activeOrdersState.expanded||current?.contains(event.target))return;
      activeOrdersState.expanded=false;
      if(current)render(current);
    });
    window.addEventListener("erp:work-changed",scheduleRefresh);
    window.addEventListener("erp:refresh",()=>refreshActiveWork(true));
  }
  render(slot);
  refreshActiveWork();
}

export function scheduleRefresh(){
  clearTimeout(activeOrdersState.refreshTimer);
  activeOrdersState.refreshTimer=setTimeout(()=>refreshActiveWork(),180);
}

export async function refreshActiveWork(force=false){
  const slot=document.querySelector("#active-work-slot");
  if(!slot||activeOrdersState.loading)return;
  activeOrdersState.loading=true;
  render(slot);
  try{
    const data=await api.listOrders({assignment:"MINE",page:1,pageSize:100,includeHistory:false});
    activeOrdersState.activeOrders=(data.items||[])
      .filter(order=>ACTIVE_STATUSES.has(String(order.status||"").toUpperCase()))
      .sort((a,b)=>(PRIORITY_WEIGHT[a.priority]||9)-(PRIORITY_WEIGHT[b.priority]||9)||new Date(b.updatedAt||0)-new Date(a.updatedAt||0));
  }catch(error){
    if(force)console.error("[ERP ACTIVE WORK]",error);
  }finally{
    activeOrdersState.loading=false;
    render(slot);
  }
}
