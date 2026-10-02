import { fmt } from "../../../core/format.js";

export const FINAL_STATES=new Set(["COMPLETED","SUBMITTED","WAITING_EVIDENCE","RETURNED","CANCELLED"]);

export const PHOTO_TYPES=new Set(["BEFORE_PHOTO","AFTER_PHOTO","FINAL_PHOTO"]);

export function isPhotoEvidence(row){
  const type=String(row?.type||"").toUpperCase();
  const mime=String(row?.mimeType||"").toLowerCase();
  return PHOTO_TYPES.has(type)||mime.startsWith("image/");
}

export function fallbackEnd(start,seconds){
  if(!start)return null;
  const duration=Math.max(15*60,Number(seconds||0));
  return new Date(new Date(start).getTime()+duration*1000).toISOString();
}

export function dateValue(value){
  const n=new Date(value||0).getTime();
  return Number.isFinite(n)?n:0;
}

export function statusLabel(status){
  return ({
    PLANNED:"Programada",READY:"Lista",IN_PROGRESS:"En curso",PAUSED:"En pausa",
    WAITING_EVIDENCE:"Pendiente de evidencia",SUBMITTED:"En revisión",COMPLETED:"Realizada",
    RETURNED:"Devuelta",CANCELLED:"Cancelada"
  })[String(status||"PLANNED").toUpperCase()]||fmt.label(status||"PLANNED");
}

export function statusTone(status){
  const code=String(status||"PLANNED").toLowerCase().replace(/[^a-z0-9_-]/g,"");
  return `status-${code}`;
}

export function evidenceLabel(type){
  return ({
    BEFORE_PHOTO:"Foto inicial",AFTER_PHOTO:"Foto final",FINAL_PHOTO:"Foto final",
    FILE:"Archivo",LINK:"Enlace",ERP_REFERENCE:"Referencia ERP"
  })[String(type||"").toUpperCase()]||fmt.label(type||"Evidencia");
}

export function timeRange(start,end){
  if(!start)return"—";
  const formatter=new Intl.DateTimeFormat("es-CO",{hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"America/Bogota"});
  const from=formatter.format(new Date(start));
  return end?`${from}–${formatter.format(new Date(end))}`:from;
}

export function durationLabel(seconds){
  const total=Math.max(0,Math.round(Number(seconds||0)));
  if(!total)return"—";
  const hours=Math.floor(total/3600);
  const minutes=Math.round((total%3600)/60);
  return hours?`${hours} h ${minutes} min`:`${Math.max(1,minutes)} min`;
}

export function safeHttpUrl(value){
  try{
    const url=new URL(String(value||""));
    return url.protocol==="https:"?url.href:"";
  }catch{return""}
}
