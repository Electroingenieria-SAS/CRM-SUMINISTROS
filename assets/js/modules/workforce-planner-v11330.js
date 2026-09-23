import {fmt} from "../core/format.js";

const STATUS_META={
  PLANNED:{label:"Programada",tone:"planned"},
  READY:{label:"Lista",tone:"ready"},
  IN_PROGRESS:{label:"En curso",tone:"running"},
  PAUSED:{label:"En pausa",tone:"paused"},
  WAITING_EVIDENCE:{label:"Pendiente evidencia",tone:"evidence"},
  SUBMITTED:{label:"En revisión",tone:"review"},
  COMPLETED:{label:"Completada",tone:"completed"},
  RETURNED:{label:"Devuelta",tone:"returned"},
  CANCELLED:{label:"Cancelada",tone:"cancelled"}
};

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

export function renderPlannerBoard({mode,anchor,data,calendar}){
  if(mode==="day")return dayPlannerHtml(data,calendar,anchor);
  if(mode==="month")return monthPlannerHtml(data,calendar,anchor);
  return weekPlannerHtml(data,calendar,anchor);
}

export function teamCapacityHtml(people,assignments,range,calendar){
  if(!people.length)return `<div class="work-planner-empty"><strong>Sin equipo disponible</strong><span>No hay perfiles dentro de tu ámbito de planificación.</span></div>`;
  const working=businessDaysForRange(range.from,range.to,calendar).filter(x=>!x.isHoliday).length;
  const capacity=Math.max(1,working*Number(calendar?.minutesPerBusinessDay||530));
  return `<div class="work-capacity-list">${people.map(p=>{
    const planned=assignments.filter(a=>a.profileId===p.id&&a.memberStatus!=="CANCELLED").reduce((sum,a)=>sum+Number(a.estimatedMinutes||0),0);
    const pct=Math.round(100*planned/capacity);
    const state=personState(p);
    return `<article class="work-capacity-row">
      <div class="work-capacity-person"><span class="avatar">${fmt.initials(p.name)}</span><div><strong>${fmt.escape(p.name)}</strong>${stateHtml(state,p.activeTitle)}</div></div>
      <div class="capacity-meter" aria-label="${Math.min(pct,100)}% de capacidad planificada"><span style="width:${Math.min(pct,100)}%"></span></div>
      <div class="work-capacity-value"><b class="${pct>100?"danger":pct>85?"warning":""}">${pct}%</b><small>${fmt.number(planned)} / ${fmt.number(capacity)} min</small></div>
    </article>`;
  }).join("")}</div>`;
}

function dayPlannerHtml(data,calendar,anchor){
  const date=isoDate(anchor),day=businessDaysForRange(date,date,calendar)[0];
  if(!day)return nonWorkingDayHtml("Fin de semana","Este día no pertenece a la jornada laboral.");
  if(day.isHoliday)return nonWorkingDayHtml(day.holidayName||"Festivo","Día no laborable. No se permiten asignaciones.");
  const segments=(calendar.segments||[]).filter(x=>x.isoWeekday===isoWeekday(anchor));
  const people=data.people||[],assignments=data.assignments||[];
  return `<section class="work-day-board card">
    <header class="work-day-timeline-head">
      <div class="work-day-team-label"><strong>Equipo</strong><span>Estado actual y actividad</span></div>
      <div class="work-day-segments-head">${segments.map(segmentHeader).join("")}</div>
    </header>
    <div class="work-day-rows">${people.map(person=>dayPersonRow(person,assignments,segments,anchor)).join("")||'<div class="work-planner-empty"><strong>Sin equipo</strong><span>No hay usuarios visibles para esta jornada.</span></div>'}</div>
  </section>`;
}

function segmentHeader(segment){
  const marks=hourMarks(segment.startTime,segment.endTime);
  return `<div class="work-day-segment-head" style="--segment-minutes:${toMinutes(segment.endTime)-toMinutes(segment.startTime)}"><div><strong>${segment.startTime}</strong><span>– ${segment.endTime}</span></div><div class="work-day-hour-marks">${marks.map(x=>`<span style="left:${x.left}%">${x.label}</span>`).join("")}</div></div>`;
}

function dayPersonRow(person,assignments,segments,day){
  const rows=assignmentsForDay(assignments,person.id,day);
  const state=personState(person);
  const noTime=rows.filter(a=>!a.plannedStart);
  return `<article class="work-day-person-row">
    <div class="work-day-person">${personIdentity(person,state)}</div>
    <div class="work-day-segments">${segments.map(seg=>daySegmentCell(rows,seg)).join("")}${noTime.length?`<div class="work-day-floating">${noTime.map(compactAssignment).join("")}</div>`:""}</div>
  </article>`;
}

