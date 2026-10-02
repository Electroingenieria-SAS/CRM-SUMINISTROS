import { fmt } from "../../../../core/format.js";

export const DAY_MS=864e5;

export const clamp=(value,min=0,max=100)=>Math.max(min,Math.min(max,Number(value||0)));

export const num=value=>Number(value||0);

export const isoDay=date=>date.toISOString().slice(0,10);

export const daysBefore=(days,base=new Date())=>isoDay(new Date(base.getTime()-days*DAY_MS));

export const hoursLabel=value=>{
  const n=num(value);
  if(!Number.isFinite(n)||n<=0)return "0 h";
  if(n<1)return `${fmt.number(n*60,0)} min`;
  return `${fmt.number(n,1)} h`;
};

export const pctLabel=value=>`${fmt.number(value,1)}%`;

export const csvEscape=value=>`"${String(value??"").replaceAll('"','""')}"`;

export function shortDay(value){
  if(!value)return "";
  return new Intl.DateTimeFormat("es-CO",{day:"2-digit",month:"short",timeZone:"America/Bogota"}).format(new Date(`${String(value).slice(0,10)}T12:00:00`)).replace(".","");
}

export function cssEscape(value){
  if(globalThis.CSS?.escape)return CSS.escape(value);
  return String(value||"").replace(/["\\]/g,"\\$&");
}
