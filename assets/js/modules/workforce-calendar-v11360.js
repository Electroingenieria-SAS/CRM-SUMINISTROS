import {fmt} from "../core/format.js";
import {businessDaysForRange,plannerRangeForMode} from "./workforce-planner-v11330.js";
import {openWorkTimelineCard,timelineDetailRequest} from "./workforce-timeline-v11350.js";
import {collectPreviewRefs} from "./workforce-evidence-manager-v11360.js";

const STYLE_ID="workforce-calendar-v11360-style";

const STATUS_META={
  PLANNED:{label:"Programada",tone:"planned"},
  READY:{label:"Lista",tone:"ready"},
  IN_PROGRESS:{label:"En curso",tone:"running"},
  PAUSED:{label:"En pausa",tone:"paused"},
  WAITING_EVIDENCE:{label:"Pendiente evidencia",tone:"evidence"},
  SUBMITTED:{label:"En revisión",tone:"review"},
  COMPLETED:{label:"Realizada",tone:"completed"},
  RETURNED:{label:"Devuelta",tone:"returned"},
  CANCELLED:{label:"Cancelada",tone:"cancelled"}
};

export function ensureWorkforceCalendarStyles(){
  if(typeof document==="undefined"||document.getElementById(STYLE_ID))return;
  const link=document.createElement("link");
  link.id=STYLE_ID;
  link.rel="stylesheet";
  link.href="./assets/runtime-css/workforce-calendar-v11360.css?v=11.36.0";
  document.head.appendChild(link);
}

export function renderWorkforceCalendarBoard({mode,anchor,data,calendar}){
  const safeData=data||{};
  if(mode==="day")return dayBoard(safeData,calendar,anchor);
  if(mode==="month")return monthBoard(safeData,calendar,anchor);
  return weekBoard(safeData,calendar,anchor);
}

export function bindWorkforceCalendar({
  container,
  items=[],
  api,
  evidenceManager,
  canPlanTeam=false,
  onPlanDay,
  onCancel,
  onActiveProfile,
  notify
}={}){
  if(!container)return ()=>{};

  const timeline=Array.isArray(items)?items:[];
  const byId=new Map(timeline.map(item=>[String(item.id),item]));
  const detailCache=new Map();
  const cleanup=[];
  const toast=typeof notify==="function"?notify:()=>{};

  const detailKey=item=>[
    item?.assignmentId||"",
    item?.executionId||"",
    item?.profileId||""
  ].join(":");

  const loadDetail=item=>{
    const key=detailKey(item);
    if(detailCache.has(key))return detailCache.get(key);

    const request=api.workPlannerDetail(timelineDetailRequest(item))
      .catch(error=>{
        detailCache.delete(key);
        throw error;
      });

    detailCache.set(key,request);
    return request;
  };

  const primePreview=item=>{
    if(!item?.previewEvidenceId||!item?.previewDriveFileId||!evidenceManager)return Promise.resolve(null);
    return evidenceManager
      .get(item.previewEvidenceId,item.previewDriveFileId)
      .catch(()=>null);
  };

  const openItem=id=>{
    const item=byId.get(String(id||""));
    if(!item){
      toast("No se encontró el detalle de esta actividad.","warning");
      return;
    }

    // La foto empieza antes de solicitar el detalle completo.
    primePreview(item);

    return openWorkTimelineCard(
      item,
      ()=>loadDetail(item),
      (evidenceId,fileId)=>evidenceManager.get(evidenceId,fileId)
    );
  };

  const openNodes=[...container.querySelectorAll("[data-assignment-open]")];

  for(const element of openNodes){
    const id=element.dataset.assignmentOpen;
    const item=byId.get(String(id||""));

    const pointerHandler=()=>{ if(item)primePreview(item); };
    const focusHandler=()=>{ if(item)primePreview(item); };
    const clickHandler=event=>{
      if(event.target.closest("[data-assignment-cancel]"))return;
      event.stopPropagation();
      openItem(id);
    };
    const keyHandler=event=>{
      if(event.key!=="Enter"&&event.key!==" ")return;
      event.preventDefault();
      event.stopPropagation();
      openItem(id);
    };

    element.addEventListener("pointerdown",pointerHandler,{passive:true});
    element.addEventListener("focus",focusHandler,{passive:true});
    element.addEventListener("click",clickHandler);
    element.addEventListener("keydown",keyHandler);

    cleanup.push(()=>{
      element.removeEventListener("pointerdown",pointerHandler);
      element.removeEventListener("focus",focusHandler);
      element.removeEventListener("click",clickHandler);
      element.removeEventListener("keydown",keyHandler);
    });
  }

  // Precarga inteligente: solo lo que entra realmente al viewport.
  if(typeof IntersectionObserver!=="undefined"&&evidenceManager){
    const observer=new IntersectionObserver(entries=>{
      for(const entry of entries){
        if(!entry.isIntersecting)continue;
        const item=byId.get(String(entry.target.dataset.assignmentOpen||""));
        if(item)primePreview(item);
        observer.unobserve(entry.target);
      }
    },{root:null,rootMargin:"140px 0px",threshold:0.01});

    for(const node of openNodes)observer.observe(node);
    cleanup.push(()=>observer.disconnect());
  }else if(evidenceManager){
    evidenceManager.prefetch(collectPreviewRefs(timeline,4),{limit:4,concurrency:2});
  }

  container.querySelectorAll("[data-active-profile]").forEach(button=>{
    const handler=event=>{
      event.stopPropagation();
      const profileId=button.dataset.activeProfile;
      const active=timeline.find(row=>
        row.profileId===profileId&&
        ["IN_PROGRESS","PAUSED"].includes(String(row.memberStatus||"").toUpperCase())
      );

      if(active)return openItem(active.id);
      if(typeof onActiveProfile==="function")return onActiveProfile(profileId);
      toast("La actividad actual todavía no tiene detalle disponible en este rango.","warning");
    };

    button.addEventListener("click",handler);
    cleanup.push(()=>button.removeEventListener("click",handler));
  });

  if(canPlanTeam){
    container.querySelectorAll("[data-plan-day]").forEach(day=>{
      const click=event=>{
        if(event.target.closest("[data-assignment-open],[data-active-profile],[data-assignment-cancel]"))return;
        onPlanDay?.(day.dataset.planDay);
      };
      const key=event=>{
        if((event.key==="Enter"||event.key===" ")&&event.target===day){
          event.preventDefault();
          onPlanDay?.(day.dataset.planDay);
        }
      };
      day.addEventListener("click",click);
      day.addEventListener("keydown",key);
      cleanup.push(()=>{
        day.removeEventListener("click",click);
        day.removeEventListener("keydown",key);
      });
    });

    container.querySelectorAll("[data-assignment-cancel]").forEach(button=>{
      const handler=event=>{
        event.stopPropagation();
        onCancel?.(button.dataset.assignmentCancel);
      };
      button.addEventListener("click",handler);
      cleanup.push(()=>button.removeEventListener("click",handler));
    });
  }

  return ()=>cleanup.splice(0).forEach(fn=>fn());
}

