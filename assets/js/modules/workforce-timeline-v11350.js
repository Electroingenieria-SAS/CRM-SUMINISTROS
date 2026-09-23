import {fmt} from "../core/format.js";

const STYLE_ID="workforce-timeline-v11350-style";
const FINAL_STATES=new Set(["COMPLETED","SUBMITTED","WAITING_EVIDENCE","RETURNED","CANCELLED"]);

export function ensureWorkforceTimelineStyles(){
  if(typeof document==="undefined"||document.getElementById(STYLE_ID))return;
  const link=document.createElement("link");
  link.id=STYLE_ID;
  link.rel="stylesheet";
  link.href="./assets/runtime-css/workforce-timeline-v11350.css?v=11.35.0";
  document.head.appendChild(link);
}

export function composePlannerTimeline(raw={}){
  const assignments=Array.isArray(raw.assignments)?raw.assignments:[];
  const executions=Array.isArray(raw.executions)?raw.executions:[];
  const byAssignment=new Map();

  for(const execution of executions){
    if(!execution?.assignmentId)continue;
    const key=timelineAssignmentKey(execution.assignmentId,execution.profileId);
    const previous=byAssignment.get(key);
    if(!previous||dateValue(execution.startedAt)>dateValue(previous.startedAt))byAssignment.set(key,execution);
  }

  const matched=new Set();
  const timeline=assignments.map(assignment=>{
    const key=timelineAssignmentKey(assignment.id,assignment.profileId);
    const execution=byAssignment.get(key)||null;
    if(execution)matched.add(execution.id);
    return timelineFromAssignment(assignment,execution);
  });

  for(const execution of executions){
    if(matched.has(execution.id))continue;
    timeline.push(timelineFromExecution(execution));
  }

  timeline.sort((a,b)=>dateValue(a.plannedStart||a.dueAt)-dateValue(b.plannedStart||b.dueAt)||String(a.title||"").localeCompare(String(b.title||""),"es"));
  return timeline;
}

export function timelineDetailRequest(item={}){
  return {
    assignmentId:item.assignmentId||null,
    executionId:item.executionId||null,
    profileId:item.profileId||null
  };
}

export async function openWorkTimelineCard(item,loadDetail){
  if(typeof document==="undefined")return;
  closeWorkTimelineCard();

  const previousFocus=document.activeElement;
  const layer=document.createElement("div");
  layer.className="work-timeline-layer-v11350";
  layer.dataset.workTimelineLayer="";
  layer.innerHTML=`
    <button type="button" class="work-timeline-backdrop-v11350" data-timeline-close aria-label="Cerrar detalle"></button>
    <aside class="work-timeline-sheet-v11350" role="dialog" aria-modal="true" aria-label="Detalle de actividad" tabindex="-1">
      <header class="work-timeline-sheet-head-v11350">
        <div>
          <span class="work-timeline-kicker-v11350">${fmt.escape(item?.sourceType==="EXECUTION"?"Actividad registrada":"Actividad del cronograma")}</span>
          <h3>${fmt.escape(item?.title||"Actividad")}</h3>
        </div>
        <button type="button" class="work-timeline-close-v11350" data-timeline-close aria-label="Cerrar">×</button>
      </header>
      <div class="work-timeline-sheet-body-v11350" data-timeline-body>
        ${timelineSkeleton(item)}
      </div>
    </aside>`;

  document.body.appendChild(layer);
  const panel=layer.querySelector(".work-timeline-sheet-v11350");
  const close=()=>{
    layer.classList.add("is-closing");
    const remove=()=>{layer.remove();previousFocus?.focus?.({preventScroll:true})};
    if(matchMedia("(prefers-reduced-motion: reduce)").matches)return remove();
    setTimeout(remove,180);
  };
  layer.querySelectorAll("[data-timeline-close]").forEach(node=>node.addEventListener("click",close));
  const onKey=event=>{
    if(event.key==="Escape"){
      event.preventDefault();
      document.removeEventListener("keydown",onKey,true);
      close();
    }
  };
  document.addEventListener("keydown",onKey,true);
  panel.focus({preventScroll:true});

  try{
    const detail=await loadDetail();
    if(!layer.isConnected)return;
    layer.querySelector("[data-timeline-body]").innerHTML=timelineDetailHtml(detail||item);
    bindEvidenceGallery(layer);
  }catch(error){
    if(!layer.isConnected)return;
    layer.querySelector("[data-timeline-body]").innerHTML=`
      <div class="work-timeline-error-v11350">
        <span>!</span>
        <div><strong>No fue posible abrir el detalle</strong><p>${fmt.escape(error?.message||"Intenta nuevamente.")}</p></div>
      </div>`;
  }
}

export function closeWorkTimelineCard(){
  document?.querySelector?.("[data-work-timeline-layer]")?.remove();
}