function daySegmentCell(rows,segment){
  const start=toMinutes(segment.startTime),end=toMinutes(segment.endTime),duration=end-start;
  const timed=rows.filter(a=>a.plannedStart&&a.plannedEnd).map(a=>{
    const aStart=bogotaMinutes(a.plannedStart),aEnd=bogotaMinutes(a.plannedEnd);
    const overlapStart=Math.max(start,aStart),overlapEnd=Math.min(end,aEnd);
    if(overlapEnd<=overlapStart)return null;
    return {a,left:100*(overlapStart-start)/duration,width:100*(overlapEnd-overlapStart)/duration};
  }).filter(Boolean);
  return `<div class="work-day-segment-cell">${timed.map(({a,left,width},i)=>`<div class="work-day-task ${statusTone(a.memberStatus)} ${a.kind==="DELIVERABLE"?"deliverable":""}" style="left:${left.toFixed(2)}%;width:${Math.max(width,7).toFixed(2)}%;top:${6+(i%2)*31}px" title="${fmt.escape(a.title)}"><span>${timeOnly(a.plannedStart)}–${timeOnly(a.plannedEnd)}</span><strong>${fmt.escape(a.title)}</strong><small>${statusLabel(a.memberStatus)}</small><button data-assignment-cancel="${fmt.escape(a.id)}" aria-label="Cancelar asignación">×</button></div>`).join("")}</div>`;
}

function weekPlannerHtml(data,calendar,anchor){
  const range=plannerRangeForMode("week",anchor);
  const days=businessDaysForRange(range.from,range.to,calendar);
  const people=data.people||[],assignments=data.assignments||[];
  return `<section class="work-week-board card"><div class="work-week-grid-v11330">
    <div class="work-week-corner"><strong>Equipo</strong><span>Lunes a viernes</span></div>
    ${days.map(day=>weekDayHeader(day)).join("")}
    ${people.map(person=>`${weekPerson(person)}${days.map(day=>weekCell(assignments,person.id,day)).join("")}`).join("")}
  </div></section>`;
}

function weekDayHeader(day){
  const d=parseIsoDate(day.date);
  return `<button class="work-week-day ${isToday(d)?"today":""} ${day.isHoliday?"holiday":""}" ${day.isHoliday?"disabled":`data-plan-day="${day.date}"`}><strong>${weekdayShort(d)}</strong><span>${d.getDate()} ${monthShort(d)}</span>${day.isHoliday?`<small>${fmt.escape(day.holidayName)}</small>`:""}</button>`;
}

function weekPerson(person){
  return `<div class="work-week-person-v11330">${personIdentity(person,personState(person))}</div>`;
}

function weekCell(assignments,profileId,day){
  if(day.isHoliday)return `<div class="work-week-cell-v11330 holiday"><span class="work-holiday-lock">Festivo</span></div>`;
  const rows=assignmentsForDay(assignments,profileId,parseIsoDate(day.date));
  return `<div class="work-week-cell-v11330 ${isToday(parseIsoDate(day.date))?"today":""}">${rows.map(assignmentCard).join("")||'<span class="work-cell-empty-v11330">Disponible</span>'}</div>`;
}

function monthPlannerHtml(data,calendar,anchor){
  const first=new Date(anchor.getFullYear(),anchor.getMonth(),1),last=new Date(anchor.getFullYear(),anchor.getMonth()+1,0);
  const days=businessDaysForRange(isoDate(first),isoDate(last),calendar);
  const leading=Math.max(0,isoWeekday(first)-1);
  const cells=[...Array(Math.min(leading,5)).keys()].map(()=>null).concat(days);
  while(cells.length%5)cells.push(null);
  const assignments=data.assignments||[];
  return `<section class="work-month-board card"><div class="work-month-weekdays-v11330">${["Lun","Mar","Mié","Jue","Vie"].map(x=>`<span>${x}</span>`).join("")}</div><div class="work-month-grid-v11330">${cells.map(day=>{
    if(!day)return '<div class="work-month-day-v11330 spacer" aria-hidden="true"></div>';
    const d=parseIsoDate(day.date),rows=assignments.filter(a=>sameDate(new Date(a.plannedStart||a.dueAt),d));
    if(day.isHoliday)return `<div class="work-month-day-v11330 holiday"><div class="work-month-date"><strong>${d.getDate()}</strong><span>Festivo</span></div><p>${fmt.escape(day.holidayName)}</p></div>`;
    return `<button class="work-month-day-v11330 ${isToday(d)?"today":""}" data-plan-day="${day.date}"><div class="work-month-date"><strong>${d.getDate()}</strong><span>${rows.length?"Actividad":"Disponible"}</span></div><div class="work-month-items-v11330">${rows.slice(0,4).map(monthAssignment).join("")}${rows.length>4?`<small class="work-more-count">+${rows.length-4} más</small>`:""}</div></button>`;
  }).join("")}</div></section>`;
}