function dayBoard(data,calendar,anchor){
  const date=isoDate(anchor);
  const day=businessDaysForRange(date,date,calendar)[0];

  if(!day)return nonWorking("Fin de semana","Este día no pertenece a la jornada laboral.");
  if(day.isHoliday)return nonWorking(day.holidayName||"Festivo","Día no laborable. No se permiten asignaciones.");

  const segments=(calendar?.segments||[]).filter(x=>x.isoWeekday===isoWeekday(anchor));
  const people=data.people||[];
  const assignments=data.assignments||[];

  return `
    <section class="work-calendar-v11360 work-calendar-day-v11360 card">
      <div class="work-calendar-scroll-v11360">
        <header class="work-calendar-day-head-v11360" style="--segment-count:${Math.max(1,segments.length)}">
          <div class="work-calendar-team-head-v11360">
            <span>Equipo</span>
            <strong>Actividad y estado</strong>
          </div>
          <div class="work-calendar-segment-heads-v11360">
            ${segments.map(segmentHeader).join("")}
          </div>
        </header>

        <div class="work-calendar-day-rows-v11360">
          ${people.map(person=>dayPersonRow(person,assignments,segments,anchor)).join("")||
            '<div class="work-calendar-empty-v11360"><strong>Sin actividades visibles</strong><span>No hay usuarios dentro de este ámbito.</span></div>'}
        </div>
      </div>
    </section>`;
}

function segmentHeader(segment){
  const marks=hourMarks(segment.startTime,segment.endTime);
  return `
    <div class="work-calendar-segment-head-v11360">
      <div class="work-calendar-segment-title-v11360">
        <strong>${fmt.escape(segment.startTime)}</strong>
        <span>hasta ${fmt.escape(segment.endTime)}</span>
      </div>
      <div class="work-calendar-hour-marks-v11360">
        ${marks.map(mark=>`<span style="left:${mark.left}%">${fmt.escape(mark.label)}</span>`).join("")}
      </div>
    </div>`;
}

