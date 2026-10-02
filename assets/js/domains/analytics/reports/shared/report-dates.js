import { TZ } from "../catalog/datasets.js";

export function localIso(date=new Date()){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);
  const values=Object.fromEntries(parts.filter(p=>p.type!=="literal").map(p=>[p.type,p.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function shiftIso(iso,days){
  const d=new Date(`${iso}T12:00:00-05:00`);
  d.setDate(d.getDate()+days);
  return localIso(d);
}

export function startOfYear(iso){return `${iso.slice(0,4)}-01-01`}