function assignmentCard(a){
  return `<article class="work-assignment-card-v11330 ${statusTone(a.memberStatus)} ${a.kind==="DELIVERABLE"?"deliverable":""}">
    <div class="work-assignment-card-head"><span>${a.plannedStart?timeOnly(a.plannedStart):"Entregable"}${a.plannedEnd?`–${timeOnly(a.plannedEnd)}`:""}</span><em>${statusLabel(a.memberStatus)}</em></div>
    <strong>${fmt.escape(a.title)}</strong>
    <small>${fmt.escape(a.catalogName||fmt.label(a.kind))} · ${fmt.number(a.estimatedMinutes||0)} min</small>
    <button data-assignment-cancel="${fmt.escape(a.id)}" title="Cancelar asignación" aria-label="Cancelar asignación">×</button>
  </article>`;
}

function compactAssignment(a){return `<span class="work-floating-assignment ${statusTone(a.memberStatus)}"><b>${fmt.escape(a.title)}</b><small>${statusLabel(a.memberStatus)}</small></span>`}

function monthAssignment(a){
  return `<span class="work-month-item-v11330 ${statusTone(a.memberStatus)} ${a.kind==="DELIVERABLE"?"deliverable":""}"><b>${a.plannedStart?timeOnly(a.plannedStart):"Límite"}</b><span>${fmt.escape(a.title)}</span><small>${fmt.escape(firstName(a.profileName))}</small></span>`;
}

function personIdentity(person,state){
  return `<span class="avatar">${fmt.initials(person.name)}</span><div class="work-person-copy"><strong>${fmt.escape(person.name)}</strong>${stateHtml(state,person.activeTitle)}</div>`;
}

function stateHtml(state,title){
  return `<div class="work-person-state ${state.tone}"><span>${state.label}</span>${title?`<small>${fmt.escape(title)}</small>`:""}</div>`;
}

function personState(person){
  const status=String(person.activeStatus||"").toUpperCase();
  if(status==="PAUSED")return {label:"En pausa",tone:"paused"};
  if(person.activeTitle)return {label:"Ocupado",tone:"busy"};
  return {label:"Disponible",tone:"available"};
}

function nonWorkingDayHtml(title,detail){
  return `<section class="work-nonworking-day card"><span>✦</span><div><strong>${fmt.escape(title)}</strong><p>${fmt.escape(detail)}</p></div></section>`;
}

function statusLabel(status){return STATUS_META[String(status||"PLANNED").toUpperCase()]?.label||fmt.label(status||"PLANNED")}
function statusTone(status){return `status-${STATUS_META[String(status||"PLANNED").toUpperCase()]?.tone||"planned"}`}
function assignmentsForDay(rows,profileId,day){return rows.filter(a=>a.profileId===profileId&&sameDate(new Date(a.plannedStart||a.dueAt),day)).sort((a,b)=>new Date(a.plannedStart||a.dueAt)-new Date(b.plannedStart||b.dueAt))}
function toMinutes(value){const [h,m]=String(value||"0:0").split(":").map(Number);return h*60+m}
function hourMarks(start,end){const s=toMinutes(start),e=toMinutes(end),duration=e-s,result=[];for(let m=Math.ceil(s/60)*60;m<e;m+=60)result.push({label:`${String(Math.floor(m/60)).padStart(2,"0")}:00`,left:100*(m-s)/duration});return result}
function bogotaMinutes(value){const parts=new Intl.DateTimeFormat("en-CA",{hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"America/Bogota"}).formatToParts(new Date(value));return Number(parts.find(x=>x.type==="hour")?.value||0)*60+Number(parts.find(x=>x.type==="minute")?.value||0)}
function timeOnly(value){if(!value)return"—";return new Intl.DateTimeFormat("es-CO",{hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"America/Bogota"}).format(new Date(value))}
function weekdayShort(value){return new Intl.DateTimeFormat("es-CO",{weekday:"short",timeZone:"America/Bogota"}).format(value).replace(".","").replace(/^./,c=>c.toUpperCase())}
function monthShort(value){return new Intl.DateTimeFormat("es-CO",{month:"short",timeZone:"America/Bogota"}).format(value).replace(".","")}
function firstName(name=""){return String(name).trim().split(/\s+/)[0]||""}
function startOfDay(value){const d=new Date(value);d.setHours(0,0,0,0);return d}
function startOfWeek(value){const d=startOfDay(value),day=(d.getDay()+6)%7;d.setDate(d.getDate()-day);return d}
function addDays(value,n){const d=new Date(value);d.setDate(d.getDate()+n);return d}
function parseIsoDate(value){const [y,m,d]=String(value).split("-").map(Number);return new Date(y,m-1,d,12,0,0,0)}
function isoDate(value){const d=new Date(value);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function isoWeekday(value){return ((new Date(value).getDay()+6)%7)+1}
function sameDate(a,b){return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate()}
function isToday(value){return sameDate(new Date(),new Date(value))}