function dayPersonRow(person,assignments,segments,day){
  const rows=assignmentsForDay(assignments,person.id,day);
  const noTime=rows.filter(row=>!row.plannedStart);

  return `
    <article class="work-calendar-person-row-v11360" style="--segment-count:${Math.max(1,segments.length)}">
      <div class="work-calendar-person-v11360">
        ${personIdentity(person)}
      </div>

      <div class="work-calendar-segments-v11360">
        ${segments.map(segment=>daySegment(rows,segment)).join("")}
        ${noTime.length?`<div class="work-calendar-floating-v11360">${noTime.map(compactEvent).join("")}</div>`:""}
      </div>
    </article>`;
}

function daySegment(rows,segment){
  const start=toMinutes(segment.startTime);
  const end=toMinutes(segment.endTime);
  const duration=Math.max(1,end-start);

  const events=rows
    .filter(row=>row.plannedStart&&row.plannedEnd)
    .map(row=>{
      const from=bogotaMinutes(row.plannedStart);
      const to=bogotaMinutes(row.plannedEnd);
      const overlapStart=Math.max(start,from);
      const overlapEnd=Math.min(end,to);
      if(overlapEnd<=overlapStart)return null;

      return {
        row,
        left:100*(overlapStart-start)/duration,
        width:100*(overlapEnd-overlapStart)/duration
      };
    })
    .filter(Boolean);

  return `
    <div class="work-calendar-segment-cell-v11360">
      ${events.map(({row,left,width},index)=>dayEvent(row,left,width,index)).join("")}
    </div>`;
}

function dayEvent(item,left,width,index){
  const status=eventStatus(item);
  return `
    <article
      class="work-calendar-event-v11360 work-calendar-event-day-v11360 tone-${status.tone}${item.hasPhoto?" has-photo":""}${item.executionId?" is-executed":""}"
      data-assignment-open="${fmt.escape(item.id)}"
      role="button"
      tabindex="0"
      aria-label="Abrir ${fmt.escape(item.title||"Actividad")}"
      style="--event-left:${left.toFixed(2)}%;--event-width:${Math.max(width,12).toFixed(2)}%;--event-lane:${index%2}">
      <div class="work-calendar-event-time-v11360">
        ${clockIcon()}
        <span>${fmt.escape(timeOnly(item.plannedStart))}–${fmt.escape(timeOnly(item.plannedEnd))}</span>
      </div>
      <strong class="work-calendar-event-title-v11360">${fmt.escape(item.title||"Actividad")}</strong>
      <div class="work-calendar-event-footer-v11360">
        <span class="work-calendar-status-v11360 tone-${status.tone}">${fmt.escape(status.label)}</span>
        ${item.hasPhoto?photoBadge():""}
      </div>
      ${cancelButton(item)}
    </article>`;
}

function weekBoard(data,calendar,anchor){
  const range=plannerRangeForMode("week",anchor);
  const days=businessDaysForRange(range.from,range.to,calendar);
  const people=data.people||[];
  const assignments=data.assignments||[];

  return `
    <section class="work-calendar-v11360 work-calendar-week-v11360 card">
      <div class="work-calendar-scroll-v11360">
        <div class="work-calendar-week-grid-v11360">
          <div class="work-calendar-week-corner-v11360">
            <span>Equipo</span>
            <strong>Lunes a viernes</strong>
          </div>

          ${days.map(weekDayHeader).join("")}

          ${people.map(person=>`
            <div class="work-calendar-week-person-v11360">${personIdentity(person)}</div>
            ${days.map(day=>weekCell(assignments,person.id,day)).join("")}
          `).join("")}
        </div>
      </div>
    </section>`;
}

function weekDayHeader(day){
  const date=parseIsoDate(day.date);
  return `
    <button
      class="work-calendar-day-head-v11360${isToday(date)?" is-today":""}${day.isHoliday?" is-holiday":""}"
      ${day.isHoliday?"disabled":`data-plan-day="${day.date}"`}>
      <strong>${weekdayShort(date)}</strong>
      <span>${date.getDate()} ${monthShort(date)}</span>
      ${day.isHoliday?`<small>${fmt.escape(day.holidayName||"Festivo")}</small>`:""}
    </button>`;
}

function weekCell(assignments,profileId,day){
  if(day.isHoliday){
    return `<div class="work-calendar-week-cell-v11360 is-holiday"><span class="work-calendar-holiday-v11360">Festivo</span></div>`;
  }

  const date=parseIsoDate(day.date);
  const rows=assignmentsForDay(assignments,profileId,date);

  return `
    <div
      class="work-calendar-week-cell-v11360${isToday(date)?" is-today":""}"
      data-plan-day="${day.date}"
      role="button"
      tabindex="0">
      ${rows.length?rows.map(weekEvent).join(""):'<span class="work-calendar-available-v11360">Disponible</span>'}
    </div>`;
}

