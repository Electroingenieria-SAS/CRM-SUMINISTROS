import { ACTIVE_ORDER_STATUSES } from "../paco-config.js";
import { timeLabel } from "./profile-context.js";

export function orderNumber(row){return row?.orderNumber||row?.order_number||row?.number||"Pedido"}

export function orderStep(row){return String(row?.currentStep||row?.current_step_code||row?.stepCode||row?.step_code||"").toUpperCase()}

export function orderStatus(row){return String(row?.status||row?.taskStatus||row?.task_status||"").toUpperCase()}

export function orderAge(row){return Number(row?.ageBusinessSeconds||row?.age_business_seconds||0)}

export function orderAssignee(row){return row?.assigneeName||row?.assignedToName||row?.assigned_to_name||row?.assignedTo||row?.assigned_to||""}

export function activeOrder(row){const status=orderStatus(row);return !status||ACTIVE_ORDER_STATUSES.has(status)}

export function itemArray(value){return Array.isArray(value)?value:Array.isArray(value?.items)?value.items:[]}

export function stepName(row){return row?.stepName||row?.currentStepName||orderStep(row)||"En proceso"}

export function stageBreakdown(snapshot){
  const counts=new Map();
  (snapshot?.orders||[]).filter(activeOrder).forEach(row=>{
    const label=stepName(row);
    counts.set(label,(counts.get(label)||0)+1);
  });
  return [...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],"es"));
}

export function businessClockLabel(){return timeLabel(new Date())}

export function orderTerm(text){
  const raw=String(text||"");
  const explicit=raw.match(/(?:pedido|orden)\s*(?:#|numero|número|no\.?|nro\.?|:)?\s*([A-Za-z0-9][A-Za-z0-9._/-]{2,})/i)?.[1];
  if(explicit&&!/^(demorado|atrasado|bloqueado|que|como|donde)$/i.test(explicit))return explicit;
  return raw.match(/\b[A-Za-z]{1,8}[-_]\d{2,}[A-Za-z0-9-]*\b/)?.[0]||raw.match(/\b\d{4,}\b/)?.[0]||"";
}
