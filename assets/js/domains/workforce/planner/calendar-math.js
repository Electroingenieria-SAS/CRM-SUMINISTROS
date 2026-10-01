import { toMinutes, monthShort, startOfDay, startOfWeek, addDays, parseIsoDate, isoDate } from "./planner-dates.js";

export function normalizePlannerCalendar(raw={}){
  const segments=(raw.segments||[]).map(x=>({
    isoWeekday:Number(x.isoWeekday??x.iso_weekday),
    startTime:String(x.startTime??x.start_time??"").slice(0,5),
    endTime:String(x.endTime??x.end_time??"").slice(0,5)
  })).filter(x=>x.isoWeekday>=1&&x.isoWeekday<=7&&x.startTime&&x.endTime)
    .sort((a,b)=>a.isoWeekday-b.isoWeekday||a.startTime.localeCompare(b.startTime));
  const holidays=(raw.holidays||[]).map(x=>({
    date:String(x.date??x.holidayDate??x.holiday_date??"").slice(0,10),
    name:String(x.name||"Festivo")
  })).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x.date));
  const byWeekday=new Map();
  for(const segment of segments){
    const mins=Math.max(0,toMinutes(segment.endTime)-toMinutes(segment.startTime));
    byWeekday.set(segment.isoWeekday,(byWeekday.get(segment.isoWeekday)||0)+mins);
  }
  const workingWeekdays=[...byWeekday.entries()].filter(([,mins])=>mins>0).map(([d])=>d).sort((a,b)=>a-b);
  const daily=[...byWeekday.values()].filter(Boolean);
  return {
    timezone:raw.timezone||raw.calendar?.timezone||"America/Bogota",
    segments,
    holidays,
    holidayMap:new Map(holidays.map(x=>[x.date,x])),
    workingWeekdays:workingWeekdays.length?workingWeekdays:[1,2,3,4,5],
    minutesPerBusinessDay:daily.length?Math.max(...daily):530
  };
}

export function plannerRangeForMode(mode,anchor){
  const d=startOfDay(anchor);
  if(mode==="day"){
    const iso=isoDate(d);
    return {from:iso,to:iso};
  }
  if(mode==="week"){
    const monday=startOfWeek(d);
    return {from:isoDate(monday),to:isoDate(addDays(monday,4))};
  }
  const first=new Date(d.getFullYear(),d.getMonth(),1);
  const last=new Date(d.getFullYear(),d.getMonth()+1,0);
  return {from:isoDate(first),to:isoDate(last)};
}

export function businessDaysForRange(from,to,calendar){
  const cal=calendar?.workingWeekdays?calendar:normalizePlannerCalendar(calendar);
  const start=parseIsoDate(from),end=parseIsoDate(to),result=[];
  for(let d=start;d<=end;d=addDays(d,1)){
    const iso=isoDate(d),isoDow=((d.getDay()+6)%7)+1;
    if(!cal.workingWeekdays.includes(isoDow))continue;
    const holiday=cal.holidayMap?.get(iso)||null;
    result.push({date:iso,dateObject:new Date(d),isHoliday:Boolean(holiday),holidayName:holiday?.name||null});
  }
  return result;
}

export function nextBusinessAnchor(anchor,direction,calendar){
  const cal=calendar?.workingWeekdays?calendar:normalizePlannerCalendar(calendar);
  let d=addDays(startOfDay(anchor),direction>=0?1:-1);
  for(let guard=0;guard<370;guard++,d=addDays(d,direction>=0?1:-1)){
    const iso=isoDate(d),isoDow=((d.getDay()+6)%7)+1;
    if(cal.workingWeekdays.includes(isoDow)&&!cal.holidayMap?.has(iso))return d;
  }
  return startOfDay(anchor);
}

export function plannerTitleForMode(mode,anchor){
  const d=startOfDay(anchor);
  if(mode==="day")return new Intl.DateTimeFormat("es-CO",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(d).replace(/^./,c=>c.toUpperCase());
  if(mode==="week"){
    const m=startOfWeek(d),f=addDays(m,4);
    return `${m.getDate()} ${monthShort(m)} – ${f.getDate()} ${monthShort(f)} ${f.getFullYear()}`;
  }
  return new Intl.DateTimeFormat("es-CO",{month:"long",year:"numeric"}).format(d).replace(/^./,c=>c.toUpperCase());
}