function weekEvent(item){
  const status=eventStatus(item);
  return `
    <article
      class="work-calendar-event-v11360 work-calendar-event-week-v11360 tone-${status.tone}${item.hasPhoto?" has-photo":""}${item.executionId?" is-executed":""}"
      data-assignment-open="${fmt.escape(item.id)}"
      role="button"
      tabindex="0">
      <div class="work-calendar-event-time-v11360">
        ${clockIcon()}
        <span>${item.plannedStart?fmt.escape(timeOnly(item.plannedStart)):"Sin hora"}${item.plannedEnd?`–${fmt.escape(timeOnly(item.plannedEnd))}`:""}</span>
      </div>
      <strong class="work-calendar-event-title-v11360">${fmt.escape(item.title||"Actividad")}</strong>
      <div class="work-calendar-event-meta-v11360">${fmt.escape(item.catalogName||fmt.label(item.kind||"ACTIVITY"))}</div>
      <div class="work-calendar-event-footer-v11360">
        <span class="work-calendar-status-v11360 tone-${status.tone}">${fmt.escape(status.label)}</span>
        ${item.hasPhoto?photoBadge():""}
      </div>
      ${cancelButton(item)}
    </article>`;
}

function monthBoard(data,calendar,anchor){
  const first=new Date(anchor.getFullYear(),anchor.getMonth(),1);
  const last=new Date(anchor.getFullYear(),anchor.getMonth()+1,0);
  const days=businessDaysForRange(isoDate(first),isoDate(last),calendar);
  const firstVisible=days[0]?.dateObject||first;
  const leading=Math.max(0,Math.min(4,isoWeekday(firstVisible)-1));
  const cells=[...Array(leading).fill(null),...days];

  while(cells.length%5)cells.push(null);

  const assignments=data.assignments||[];

  return `
    <section class="work-calendar-v11360 work-calendar-month-v11360 card">
      <div class="work-calendar-scroll-v11360">
        <div class="work-calendar-month-weekdays-v11360">
          ${["Lunes","Martes","Miércoles","Jueves","Viernes"].map(day=>`<span>${day}</span>`).join("")}
        </div>
        <div class="work-calendar-month-grid-v11360">
          ${cells.map(day=>monthCell(day,assignments)).join("")}
        </div>
      </div>
    </section>`;
}

function monthCell(day,assignments){
  if(!day)return '<div class="work-calendar-month-cell-v11360 is-spacer" aria-hidden="true"></div>';

  const date=parseIsoDate(day.date);
  const rows=assignments.filter(item=>sameDate(new Date(item.plannedStart||item.dueAt),date));

  if(day.isHoliday){
    return `
      <div class="work-calendar-month-cell-v11360 is-holiday">
        <div class="work-calendar-month-date-v11360"><strong>${date.getDate()}</strong><span>Festivo</span></div>
        <p>${fmt.escape(day.holidayName||"Festivo")}</p>
      </div>`;
  }

  return `
    <div
      class="work-calendar-month-cell-v11360${isToday(date)?" is-today":""}"
      data-plan-day="${day.date}"
      role="button"
      tabindex="0">
      <div class="work-calendar-month-date-v11360">
        <strong>${date.getDate()}</strong>
        <span>${rows.length?`${rows.length} actividad${rows.length===1?"":"es"}`:"Disponible"}</span>
      </div>
      <div class="work-calendar-month-events-v11360">
        ${rows.slice(0,3).map(monthEvent).join("")}
        ${rows.length>3?`<span class="work-calendar-more-v11360">+${rows.length-3} más</span>`:""}
      </div>
    </div>`;
}

function monthEvent(item){
  const status=eventStatus(item);
  return `
    <article
      class="work-calendar-month-event-v11360 tone-${status.tone}"
      data-assignment-open="${fmt.escape(item.id)}"
      role="button"
      tabindex="0">
      <div>
        <span>${item.plannedStart?fmt.escape(timeOnly(item.plannedStart)):"Límite"}</span>
        ${item.hasPhoto?cameraIcon():""}
      </div>
      <strong>${fmt.escape(item.title||"Actividad")}</strong>
      <small>${fmt.escape(status.label)}</small>
    </article>`;
}

function compactEvent(item){
  const status=eventStatus(item);
  return `
    <article class="work-calendar-floating-event-v11360 tone-${status.tone}" data-assignment-open="${fmt.escape(item.id)}" role="button" tabindex="0">
      <strong>${fmt.escape(item.title||"Actividad")}</strong>
      <span>${fmt.escape(status.label)}</span>
    </article>`;
}

