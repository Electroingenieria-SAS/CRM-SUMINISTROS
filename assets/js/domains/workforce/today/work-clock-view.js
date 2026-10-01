import { fmt } from "../../../core/format.js";
import { workClockState } from "./work-clock-state.js";

export function render(){
  if(!workClockState.slot)return;
  const active=workClockState.data?.active;
  if(!active){
    const pending=(workClockState.data?.today?.length||0)+(workClockState.data?.overdue?.length||0);
    workClockState.slot.innerHTML=`<button type="button" class="work-clock-trigger idle" aria-label="Abrir Mi Jornada"><span class="work-clock-dot"></span><span><strong>Mi jornada</strong><small>${pending?`${pending} actividad(es) pendiente(s)`:"Sin actividad adicional"}</small></span></button>`;
    return;
  }
  const elapsed=active.status==="PAUSED"?Number(active.metrics?.elapsedSeconds||0):Math.max(Number(active.metrics?.elapsedSeconds||0),Math.floor((Date.now()-new Date(active.startedAt).getTime())/1000));
  workClockState.slot.innerHTML=`<button type="button" class="work-clock-trigger running ${active.status==="PAUSED"?"paused":""}" aria-label="Abrir actividad actual"><span class="work-clock-dot"></span><span><strong>${fmt.escape(shorten(active.title,24))}</strong><small>${active.status==="PAUSED"?"Pausada":"En curso"} · ${clock(elapsed)}</small></span></button>`;
}

export function shorten(value,max){const s=String(value||"Actividad");return s.length>max?`${s.slice(0,max-1)}…`:s}

export function clock(seconds){const n=Math.max(0,Math.floor(Number(seconds||0))),h=Math.floor(n/3600),m=Math.floor((n%3600)/60),s=n%60;return [h,m,s].map(x=>String(x).padStart(2,"0")).join(":")}
