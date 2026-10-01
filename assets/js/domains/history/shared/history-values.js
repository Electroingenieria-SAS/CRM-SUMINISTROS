import { fmt } from "../../../core/format.js";

export function safe(value){return fmt.escape(String(value??"—"))}

export function n(value){return Number(value||0)}

export function money(value){return new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(n(value))}

export function date(value){return value?new Intl.DateTimeFormat("es-CO",{dateStyle:"medium",timeZone:"America/Bogota"}).format(new Date(value)):"—"}

export function dateTime(value){return value?new Intl.DateTimeFormat("es-CO",{dateStyle:"medium",timeStyle:"short",timeZone:"America/Bogota"}).format(new Date(value)):"—"}

export function duration(seconds){
  const s=n(seconds);if(!s)return "—";
  const d=Math.floor(s/86400),h=Math.floor((s%86400)/3600),m=Math.floor((s%3600)/60);
  return d?`${d} d ${h} h`:h?`${h} h ${m} min`:`${m} min`;
}

export function label(value){return fmt.label?.(value)||String(value??"—").replaceAll("_"," ")}

export function sourceLabel(value){return value==="IMPORTED"?"Importado CSV":"Operación nativa"}

export function sourceClass(value){return value==="IMPORTED"?"imported":"native"}

export function statusClass(value){return value==="CANCELLED"?"cancelled":"closed"}
