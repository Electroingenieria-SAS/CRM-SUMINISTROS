import {fmt} from "../core/format.js";

const STYLE_ID="workforce-timeline-v11350-style";
const FINAL_STATES=new Set(["COMPLETED","SUBMITTED","WAITING_EVIDENCE","RETURNED","CANCELLED"]);
const PHOTO_TYPES=new Set(["BEFORE_PHOTO","AFTER_PHOTO","FINAL_PHOTO"]);

export function ensureWorkforceTimelineStyles(){
  if(typeof document==="undefined"||document.getElementById(STYLE_ID))return;
  const link=document.createElement("link");
  link.id=STYLE_ID;
  link.rel="stylesheet";
  link.href="./assets/runtime-css/workforce-timeline-v11350.css?v=11.35.4";
  document.head.appendChild(link);
}

export function composePlannerTimeline(raw={}){
  const assignments=Array.isArray(raw.assignments)?raw.assignments:[];
  const executions=Array.isArray(raw.executions)?raw.executions:[];
  const operationalExecutions=Array.isArray(raw.operationalExecutions)?raw.operationalExecutions:[];
  const canPlanTeam=Boolean(raw.permissions?.canPlanTeam);
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
    return timelineFromAssignment(assignment,execution,canPlanTeam);
  });

  for(const execution of executions){
    if(matched.has(execution.id))continue;
    timeline.push(timelineFromExecution(execution));
  }

  for(const execution of operationalExecutions){
    timeline.push(timelineFromOperational(execution));
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

export async function openWorkTimelineCard(item,loadDetail,loadPreview){
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
          <span class="work-timeline-kicker-v11350">${fmt.escape(item?.sourceType==="ORDER_PROCESS"?"Trabajo de pedido":item?.sourceType==="EXECUTION"?"Actividad registrada":"Actividad del cronograma")}</span>
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
    const resolvedDetail=detail||item;
    const firstPhoto=(Array.isArray(resolvedDetail?.evidence)?resolvedDetail.evidence:[]).find(isPhotoEvidence);
    const firstPreviewPromise=
      firstPhoto?.id&&firstPhoto?.driveFileId&&typeof loadPreview==="function"
        ? loadPreview(firstPhoto.id,firstPhoto.driveFileId)
        : null;

    layer.querySelector("[data-timeline-body]").innerHTML=timelineDetailHtml(resolvedDetail);
    bindEvidenceGallery(layer,resolvedDetail,loadPreview,firstPreviewPromise);
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
  if(typeof document==="undefined")return;
  document.querySelector("[data-work-timeline-layer]")?.remove();
}

function timelineFromAssignment(assignment,execution,canPlanTeam){
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
    previewEvidenceId:execution?.previewEvidenceId||null,
    previewDriveFileId:execution?.previewDriveFileId||null,
    canCancel:Boolean(canPlanTeam&&!execution&&!FINAL_STATES.has(String(status).toUpperCase()))
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
    previewEvidenceId:execution.previewEvidenceId||null,
    previewDriveFileId:execution.previewDriveFileId||null,
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
  const images=evidence.filter(isPhotoEvidence);
  const cover=images[0]||null;
  const status=detail.status||"PLANNED";
  const activeSeconds=Number(detail.activeSeconds||0);
  const planned=detail.plannedStart?timeRange(detail.plannedStart,detail.plannedEnd):"Sin bloque previo";
  const actual=detail.startedAt?timeRange(detail.startedAt,detail.endedAt):"Aún no iniciada";

  return `
    <section class="work-timeline-hero-v11350 ${cover?"has-photo":""}">
      ${cover?`
        <button type="button" class="work-timeline-photo-v11350 is-loading" data-timeline-photo-main data-evidence-id="${fmt.escape(cover.id||"")}" data-drive-file-id="${fmt.escape(cover.driveFileId||"")}" aria-label="Ver evidencia fotográfica">
          <span class="work-timeline-photo-loader-v11350">Cargando evidencia…</span>
          <img alt="Evidencia fotográfica de ${fmt.escape(detail.title||"actividad")}" hidden>
          <em>Fotografía de evidencia</em>
        </button>`:
        `<div class="work-timeline-photo-empty-v11350"><span>✓</span><div><strong>${fmt.escape(statusLabel(status))}</strong><small>${evidence.length?"Evidencia registrada":"Sin fotografía disponible"}</small></div></div>`}
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
      <button type="button" class="${index===0?"active":""}" data-timeline-thumb data-evidence-id="${fmt.escape(row.id||"")}" data-drive-file-id="${fmt.escape(row.driveFileId||"")}" aria-label="Ver evidencia ${index+1}">
        <span>${index+1}</span>
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
  const photo=isPhotoEvidence(row);
  const link=safeHttpUrl(row?.webViewLink);
  return `<article>
    <span class="work-timeline-evidence-icon-v11350">${photo?"📷":"◫"}</span>
    <div><strong>${fmt.escape(evidenceLabel(row?.type))}</strong><small>${fmt.escape(row?.fileName||row?.externalValue||"Registro de evidencia")}</small></div>
    <div class="work-timeline-evidence-actions-v11350">
      ${photo&&row?.driveFileId?`<button type="button" class="work-timeline-preview-btn-v11351" data-timeline-evidence-preview data-evidence-id="${fmt.escape(row.id||"")}" data-drive-file-id="${fmt.escape(row.driveFileId)}"><span class="work-timeline-preview-icon-v11351" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M9 5.5 10.3 4h3.4L15 5.5h2.75A2.25 2.25 0 0 1 20 7.75v8.5a2.25 2.25 0 0 1-2.25 2.25H6.25A2.25 2.25 0 0 1 4 16.25v-8.5A2.25 2.25 0 0 1 6.25 5.5H9Zm3 2.25A4.25 4.25 0 1 0 12 16.25 4.25 4.25 0 0 0 12 7.75Zm0 1.75A2.5 2.5 0 1 1 12 14.5 2.5 2.5 0 0 1 12 9.5Z"/></svg></span><span data-preview-label>Ver foto</span></button>`:""}
      ${link?`<a href="${link}" target="_blank" rel="noopener noreferrer">Original</a>`:""}
    </div>
  </article>`;
}

function bindEvidenceGallery(layer,detail,loadPreview,initialPreviewPromise=null){
  const evidence=Array.isArray(detail?.evidence)?detail.evidence:[];
  const first=evidence.find(isPhotoEvidence);
  const cover=layer.querySelector("[data-timeline-photo-main]");
  if(!cover)return;

  const setActionState=(evidenceId,state)=>{
    layer.querySelectorAll("[data-timeline-evidence-preview]").forEach(button=>{
      if(String(button.dataset.evidenceId||"")!==String(evidenceId||""))return;
      const label=button.querySelector("[data-preview-label]");
      button.disabled=state==="loading";
      button.classList.toggle("is-loading",state==="loading");
      if(label)label.textContent=state==="loading"?"Cargando…":state==="error"?"Reintentar":"Ver foto";
    });
  };

  const show=async(evidenceId,fileId)=>{
    const evidenceKey=String(evidenceId||"").trim();
    const driveId=String(fileId||"").trim();
    if(!evidenceKey||!driveId)return;

    const image=cover.querySelector("img");
    const loader=cover.querySelector(".work-timeline-photo-loader-v11350");
    cover.dataset.evidenceId=evidenceKey;
    cover.dataset.driveFileId=driveId;
    cover.classList.add("is-loading");
    cover.classList.remove("is-error","is-ready");
    setActionState(evidenceKey,"loading");
    if(loader){
      loader.hidden=false;
      loader.textContent="Cargando evidencia…";
    }

    try{
      if(typeof loadPreview!=="function")throw new Error("El visor de evidencia no está disponible. Actualiza la aplicación.");
      const preview=await (
        initialPreviewPromise&&first?.id===evidenceKey&&first?.driveFileId===driveId
          ? initialPreviewPromise
          : loadPreview(evidenceKey,driveId)
      );
      initialPreviewPromise=null;
      if(!layer.isConnected)return;
      if(!preview?.dataUrl)throw new Error("Drive no devolvió una vista previa válida.");

      image.hidden=false;
      image.classList.remove("is-visible");
      image.src=preview.dataUrl;

      if(typeof image.decode==="function"){
        await image.decode();
      }else{
        await new Promise((resolve,reject)=>{
          if(image.complete&&image.naturalWidth>0)return resolve();
          image.onload=()=>resolve();
          image.onerror=()=>reject(new Error("La fotografía recibida no pudo mostrarse."));
        });
      }

      if(!layer.isConnected)return;
      requestAnimationFrame(()=>{
        if(!layer.isConnected)return;
        cover.classList.remove("is-loading","is-error");
        cover.classList.add("is-ready");
        image.classList.add("is-visible");
        setActionState(evidenceKey,"ready");
        if(loader)loader.hidden=true;
      });
    }catch(error){
      if(!layer.isConnected)return;
      image.hidden=true;
      image.removeAttribute("src");
      cover.classList.remove("is-loading");
      cover.classList.add("is-error");
      setActionState(evidenceKey,"error");
      if(loader){
        loader.hidden=false;
        loader.textContent=(error?.message||"No fue posible cargar la fotografía.")+" Toca aquí para reintentar.";
      }
    }
  };

  cover.addEventListener("click",()=>{
    show(cover.dataset.evidenceId,cover.dataset.driveFileId);
  });

  if(first?.id&&first?.driveFileId)show(first.id,first.driveFileId);

  layer.querySelectorAll("[data-timeline-thumb]").forEach(button=>button.addEventListener("click",async()=>{
    layer.querySelectorAll("[data-timeline-thumb]").forEach(node=>node.classList.toggle("active",node===button));
    await show(button.dataset.evidenceId,button.dataset.driveFileId);
  }));

  layer.querySelectorAll("[data-timeline-evidence-preview]").forEach(button=>button.addEventListener("click",async()=>{
    const fileId=button.dataset.driveFileId;
    const thumb=[...layer.querySelectorAll("[data-timeline-thumb]")].find(node=>node.dataset.driveFileId===fileId);
    if(thumb)layer.querySelectorAll("[data-timeline-thumb]").forEach(node=>node.classList.toggle("active",node===thumb));
    await show(button.dataset.evidenceId,fileId);
    cover.scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"nearest"});
  }));
}

function isPhotoEvidence(row){
  const type=String(row?.type||"").toUpperCase();
  const mime=String(row?.mimeType||"").toLowerCase();
  return PHOTO_TYPES.has(type)||mime.startsWith("image/");
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

function safeHttpUrl(value){
  try{
    const url=new URL(String(value||""));
    return url.protocol==="https:"?url.href:"";
  }catch{return""}
}