function timelineFromAssignment(assignment,execution){
  const actualStart=execution?.startedAt||null;
  const actualEnd=execution?.endedAt||null;
  const displayStart=actualStart||assignment.plannedStart||assignment.dueAt||null;
  const displayEnd=actualEnd||assignment.plannedEnd||fallbackEnd(displayStart,execution?.activeSeconds||assignment.estimatedMinutes*60);
  const status=execution?.status||assignment.memberStatus||"PLANNED";
  return {
    ...assignment,
    id:String(assignment.id),
    assignmentId:assignment.id,
    executionId:execution?.id||null,
    sourceType:"ASSIGNMENT",
    source:execution?.source||"PLANNED",
    scheduledStart:assignment.plannedStart||null,
    scheduledEnd:assignment.plannedEnd||null,
    actualStart,
    actualEnd,
    plannedStart:displayStart,
    plannedEnd:displayEnd,
    memberStatus:status,
    activeSeconds:Number(execution?.activeSeconds||0),
    evidenceCount:Number(execution?.evidenceCount||0),
    hasPhoto:Boolean(execution?.hasPhoto),
    canCancel:!execution&&!FINAL_STATES.has(String(status).toUpperCase())
  };
}

function timelineFromExecution(execution){
  const displayStart=execution.startedAt||null;
  return {
    id:`execution:${execution.id}`,
    assignmentId:execution.assignmentId||null,
    executionId:execution.id,
    sourceType:"EXECUTION",
    source:execution.source||"MANUAL",
    title:execution.title||execution.catalogName||"Actividad",
    kind:execution.kind||"ACTIVITY",
    priority:"MEDIUM",
    catalogId:execution.catalogId||null,
    catalogName:execution.catalogName||"Actividad",
    profileId:execution.profileId,
    profileName:execution.profileName,
    scheduledStart:null,
    scheduledEnd:null,
    actualStart:execution.startedAt||null,
    actualEnd:execution.endedAt||null,
    plannedStart:displayStart,
    plannedEnd:execution.endedAt||fallbackEnd(displayStart,execution.activeSeconds),
    dueAt:null,
    estimatedMinutes:Math.max(1,Math.round(Number(execution.activeSeconds||0)/60)),
    memberStatus:execution.status||"COMPLETED",
    activeSeconds:Number(execution.activeSeconds||0),
    evidenceCount:Number(execution.evidenceCount||0),
    hasPhoto:Boolean(execution.hasPhoto),
    canCancel:false
  };
}

function timelineSkeleton(item){
  return `<div class="work-timeline-summary-v11350">
    <div class="work-timeline-summary-state-v11350"><span class="pulse"></span><strong>${fmt.escape(statusLabel(item?.memberStatus))}</strong></div>
    <div class="work-timeline-summary-grid-v11350">
      <span><small>Responsable</small><b>${fmt.escape(item?.profileName||"—")}</b></span>
      <span><small>Hora</small><b>${fmt.escape(timeRange(item?.actualStart||item?.plannedStart,item?.actualEnd||item?.plannedEnd))}</b></span>
    </div>
  </div>
  <div class="work-timeline-loading-v11350"><i></i><i></i><i></i></div>`;
}

function timelineDetailHtml(detail={}){
  const evidence=Array.isArray(detail.evidence)?detail.evidence:[];
  const images=evidence.filter(row=>safePreviewUrl(row?.preview?.data));
  const cover=images[0]||null;
  const status=detail.status||"PLANNED";
  const activeSeconds=Number(detail.activeSeconds||0);
  const planned=detail.plannedStart?timeRange(detail.plannedStart,detail.plannedEnd):"Sin bloque previo";
  const actual=detail.startedAt?timeRange(detail.startedAt,detail.endedAt):"Aún no iniciada";
  return `
    <section class="work-timeline-hero-v11350 ${cover?"has-photo":""}">
      ${cover?`<button type="button" class="work-timeline-photo-v11350" data-timeline-photo-main aria-label="Ampliar evidencia">
        <img src="${safePreviewUrl(cover.preview.data)}" alt="Evidencia fotográfica de ${fmt.escape(detail.title||"actividad")}">
        <span>Fotografía de evidencia</span>
      </button>`:`<div class="work-timeline-photo-empty-v11350"><span>✓</span><div><strong>${fmt.escape(statusLabel(status))}</strong><small>${evidence.length?"Evidencia registrada sin miniatura":"Sin fotografía disponible"}</small></div></div>`}
      <div class="work-timeline-hero-copy-v11350">
        <div class="work-timeline-badges-v11350">
          <span class="state ${statusTone(status)}">${fmt.escape(statusLabel(status))}</span>
          <span>${fmt.escape(detail.source==="MANUAL"?"Registro espontáneo":"Actividad programada")}</span>
          ${evidence.length?`<span class="photo">📷 ${evidence.length} evidencia${evidence.length===1?"":"s"}</span>`:""}
        </div>
        <h4>${fmt.escape(detail.title||"Actividad")}</h4>
        <p>${fmt.escape(detail.description||detail.resultNote||"Actividad registrada en la jornada de trabajo.")}</p>
      </div>
    </section>

    ${images.length>1?`<div class="work-timeline-gallery-v11350">${images.map((row,index)=>`
      <button type="button" class="${index===0?"active":""}" data-timeline-thumb="${index}" data-preview="${safePreviewUrl(row.preview.data)}" aria-label="Ver evidencia ${index+1}">
        <img src="${safePreviewUrl(row.preview.data)}" alt="">
      </button>`).join("")}</div>`:""}

    <section class="work-timeline-facts-v11350">
      ${fact("Responsable",detail.profileName||"—")}
      ${fact("Programación",planned)}
      ${fact("Ejecución real",actual)}
      ${fact("Tiempo activo",durationLabel(activeSeconds))}
      ${fact("Pausas",durationLabel(Number(detail.pausedSeconds||0)))}
      ${fact("Catálogo",detail.catalogName||fmt.label(detail.kind||"ACTIVITY"))}
    </section>

    ${Array.isArray(detail.participants)&&detail.participants.length>1?`<section class="work-timeline-section-v11350"><header><span>Equipo</span><strong>Participantes</strong></header><div class="work-timeline-people-v11350">${detail.participants.map(person=>`<span><b class="avatar">${fmt.initials(person.profileName)}</b><em>${fmt.escape(person.profileName)}</em><small>${fmt.escape(statusLabel(person.status))}</small></span>`).join("")}</div></section>`:""}

    ${evidence.length?`<section class="work-timeline-section-v11350"><header><span>Evidencia</span><strong>Registro de la actividad</strong></header><div class="work-timeline-evidence-v11350">${evidence.map(evidenceRow).join("")}</div></section>`:""}

    <footer class="work-timeline-foot-v11350"><span>La actividad y su evidencia se conservan en la trazabilidad institucional.</span></footer>`;
}