function personIdentity(person){
  const state=personState(person);
  return `
    <span class="work-calendar-avatar-v11360">${fmt.initials(person.name)}</span>
    <div class="work-calendar-person-copy-v11360">
      <strong>${fmt.escape(person.name)}</strong>
      <div class="work-calendar-person-state-v11360 tone-${state.tone}">
        <i></i>
        <span>${state.label}</span>
        ${person.activeTitle?`<button type="button" data-active-profile="${fmt.escape(person.id)}">${fmt.escape(person.activeTitle)}</button>`:""}
      </div>
    </div>`;
}

function personState(person){
  const status=String(person?.activeStatus||"").toUpperCase();
  if(status==="PAUSED")return {label:"En pausa",tone:"paused"};
  if(person?.activeTitle)return {label:"Ocupado",tone:"busy"};
  return {label:"Disponible",tone:"available"};
}

function eventStatus(item){
  const key=String(item?.memberStatus||item?.status||"PLANNED").toUpperCase();
  return STATUS_META[key]||{label:fmt.label(key),tone:"planned"};
}

function cancelButton(item){
  if(!item?.canCancel)return "";
  return `<button type="button" class="work-calendar-cancel-v11360" data-assignment-cancel="${fmt.escape(item.assignmentId||item.id)}" aria-label="Cancelar asignación">×</button>`;
}

function photoBadge(){
  return `<span class="work-calendar-photo-badge-v11360">${cameraIcon()}<span>Evidencia</span></span>`;
}

function clockIcon(){
  return '<svg class="work-calendar-icon-v11360" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8 8.009 8.009 0 0 1-8 8Zm1-8.414 3.207 3.207-1.414 1.414L11 12.414V6h2Z"/></svg>';
}

function cameraIcon(){
  return '<svg class="work-calendar-icon-v11360" viewBox="0 0 24 24" aria-hidden="true"><path d="M9.4 5 10.8 3h2.4l1.4 2H18a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3h3.4ZM12 8a4 4 0 1 0 4 4 4 4 0 0 0-4-4Zm0 2a2 2 0 1 1-2 2 2 2 0 0 1 2-2Z"/></svg>';
}

function nonWorking(title,detail){
  return `
    <section class="work-calendar-v11360 work-calendar-nonworking-v11360 card">
      <span>✦</span>
      <div><strong>${fmt.escape(title)}</strong><p>${fmt.escape(detail)}</p></div>
    </section>`;
}

function assignmentsForDay(rows,profileId,day){
  return (rows||[])
    .filter(item=>item.profileId===profileId&&sameDate(new Date(item.plannedStart||item.dueAt),day))
    .sort((a,b)=>new Date(a.plannedStart||a.dueAt)-new Date(b.plannedStart||b.dueAt));
}

function hourMarks(start,end){
  const from=toMinutes(start);
  const to=toMinutes(end);
  const duration=Math.max(1,to-from);
  const result=[];

  let mark=Math.ceil(from/60)*60;
  while(mark<to){
    result.push({
      left:100*(mark-from)/duration,
      label:`${String(Math.floor(mark/60)).padStart(2,"0")}:${String(mark%60).padStart(2,"0")}`
    });
    mark+=60;
  }

  return result;
}

function bogotaMinutes(value){
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

function timeOnly(value){
  if(!value)return "";
  return new Intl.DateTimeFormat("es-CO",{
    hour:"2-digit",
    minute:"2-digit",
    hour12:false,
    timeZone:"America/Bogota"
  }).format(new Date(value));
}

function toMinutes(value){
  const [hour,minute]=String(value||"0:0").split(":").map(Number);
  return hour*60+minute;
}

function sameDate(a,b){
  return isoDate(a)===isoDate(b);
}

function isoDate(value){
  const date=new Date(value);
  const year=date.getFullYear();
  const month=String(date.getMonth()+1).padStart(2,"0");
  const day=String(date.getDate()).padStart(2,"0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value){
  const [year,month,day]=String(value).split("-").map(Number);
  return new Date(year,month-1,day);
}

function isoWeekday(date){
  return ((new Date(date).getDay()+6)%7)+1;
}

function isToday(date){
  return isoDate(date)===isoDate(new Date());
}

function weekdayShort(date){
  return new Intl.DateTimeFormat("es-CO",{weekday:"short"}).format(date).replace(".","").replace(/^./,char=>char.toUpperCase());
}

function monthShort(date){
  return new Intl.DateTimeFormat("es-CO",{month:"short"}).format(date).replace(".","");
}
