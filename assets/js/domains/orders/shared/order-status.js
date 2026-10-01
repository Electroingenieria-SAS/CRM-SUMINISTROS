import { fmt } from "../../../core/format.js";

export function customerSegmentBadgeFromPriority(priority){
  const code=String(priority||"MEDIUM").toUpperCase();
  const label=code==="URGENT"||code==="HIGH"||code==="CRITICAL"?"Atención prioritaria":code==="LOW"?"Atención básica":"Atención normal";
  const cls=code==="URGENT"||code==="HIGH"||code==="CRITICAL"?"badge-red":code==="LOW"?"badge-gray":"badge-green";
  return `<span class="badge ${cls}"><span class="badge-dot"></span>${fmt.escape(label)}</span>`;
}

export function orderStageBadge(order={}){
  const status=String(order.status||"").toUpperCase();
  const step=String(order.currentStep||order.current_step_code||"").toUpperCase();

  if(status==="CANCELLED"){
    return '<span class="badge badge-red"><span class="badge-dot"></span>Cancelado</span>';
  }
  if(status==="CLOSED"||step==="CLOSED"){
    return '<span class="badge badge-green"><span class="badge-dot"></span>Cerrado</span>';
  }

  const label=fmt.step(order.stepName||order.currentStep||order.current_step_code||"Proceso");
  const cls=status==="BLOCKED"?"badge-red":status==="WAITING"?"badge-yellow":"badge-blue";
  return `<span class="badge ${cls}"><span class="badge-dot"></span>${fmt.escape(label)}</span>`;
}