function evidenceRow(row){
  const preview=safePreviewUrl(row?.preview?.data);
  const link=safeHttpUrl(row?.webViewLink);
  return `<article>
    <span class="work-timeline-evidence-icon-v11350">${preview?"📷":"◫"}</span>
    <div><strong>${fmt.escape(evidenceLabel(row?.type))}</strong><small>${fmt.escape(row?.fileName||row?.externalValue||"Registro de evidencia")}</small></div>
    ${link?`<a href="${link}" target="_blank" rel="noopener noreferrer">Original</a>`:""}
  </article>`;
}

function bindEvidenceGallery(layer){
  const main=layer.querySelector("[data-timeline-photo-main] img");
  if(!main)return;
  layer.querySelectorAll("[data-timeline-thumb]").forEach(button=>button.addEventListener("click",()=>{
    const src=safePreviewUrl(button.dataset.preview);
    if(!src)return;
    main.src=src;
    layer.querySelectorAll("[data-timeline-thumb]").forEach(node=>node.classList.toggle("active",node===button));
  }));
}

function fact(label,value){
  return `<div><small>${fmt.escape(label)}</small><strong>${fmt.escape(String(value||"—"))}</strong></div>`;
}

function timelineAssignmentKey(assignmentId,profileId){
  return `${String(assignmentId||"")}:${String(profileId||"")}`;
}

function fallbackEnd(start,seconds){
  if(!start)return null;
  const duration=Math.max(15*60,Number(seconds||0));
  return new Date(new Date(start).getTime()+duration*1000).toISOString();
}

function dateValue(value){
  const n=new Date(value||0).getTime();
  return Number.isFinite(n)?n:0;
}

function statusLabel(status){
  return ({
    PLANNED:"Programada",READY:"Lista",IN_PROGRESS:"En curso",PAUSED:"En pausa",
    WAITING_EVIDENCE:"Pendiente de evidencia",SUBMITTED:"En revisión",COMPLETED:"Realizada",
    RETURNED:"Devuelta",CANCELLED:"Cancelada"
  })[String(status||"PLANNED").toUpperCase()]||fmt.label(status||"PLANNED");
}

function statusTone(status){
  const code=String(status||"PLANNED").toLowerCase().replace(/[^a-z0-9_-]/g,"");
  return `status-${code}`;
}

function evidenceLabel(type){
  return ({
    BEFORE_PHOTO:"Foto inicial",AFTER_PHOTO:"Foto final",FINAL_PHOTO:"Foto final",
    FILE:"Archivo",LINK:"Enlace",ERP_REFERENCE:"Referencia ERP"
  })[String(type||"").toUpperCase()]||fmt.label(type||"Evidencia");
}

function timeRange(start,end){
  if(!start)return"—";
  const formatter=new Intl.DateTimeFormat("es-CO",{hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"America/Bogota"});
  const from=formatter.format(new Date(start));
  return end?`${from}–${formatter.format(new Date(end))}`:from;
}

function durationLabel(seconds){
  const total=Math.max(0,Math.round(Number(seconds||0)));
  if(!total)return"—";
  const hours=Math.floor(total/3600);
  const minutes=Math.round((total%3600)/60);
  return hours?`${hours} h ${minutes} min`:`${Math.max(1,minutes)} min`;
}

function safePreviewUrl(value){
  const text=String(value||"").trim();
  return /^data:image\/(?:webp|jpeg|png);base64,[a-z0-9+/=]+$/i.test(text)?text:"";
}

function safeHttpUrl(value){
  try{
    const url=new URL(String(value||""));
    return url.protocol==="https:"?url.href:"";
  }catch{return""}
}
