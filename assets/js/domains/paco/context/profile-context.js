import { state, can } from "../../../core/state.js";
import { fmt } from "../../../core/format.js";
import { MANAGER_ROLES, MODULES } from "../paco-config.js";

export function esc(value){return fmt.escape(String(value??""))}

export function currentModule(){return state.currentModule||document.querySelector(".nav-item.active")?.dataset?.module||"dashboard"}

export function moduleLabel(id=currentModule()){return MODULES[id]||"CRM Suministros"}

export function roles(){return state.profile?.roles||[]}

export function isManager(){return roles().some(role=>MANAGER_ROLES.has(role))}

export function allowed(moduleId){return !moduleId||can(moduleId,"canRead")||moduleId===currentModule()}

export function profileId(){return state.profile?.id||state.profile?.profileId||state.profile?.profile_id||null}

export function displayName(){return state.profile?.displayName||state.profile?.display_name||state.profile?.name||""}

export function uid(){return globalThis.crypto?.randomUUID?.()||`paco-${Date.now()}-${Math.random().toString(36).slice(2)}`}

export function now(){return new Date()}

export function todayIso(){return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Bogota",year:"numeric",month:"2-digit",day:"2-digit"}).format(now())}

export function timeLabel(value){if(!value)return "—";return new Intl.DateTimeFormat("es-CO",{timeZone:"America/Bogota",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(value))}

export function duration(seconds){
  const total=Math.max(0,Math.round(Number(seconds||0)));
  if(total<60)return `${total} s`;
  const minutes=Math.floor(total/60);
  if(minutes<60)return `${minutes} min`;
  const hours=Math.floor(minutes/60),rest=minutes%60;
  return `${hours} h${rest?` ${rest} min`:""}`;
}
