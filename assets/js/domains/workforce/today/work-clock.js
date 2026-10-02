import { api } from "../../../services/api.js";
import { navigate } from "../../../core/router.js";
import { render } from "./work-clock-view.js";
import { workClockState } from "./work-clock-state.js";

export function initWorkClock(){
  workClockState.slot=document.querySelector("#work-clock-slot");
  if(!workClockState.slot)return;
  if(!workClockState.bound){
    workClockState.bound=true;
    workClockState.slot.addEventListener("click",()=>navigate("workforce"));
    window.addEventListener("erp:work-changed",scheduleRefresh);
    window.addEventListener("erp:refresh-workforce",()=>refresh(true));
    document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh()});
  }
  render();
  refresh();
  clearInterval(workClockState.pollTimer);workClockState.pollTimer=setInterval(()=>refresh(),60000);
  clearInterval(workClockState.tickTimer);workClockState.tickTimer=setInterval(render,1000);
}

export function scheduleRefresh(){setTimeout(()=>refresh(),220)}

export async function refresh(force=false){
  if(!workClockState.slot)return;
  try{workClockState.data=await api.workMyDay();render()}catch(error){if(force)console.error("[CRM WORK CLOCK]",error)}
}
