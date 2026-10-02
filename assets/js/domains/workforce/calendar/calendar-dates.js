

export function minutesToClock(total){
  const value=Math.max(0,Math.min(1440,Number(total||0)));
  return `${String(Math.floor(value/60)).padStart(2,"0")}:${String(value%60).padStart(2,"0")}`;
}

export function bogotaMinutes(value){
  const parts=new Intl.DateTimeFormat("en-CA",{
    timeZone:"America/Bogota",
    hour:"2-digit",
    minute:"2-digit",
    hour12:false
  }).formatToParts(new Date(value));

  const hour=Number(parts.find(part=>part.type==="hour")?.value||0)%24;
  const minute=Number(parts.find(part=>part.type==="minute")?.value||0);
  return hour*60+minute;
}

export function timeOnly(value){
  if(!value)return "";
  return new Intl.DateTimeFormat("es-CO",{
    hour:"2-digit",
    minute:"2-digit",
    hour12:false,
    timeZone:"America/Bogota"
  }).format(new Date(value));
}

export function toMinutes(value){
  const [hour,minute]=String(value||"0:0").split(":").map(Number);
  return hour*60+minute;
}

export function sameDate(a,b){
  return isoDate(a)===isoDate(b);
}

export function isoDate(value){
  const date=new Date(value);
  const year=date.getFullYear();
  const month=String(date.getMonth()+1).padStart(2,"0");
  const day=String(date.getDate()).padStart(2,"0");
  return `${year}-${month}-${day}`;
}

export function parseIsoDate(value){
  const [year,month,day]=String(value).split("-").map(Number);
  return new Date(year,month-1,day);
}

export function isoWeekday(date){
  return ((new Date(date).getDay()+6)%7)+1;
}

export function isToday(date){
  return isoDate(date)===isoDate(new Date());
}

export function weekdayShort(date){
  return new Intl.DateTimeFormat("es-CO",{weekday:"short"}).format(date).replace(".","").replace(/^./,char=>char.toUpperCase());
}

export function monthShort(date){
  return new Intl.DateTimeFormat("es-CO",{month:"short"}).format(date).replace(".","");
}
