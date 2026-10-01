import { fmt } from "../../../../core/format.js";

export function safe(value){return fmt.escape(String(value??"—"))}

export function num(value){return Number(value||0)}

export function pct(value){return value===null||value===undefined||Number.isNaN(Number(value))?"—":`${fmt.number(value,1)}%`}

export function money(value){return new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(num(value))}

export function hours(seconds){
  const value=num(seconds);
  if(value<=0)return "0 h";
  return value<3600?`${fmt.number(value/60,0)} min`:`${fmt.number(value/3600,1)} h`;
}

export function metricValue(metric,value){
  if(["invoice_amount","amount","avg_amount","cost"].includes(metric))return money(value);
  if(metric.includes("hours"))return `${fmt.number(value,1)} h`;
  if(metric.includes("distance"))return `${fmt.number(value,1)} km`;
  if(["count","closed","completed","delivered","satisfied","lots","sessions","tasks","completed_tasks","resolved","approved"].includes(metric))return fmt.number(value,0);
  return fmt.number(value,2);
}

export function pretty(value){
  return String(value??"Sin dato").replaceAll("_"," ").toLowerCase().replace(/(^|\s)\S/g,m=>m.toUpperCase());
}

export function empty(text){return `<div class="bi-empty-v11140">${safe(text)}</div>`}
