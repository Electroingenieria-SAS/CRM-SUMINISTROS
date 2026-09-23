import {api} from "../services/api.js";
import {fmt,statusBadge,priorityBadge} from "../core/format.js";
import {loading,empty,modal,wizard,toast} from "../core/ui.js";
import {state} from "../core/state.js";
import {uploadWorkEvidence,loadWorkEvidencePreview} from "../services/drive.js";
import {icon} from "../core/icons.js";
import {normalizePlannerCalendar,plannerRangeForMode,nextBusinessAnchor,plannerTitleForMode,teamCapacityHtml} from "./workforce-planner-v11330.js";
import {timeTrafficLight,trafficHelp,elapsedActiveSeconds,finalEvidenceType} from "./workforce-today-v11340.js";
import {catalogTaxonomy,catalogBrowserHtml,categoryStageHtml,subcategoryStageHtml,activityStageHtml,selectedActivityHtml,catalogBreadcrumbHtml} from "./workforce-catalog-v11343.js";
import {ensureWorkforceExperienceStyles} from "./workforce-experience-v11344.js";
import {ensureWorkforceTimelineStyles,composePlannerTimeline} from "./workforce-timeline-v11350.js";
import {createWorkEvidenceManager} from "./workforce-evidence-manager-v11360.js";
import {ensureWorkforceCalendarStyles,renderWorkforceCalendarBoard,bindWorkforceCalendar} from "./workforce-calendar-v11360.js";

let liveTimer=null;
let currentView="today";
let plannerMode="week";
let plannerAnchor=new Date();
let plannerFilters={profileId:"ALL",weekday:"ALL",fromTime:"07:00",toTime:"17:30"};
let plannerCalendarCache=null;
let plannerCatalogCache=null;
let plannerCalendarCleanup=null;
const workEvidenceManager=createWorkEvidenceManager(loadWorkEvidencePreview,{maxBytes:8*1024*1024,maxEntries:5});
let analyticsRange={from:isoDate(addDays(new Date(),-29)),to:isoDate(new Date())};

const GROUP_LABELS={LOGISTICS:"Operación logística",COMMERCIAL:"Comercial",FINANCE:"Financiera",PURCHASING:"Compras",MANAGEMENT:"Gestión",GENERAL:"General",IMPROVEMENT:"Mejora continua"};
const PAUSE_REASONS={OTHER:"Otra causa",WAIT_MATERIAL:"Espera de material",WAIT_EQUIPMENT:"Espera de equipo",PRIORITY_CHANGE:"Cambio de prioridad",SUPPORT_OTHER:"Apoyo a otra operación",BREAK:"Pausa programada",INCIDENT:"Novedad / incidente"};
const DEVIATION_REASONS={"":"Sin causa especial",MATERIAL:"Material no disponible",INTERRUPTION:"Interrupción / prioridad urgente",EQUIPMENT:"Equipo o herramienta",COMPLEXITY:"Mayor complejidad",REWORK:"Corrección o retrabajo",WAITING:"Espera de tercero",OTHER:"Otra causa"};

export async function renderWorkforce(root){
  ensureWorkforceExperienceStyles();
  ensureWorkforceTimelineStyles();
  ensureWorkforceCalendarStyles();
  clearInterval(liveTimer);
  root.innerHTML=`
    <section class="page-head workforce-page-head">
      <div><span class="workforce-kicker">Organiza · ejecuta · demuestra</span><h2>Jornada y actividades</h2><p>Tu espacio diario para revisar prioridades, registrar avances y mantener el cronograma del equipo bajo control.</p></div>
      <div class="page-actions"><button class="btn btn-ghost" data-work-refresh>${icon("refresh")}<span>Actualizar jornada</span></button></div>
    </section>
    <nav class="workforce-tabs" aria-label="Vistas de actividades">
      <button class="workforce-tab ${currentView==="today"?"active":""}" data-work-view="today">${icon("activity")}<span><strong>Mi jornada</strong><small>Elegir · iniciar · foto</small></span></button>
      <button class="workforce-tab ${currentView==="planner"?"active":""}" data-work-view="planner">${icon("calendar")}<span><strong>Cronograma</strong><small>Día · semana · mes</small></span></button>
      <button class="workforce-tab ${currentView==="analytics"?"active":""}" data-work-view="analytics">${icon("reports")}<span><strong>Indicadores</strong><small>Carga y resultados</small></span></button>
    </nav>
    <section id="workforce-content">${loading("Preparando tu jornada…")}</section>`;

  root.querySelector("[data-work-refresh]").onclick=()=>renderCurrent(root,true);
  root.querySelectorAll("[data-work-view]").forEach(button=>button.onclick=()=>{
    currentView=button.dataset.workView;
    root.querySelectorAll("[data-work-view]").forEach(b=>b.classList.toggle("active",b===button));
    renderCurrent(root);
  });
  await renderCurrent(root);
}

async function renderCurrent(root,force=false){
  clearInterval(liveTimer);
  plannerCalendarCleanup?.();
  plannerCalendarCleanup=null;
  const content=root.querySelector("#workforce-content");
  if(!content)return;
  content.innerHTML=loading();
  if(currentView==="planner")return renderPlanner(root,content);
  if(currentView==="analytics")return renderAnalytics(root,content);
  return renderToday(root,content,force);
}

async function renderToday(root,content,prefetchedData=null){
  const data=prefetchedData||await api.workMyDay();
  const plannerTab=root.querySelector('[data-work-view="planner"]');
  if(plannerTab)plannerTab.hidden=false;
  const active=Boolean(data.active);
  const pending=(data.summary?.pendingEvidence||0)+(data.summary?.pendingReview||0);
  const scheduled=[...(data.overdue||[]),...(data.today||[])];
  content.innerHTML=`
    <section class="workday-guide ${active?"is-running":"is-ready"}">
      <div class="workday-guide-copy">
        <span class="workday-eyebrow">MI JORNADA</span>
        <h2>${active?"Actividad en curso":"Elige con calma. Inicia cuando estés seguro."}</h2>
        <p>${active?"El CRM registra el tiempo automáticamente y te avisará con el semáforo.":"Navega por categoría, subcategoría y actividad. Nada empieza hasta que confirmes “Iniciar actividad”."}</p>
      </div>
      <div class="workday-traffic-legend" aria-label="Semáforo de tiempo de actividad">
        <span class="green"><i></i><b>Verde</b><small>Menos de 45 min</small></span>
        <span class="yellow"><i></i><b>Amarillo</b><small>45 a 60 min</small></span>
        <span class="red"><i></i><b>Rojo</b><small>Más de 60 min · genera alerta</small></span>
      </div>
    </section>

    <section class="workday-steps" aria-label="Pasos de Mi jornada">
      <article class="workday-step ${active?"done":"current"}"><b>1</b><span><strong>Elige</strong><small>Categoría → subcategoría → actividad</small></span></article>
      <article class="workday-step ${active?"current":""}"><b>2</b><span><strong>Trabaja</strong><small>El tiempo se registra solo</small></span></article>
      <article class="workday-step"><b>3</b><span><strong>Finaliza</strong><small>Foto obligatoria en Drive</small></span></article>
    </section>

    ${activeWorkCard(data.active)}

    <section class="workday-status-strip">
      <article><span class="workday-status-icon">◷</span><div><small>Tiempo activo hoy</small><strong>${fmt.hours(data.summary?.activeSeconds)}</strong></div></article>
      <article><span class="workday-status-icon">✓</span><div><small>Completadas</small><strong>${fmt.number(data.summary?.completed)}</strong></div></article>
      <article class="${pending?"attention":""}"><span class="workday-status-icon">!</span><div><small>Pendientes</small><strong>${fmt.number(pending)}</strong></div></article>
    </section>

    <section class="card workday-launch-card">
      <header class="card-head">
        <div><h3>${active?"Selecciona tu próxima actividad":"¿Qué vas a hacer ahora?"}</h3><p>${active?"Puedes revisar el catálogo, pero no podrás iniciar otra hasta cerrar la actual.":"Solo seleccionarás opciones. El cronómetro inicia después de una confirmación explícita."}</p></div>
        <span class="workday-safe-chip">Selección segura</span>
      </header>
      <div class="card-body">${catalogHtml(data.catalog||[],active)}</div>
    </section>

    ${scheduled.length?`<section class="card workforce-agenda-card workday-agenda-card">
      <header class="card-head"><div><h3>Programado para ti</h3><p>Actividades planificadas para hoy. También requieren confirmación antes de iniciar.</p></div><span class="workforce-count">${scheduled.length}</span></header>
      <div class="card-body workforce-agenda-list">${agendaHtml(data)}</div>
    </section>`:`<section class="workday-no-schedule"><span>✓</span><div><strong>Sin actividades programadas para hoy</strong><small>Puedes trabajar normalmente desde el catálogo superior.</small></div></section>`}

    <section class="card workforce-history-card workday-history-card">
      <header class="card-head"><div><h3>Actividad de hoy</h3><p>Tiempo real, semáforo, evidencia fotográfica y revisiones.</p></div></header>
      <div class="card-body">${historyHtml(data.history||[])}</div>
    </section>`;

  bindTodayActions(content,data);
  startLiveClock(content,data.active);
}

function activeWorkCard(active){
  if(!active)return `<section class="work-active-console idle">
    <div class="work-active-idle-icon">${icon("play")}</div>
    <div class="work-active-idle-copy"><small>Estado actual</small><strong>Sin actividad en curso</strong><p>Selecciona categoría, subcategoría y actividad. El cronómetro solo inicia después de confirmar.</p></div>
  </section>`;

  const metrics=active.metrics||{};
  const paused=active.status==="PAUSED";
  const types=new Set((active.evidence||[]).map(x=>x.type));
  const needsBefore=active.evidencePolicy==="BEFORE_AFTER"&&!types.has("BEFORE_PHOTO");
  const activeSeconds=elapsedActiveSeconds(active);
  const traffic=timeTrafficLight(activeSeconds);

  return `<section class="work-active-console running ${paused?"paused":""}" data-active-execution="${fmt.escape(active.id)}" data-started-at="${fmt.escape(active.startedAt)}" data-base-elapsed="${Number(metrics.elapsedSeconds||0)}" data-paused="${paused}">
    <div class="work-active-context">
      <span class="work-active-state"><i></i>${paused?"Actividad pausada":"Trabajando ahora"}</span>
      <strong>${fmt.escape(active.title)}</strong>
      <small>${fmt.escape(active.catalogName||"")}${active.plannedStart?` · Programada ${timeOnly(active.plannedStart)}`:""}</small>
    </div>

    <div class="work-timer-panel">
      <div class="work-timer-face">
        <span>Tiempo activo</span>
        <strong data-live-clock>${clock(activeSeconds)}</strong>
      </div>
      <div class="work-timer-traffic tone-${traffic.tone}" data-time-traffic data-tone="${traffic.tone}">
        <span class="work-traffic-light"><i></i><i></i><i></i></span>
        <div><b data-traffic-label>${traffic.label}</b><small data-traffic-help>${trafficHelp(activeSeconds)}</small></div>
      </div>
    </div>

    <div class="work-active-controls">
      ${needsBefore?`<button class="btn btn-ghost" data-work-before-photo>${icon("activity")}<span>Foto inicial</span></button>`:""}
      ${paused?`<button class="btn btn-primary" data-work-resume>${icon("play")}<span>Reanudar</span></button>`:`<button class="btn btn-ghost" data-work-pause>${icon("pause")}<span>Pausar</span></button>`}
      <button class="btn btn-success" data-work-finish ${needsBefore?'disabled title="Toma primero la foto inicial"':""}>${icon("check")}<span>${needsBefore?"Foto inicial pendiente":"Finalizar + foto"}</span></button>
    </div>
  </section>`;
}

function summaryCard(label,value,detail,iconName,tone){return `<article class="workforce-summary-card tone-${tone}"><span class="workforce-summary-icon">${icon(iconName)}</span><div><span>${fmt.escape(label)}</span><strong>${fmt.escape(String(value))}</strong><small>${fmt.escape(detail)}</small></div></article>`}

function agendaHtml(data){
  const overdue=data.overdue||[],today=data.today||[],upcoming=data.upcoming||[];
  if(!overdue.length&&!today.length&&!upcoming.length)return empty("Jornada sin actividades programadas","Puedes iniciar una actividad espontánea desde el catálogo.");
  return `
    ${overdue.length?`<div class="agenda-section overdue"><div class="agenda-section-title"><strong>Vencidas</strong><span>${overdue.length}</span></div>${overdue.map(a=>agendaRow(a,true,Boolean(data.active))).join("")}</div>`:""}
    ${today.length?`<div class="agenda-section"><div class="agenda-section-title"><strong>Hoy</strong><span>${today.length}</span></div>${today.map(a=>agendaRow(a,false,Boolean(data.active))).join("")}</div>`:""}
    ${upcoming.length?`<div class="agenda-section upcoming"><div class="agenda-section-title"><strong>Próximos 7 días</strong><span>${upcoming.length}</span></div>${upcoming.map(upcomingRow).join("")}</div>`:""}`;
}

function agendaRow(a,overdue,hasActive){
  return `<article class="agenda-row ${overdue?"is-overdue":""}">
    <div class="agenda-time"><strong>${a.plannedStart?timeOnly(a.plannedStart):a.dueAt?"Límite":"—"}</strong><span>${a.plannedEnd?timeOnly(a.plannedEnd):a.dueAt?fmt.day(a.dueAt):""}</span></div>
    <div class="agenda-main"><div>${priorityBadge(a.priority)} ${a.kind==="DELIVERABLE"?'<span class="badge badge-blue"><span class="badge-dot"></span>Entregable</span>':""}</div><strong>${fmt.escape(a.title)}</strong><small>${fmt.escape(a.catalogName||a.kind||"")}${a.dueAt?` · vence ${fmt.date(a.dueAt)}`:""} · tiempo automático</small></div>
    <div class="agenda-actions"><button class="btn btn-primary" data-select-assignment="${fmt.escape(a.id)}" data-catalog-id="${fmt.escape(a.catalogId||"")}" ${hasActive||!a.catalogId?"disabled":""}>${icon("activity")}<span>Seleccionar</span></button></div>
  </article>`;
}

function upcomingRow(a){return `<article class="agenda-row compact"><div class="agenda-time"><strong>${a.plannedStart?weekdayShort(a.plannedStart):"Límite"}</strong><span>${a.plannedStart?timeOnly(a.plannedStart):fmt.day(a.dueAt)}</span></div><div class="agenda-main"><strong>${fmt.escape(a.title)}</strong><small>${fmt.escape(a.catalogName||fmt.label(a.kind))}</small></div></article>`}

function catalogHtml(catalog,disabled){
  return catalogBrowserHtml(catalog,disabled);
}

function historyHtml(rows){
  if(!rows.length)return empty("Aún no has registrado actividades hoy","Cuando finalices una actividad aparecerá aquí.");
  return `<div class="work-history-list">${rows.map(row=>{
    const evidencePending=row.status==="WAITING_EVIDENCE";
    const reviewPending=row.status==="SUBMITTED";
    const traffic=timeTrafficLight(row.activeSeconds||0);
    return `<article class="work-history-row">
      <div class="work-history-time"><strong>${timeOnly(row.startedAt)}</strong><span>${row.endedAt?timeOnly(row.endedAt):"En curso"}</span></div>
      <div class="work-history-main"><div>${statusBadge(row.status)} <span class="work-mini-traffic tone-${traffic.tone}"><i></i>${traffic.label}</span></div><strong>${fmt.escape(row.title)}</strong><small>${fmt.hours(row.activeSeconds)} activas · ${fmt.hours(row.pausedSeconds)} pausa · ${fmt.escape(GROUP_LABELS[row.activityGroup]||fmt.label(row.activityGroup))}</small></div>
      <div class="work-history-actions">${evidencePending?`<button class="btn btn-primary" data-add-evidence="${fmt.escape(row.id)}" data-policy="${fmt.escape(row.evidencePolicy||"")}" data-title="${fmt.escape(row.title)}">Subir foto pendiente</button>`:reviewPending?'<span class="work-awaiting-review">Pendiente de revisión</span>':(row.evidence||[]).length?`<span class="work-evidence-count">${row.evidence.length} evidencia(s)</span>`:""}</div>
    </article>`;
  }).join("")}</div>`;
}

function bindTodayActions(content,data){
  bindCatalogBrowser(content,data);

  content.querySelectorAll("[data-select-assignment]").forEach(button=>button.onclick=()=>{
    const all=[...(data.overdue||[]),...(data.today||[]),...(data.upcoming||[])];
    const assignment=all.find(row=>row.id===button.dataset.selectAssignment);
    if(!assignment)return;
    modal({
      title:"Confirmar inicio",
      confirmLabel:"Iniciar actividad",
      cancelLabel:"Cancelar",
      body:`<div class="work-start-dialog"><span>Actividad programada</span><strong>${fmt.escape(assignment.title)}</strong><small>${fmt.escape(assignment.catalogName||assignment.kind||"")}${assignment.plannedStart?` · ${fmt.date(assignment.plannedStart)}`:""}</small><p>El cronómetro no comenzará hasta que confirmes este paso.</p></div>`,
      onConfirm:async()=>{
        await api.workStart(button.dataset.catalogId,button.dataset.selectAssignment,{});
        toast("Actividad programada iniciada.");
        window.dispatchEvent(new CustomEvent("erp:refresh-workforce"));
        await rerenderWorkforceContent(content);
      }
    });
  });

  content.querySelector("[data-work-pause]")?.addEventListener("click",()=>pauseDialog(data.active,content));
  content.querySelector("[data-work-resume]")?.addEventListener("click",async event=>{const button=event.currentTarget;button.disabled=true;try{await api.workResume(data.active.id);toast("Actividad reanudada.");await rerenderWorkforceContent(content)}catch(error){toast(error.message,"error");button.disabled=false}});
  content.querySelector("[data-work-finish]")?.addEventListener("click",()=>finishDialog(data.active,content));
  content.querySelector("[data-work-before-photo]")?.addEventListener("click",()=>photoPicker(data.active,"BEFORE_PHOTO",content));
  content.querySelectorAll("[data-add-evidence]").forEach(button=>button.onclick=()=>evidenceDialog({id:button.dataset.addEvidence,evidencePolicy:button.dataset.policy,title:button.dataset.title},content));
}

function bindCatalogBrowser(content,data){
  const browser=content.querySelector("[data-work-catalog-browser]");
  if(!browser)return;
  const tree=catalogTaxonomy(data.catalog||[]);
  const stage=browser.querySelector("[data-work-catalog-stage]");
  const selected=browser.querySelector("[data-work-selected]");
  const breadcrumb=browser.querySelector("[data-work-catalog-breadcrumb]");
  let currentCategory=null;
  let currentSubcategory=null;

  const setProgress=level=>{
    browser.dataset.level=level;
    const levels=["category","subcategory","activity"];
    const index=levels.indexOf(level);
    browser.querySelectorAll("[data-catalog-progress]").forEach(node=>{
      const nodeIndex=levels.indexOf(node.dataset.catalogProgress);
      node.classList.toggle("active",nodeIndex===index);
      node.classList.toggle("done",nodeIndex<index);
    });
  };

  const renderCategories=()=>{
    currentCategory=null;
    currentSubcategory=null;
    stage.innerHTML=categoryStageHtml(tree,Boolean(data.active));
    selected.innerHTML="";
    breadcrumb.innerHTML=catalogBreadcrumbHtml();
    setProgress("category");
  };

  const renderSubcategories=category=>{
    currentCategory=category;
    currentSubcategory=null;
    stage.innerHTML=subcategoryStageHtml(category);
    selected.innerHTML="";
    breadcrumb.innerHTML=catalogBreadcrumbHtml({category});
    setProgress("subcategory");
  };

  const renderActivities=(category,subcategory)=>{
    currentCategory=category;
    currentSubcategory=subcategory;
    stage.innerHTML=activityStageHtml(category,subcategory);
    selected.innerHTML="";
    breadcrumb.innerHTML=catalogBreadcrumbHtml({category,subcategory});
    setProgress("activity");
  };

  browser.addEventListener("click",async event=>{
    const back=event.target.closest("[data-work-level-back]");
    if(back){
      if(back.dataset.workLevelBack==="category")renderCategories();
      else if(back.dataset.workLevelBack==="subcategory"&&currentCategory)renderSubcategories(currentCategory);
      return;
    }

    const categoryButton=event.target.closest("[data-work-category]");
    if(categoryButton){
      const category=tree.find(row=>row.key===categoryButton.dataset.workCategory);
      if(category)renderSubcategories(category);
      return;
    }

    const subButton=event.target.closest("[data-work-subcategory]");
    if(subButton&&currentCategory){
      const subcategory=currentCategory.subcategories.find(row=>row.label===subButton.dataset.workSubcategory);
      if(subcategory)renderActivities(currentCategory,subcategory);
      return;
    }

    const activityButton=event.target.closest("[data-work-activity-select]");
    if(activityButton){
      const item=(data.catalog||[]).find(row=>row.id===activityButton.dataset.workActivitySelect);
      if(!item)return;
      stage.querySelectorAll("[data-work-activity-select]").forEach(node=>node.classList.toggle("selected",node===activityButton));
      selected.innerHTML=selectedActivityHtml(item);
      requestAnimationFrame(()=>selected.scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"nearest"}));
      return;
    }

    if(event.target.closest("[data-work-selection-cancel]")){
      selected.innerHTML="";
      stage.querySelectorAll("[data-work-activity-select]").forEach(node=>node.classList.remove("selected"));
      return;
    }

    const confirmButton=event.target.closest("[data-work-start-confirmed]");
    if(confirmButton){
      confirmButton.disabled=true;
      try{
        await api.workStart(confirmButton.dataset.workStartConfirmed,null,{});
        toast("Actividad iniciada. El cronómetro ya está registrando tu tiempo.");
        await rerenderWorkforceContent(content);
      }catch(error){
        toast(error.message,"error",7000);
        confirmButton.disabled=false;
      }
    }
  });
}

async function rerenderWorkforceContent(content){
  const page=content.closest("#page-content");
  if(!page)return location.reload();
  const root=page;
  await renderCurrent(root);
}

function pauseDialog(active,content){
  modal({title:"Pausar actividad",confirmLabel:"Pausar",body:`<div class="form-grid"><div class="field"><label>Motivo de la pausa</label><select class="control" name="reason">${Object.entries(PAUSE_REASONS).map(([value,label])=>`<option value="${value}">${fmt.escape(label)}</option>`).join("")}</select></div><div class="field full"><label>Nota opcional</label><textarea class="control" name="note" rows="3" placeholder="Contexto breve de la pausa"></textarea></div></div>`,onConfirm:async dialog=>{await api.workPause(active.id,dialog.querySelector('[name="reason"]').value,dialog.querySelector('[name="note"]').value);toast("Actividad pausada.");await rerenderWorkforceContent(content)}});
}

function finishDialog(active,content){
  const activeSeconds=elapsedActiveSeconds(active);
  const traffic=timeTrafficLight(activeSeconds);
  const dialog=modal({
    title:"Finalizar actividad",
    confirmLabel:"",
    cancelLabel:"Seguir trabajando",
    body:`<div class="work-finish-simple">
      <div class="work-finish-summary"><strong>${fmt.escape(active.title)}</strong><span>Tiempo registrado: <b>${clock(activeSeconds)}</b></span></div>
      <div class="work-time-traffic large tone-${traffic.tone}">
        <span class="work-traffic-light"><i></i><i></i><i></i></span>
        <div><b>${traffic.label}</b><small>${trafficHelp(activeSeconds)}</small></div>
      </div>
      <div class="work-photo-required">
        <span class="work-photo-required-icon">📷</span>
        <div><strong>Foto final obligatoria</strong><p>Para finalizar debes tomar una foto o subir una foto de la actividad terminada. Se guardará mediante el script institucional en Google Drive.</p></div>
      </div>
      <div class="work-photo-actions">
        <button type="button" class="btn btn-primary" data-finish-camera>Tomar foto</button>
        <button type="button" class="btn btn-ghost" data-finish-upload>Subir foto</button>
      </div>
      ${traffic.review?'<div class="work-review-warning"><strong>Pendiente de revisión</strong><span>Esta actividad superó 1 hora. El sistema la enviará automáticamente a revisión cuando adjuntes la foto.</span></div>':""}
    </div>`
  });
  dialog.root.querySelector("[data-finish-camera]").onclick=()=>finishWithPhoto(active,content,dialog,true);
  dialog.root.querySelector("[data-finish-upload]").onclick=()=>finishWithPhoto(active,content,dialog,false);
}

async function finishWithPhoto(active,content,dialog,useCamera){
  const file=await pickFinalPhoto(useCamera);
  if(!file)return;
  const buttons=[...dialog.root.querySelectorAll("[data-finish-camera],[data-finish-upload]")];
  buttons.forEach(button=>button.disabled=true);
  const activeSeconds=elapsedActiveSeconds(active);
  const traffic=timeTrafficLight(activeSeconds);
  try{
    const result=await api.workFinish(active.id,{
      timeReviewRequired:traffic.review,
      completionMode:"PHOTO_REQUIRED",
      clientActiveSeconds:activeSeconds
    });
    await uploadWorkEvidence(active.id,file,finalEvidenceType(active.evidencePolicy),active.title);
    const reviewRequired=result?.timeReviewRequired??traffic.review;
    dialog.close();
    toast(reviewRequired?"Actividad finalizada con foto. Quedó pendiente de revisión.":"Actividad finalizada con foto.");
    await rerenderWorkforceContent(content);
  }catch(error){
    toast(error.message,"error",9000);
    buttons.forEach(button=>button.disabled=false);
    await rerenderWorkforceContent(content).catch(()=>{});
  }
}

function pickFinalPhoto(useCamera){
  return new Promise(resolve=>{
    const input=document.createElement("input");
    input.type="file";
    input.accept="image/*";
    if(useCamera)input.capture="environment";
    input.onchange=()=>resolve(input.files?.[0]||null);
    input.addEventListener("cancel",()=>resolve(null),{once:true});
    input.click();
  });
}

function photoPicker(execution,type,content){
  const input=document.createElement("input");input.type="file";input.accept="image/*";input.capture="environment";
  input.onchange=async()=>{const file=input.files?.[0];if(!file)return;try{toast("Cargando evidencia…","success",2500);await uploadWorkEvidence(execution.id,file,type,execution.title);toast("Evidencia guardada.");await rerenderWorkforceContent(content)}catch(error){toast(error.message,"error",8000)}};
  input.click();
}

function evidenceDialog(execution,content){
  const policy=execution.evidencePolicy;
  if(policy==="FINAL_PHOTO")return photoPicker(execution,"FINAL_PHOTO",content);
  if(policy==="BEFORE_AFTER"){
    const dialog=modal({title:"Completar evidencia",confirmLabel:"Cerrar",body:`<div class="evidence-choice"><button type="button" class="work-evidence-choice" data-evidence-type="BEFORE_PHOTO"><strong>Foto inicial</strong><span>Estado antes de la actividad</span></button><button type="button" class="work-evidence-choice" data-evidence-type="AFTER_PHOTO"><strong>Foto final</strong><span>Resultado después de la actividad</span></button></div>`,onConfirm:async()=>{}});
    dialog.root.querySelectorAll("[data-evidence-type]").forEach(button=>button.onclick=()=>{dialog.close();photoPicker(execution,button.dataset.evidenceType,content)});
    return;
  }
  if(policy==="LINK"||policy==="ERP_REFERENCE"){
    modal({title:policy==="LINK"?"Anexar enlace":"Anexar referencia del CRM",confirmLabel:"Guardar evidencia",body:`<div class="field"><label>${policy==="LINK"?"Enlace":"Referencia"}</label><input class="control" name="value" required placeholder="${policy==="LINK"?"https://…":"Pedido, informe o registro relacionado"}"></div><div class="field"><label>Nota opcional</label><textarea class="control" name="note" rows="3"></textarea></div>`,onConfirm:async dialog=>{await api.workRegisterEvidence(execution.id,{evidenceType:policy,externalValue:dialog.querySelector('[name="value"]').value,note:dialog.querySelector('[name="note"]').value});toast("Evidencia registrada.");await rerenderWorkforceContent(content)}});return;
  }
  const input=document.createElement("input");input.type="file";input.accept=policy==="FILE"?"*/*":"image/*";
  input.onchange=async()=>{const file=input.files?.[0];if(!file)return;try{await uploadWorkEvidence(execution.id,file,policy==="FILE"?"FILE":"FINAL_PHOTO",execution.title);toast("Evidencia guardada.");await rerenderWorkforceContent(content)}catch(error){toast(error.message,"error",8000)}};input.click();
}

function startLiveClock(content,active){
  clearInterval(liveTimer);if(!active)return;
  const target=content.querySelector("[data-live-clock]");
  const trafficRoot=content.querySelector("[data-time-traffic]");
  const renderTick=()=>{
    const seconds=elapsedActiveSeconds(active);
    if(target)target.textContent=clock(seconds);
    if(trafficRoot){
      const traffic=timeTrafficLight(seconds);
      trafficRoot.className=`work-timer-traffic tone-${traffic.tone}`;
      trafficRoot.dataset.tone=traffic.tone;
      const label=trafficRoot.querySelector("[data-traffic-label]");if(label)label.textContent=traffic.label;
      const help=trafficRoot.querySelector("[data-traffic-help]");if(help)help.textContent=trafficHelp(seconds);
    }
  };
  renderTick();
  if(active.status!=="PAUSED")liveTimer=setInterval(renderTick,1000);
}

// ---------------------------------------------------------------------------
// PLANIFICACIÓN
// ---------------------------------------------------------------------------
async function renderPlanner(root,content){
  const range=plannerRangeForMode(plannerMode,plannerAnchor);
  const data=await api.workPlanner(range.from,range.to);
  const timeline=composePlannerTimeline(data);
  const plannerData={...data,assignments:timeline};
  const calendar=await resolvePlannerCalendar(data);
  const canViewTeam=Boolean(data.permissions?.canViewTeam);
  const canPlanTeam=Boolean(data.permissions?.canPlanTeam);
  const subtitle={
    day:"Jornada laboral por horas",
    week:"Semana laboral · lunes a viernes",
    month:"Mes laboral · sin fines de semana"
  }[plannerMode]||"Cronograma laboral";

  const activeFilterCount=()=>[
    plannerFilters.profileId!=="ALL",
    plannerFilters.fromTime!=="07:00",
    plannerFilters.toTime!=="17:30",
    plannerMode!=="day"&&plannerFilters.weekday!=="ALL"
  ].filter(Boolean).length;

  const selectedWorker=()=>plannerFilters.profileId==="ALL"
    ? null
    : (data.people||[]).find(person=>String(person.id)===String(plannerFilters.profileId))||null;

  const capacityMarkupFor=profileId=>{
    const person=String(profileId||"ALL")==="ALL"
      ? null
      : (data.people||[]).find(row=>String(row.id)===String(profileId));

    if(!person){
      return `<div class="work-capacity-empty-v11362">
        <span class="work-capacity-empty-icon-v11362">◎</span>
        <div><strong>Selecciona un trabajador</strong><p>Usa el filtro de trabajador para consultar su capacidad planificada sin mostrar toda la lista.</p></div>
      </div>`;
    }

    const assignments=(data.assignments||[]).filter(row=>String(row.profileId)===String(person.id));
    return `<div class="work-capacity-focus-v11362">${teamCapacityHtml([person],assignments,range,calendar)}</div>`;
  };

  const filterWorkerName=()=>selectedWorker()?.name||"Todos";

  content.innerHTML=`
    <section class="work-planner-toolbar card">
      <div class="work-planner-nav">
        <button class="icon-btn" data-plan-prev aria-label="Anterior">‹</button>
        <button class="btn btn-ghost" data-plan-today>Hoy</button>
        <button class="icon-btn" data-plan-next aria-label="Siguiente">›</button>
        <div><strong>${fmt.escape(plannerTitleForMode(plannerMode,plannerAnchor))}</strong><span>${subtitle}</span></div>
      </div>
      <div class="work-planner-actions">
        <div class="segment-control work-planner-mode">
          <button class="${plannerMode==="day"?"active":""}" data-plan-mode="day">Día</button>
          <button class="${plannerMode==="week"?"active":""}" data-plan-mode="week">Semana</button>
          <button class="${plannerMode==="month"?"active":""}" data-plan-mode="month">Mes</button>
        </div>
        ${canPlanTeam?'<button class="btn btn-create" data-plan-new-custom>Nueva actividad</button><button class="btn btn-primary" data-plan-new>Asignar del catálogo</button>':'<span class="work-timeline-scope-v11350">Mi cronograma</span>'}
      </div>
    </section>

    <details class="work-calendar-filterbox-v11362" data-plan-filter-box>
      <summary class="work-calendar-filter-trigger-v11362">
        <span class="work-calendar-filter-trigger-icon-v11362">⌁</span>
        <span>
          <strong>Filtros</strong>
          <small data-plan-filter-summary>${activeFilterCount()?`${activeFilterCount()} activos · ${fmt.escape(filterWorkerName())}`:"Sin filtros activos"}</small>
        </span>
        <b data-plan-filter-count ${activeFilterCount()?"":"hidden"}>${activeFilterCount()}</b>
      </summary>

      <div class="work-calendar-filter-panel-v11362">
        <div class="work-calendar-filter-field-v11361 work-calendar-filter-worker-v11362">
          <label>Trabajador</label>
          <select data-plan-filter-worker>
            <option value="ALL" ${plannerFilters.profileId==="ALL"?"selected":""}>Todos los trabajadores</option>
            ${(data.people||[]).map(person=>{
              const count=timeline.filter(item=>item.profileId===person.id).length;
              return `<option value="${fmt.escape(person.id)}" ${plannerFilters.profileId===person.id?"selected":""}>${fmt.escape(person.name)} · ${count} actividad${count===1?"":"es"}</option>`;
            }).join("")}
          </select>
        </div>

        <div class="work-calendar-filter-field-v11361">
          <label>Desde</label>
          <input type="time" value="${fmt.escape(plannerFilters.fromTime)}" min="07:00" max="17:30" step="300" data-plan-filter-from>
        </div>

        <div class="work-calendar-filter-field-v11361">
          <label>Hasta</label>
          <input type="time" value="${fmt.escape(plannerFilters.toTime)}" min="07:00" max="17:30" step="300" data-plan-filter-to>
        </div>

        ${plannerMode==="day"?`
          <div class="work-calendar-filter-field-v11361 work-calendar-filter-scope-v11363">
            <label>Fecha</label>
            <input type="date" value="${isoDate(plannerAnchor)}" data-plan-filter-date>
          </div>`:`
          <div class="work-calendar-filter-field-v11361 work-calendar-filter-scope-v11363">
            <label>Día</label>
            <select data-plan-filter-weekday>
              <option value="ALL" ${plannerFilters.weekday==="ALL"?"selected":""}>Todos los días</option>
              <option value="1" ${plannerFilters.weekday==="1"?"selected":""}>Lunes</option>
              <option value="2" ${plannerFilters.weekday==="2"?"selected":""}>Martes</option>
              <option value="3" ${plannerFilters.weekday==="3"?"selected":""}>Miércoles</option>
              <option value="4" ${plannerFilters.weekday==="4"?"selected":""}>Jueves</option>
              <option value="5" ${plannerFilters.weekday==="5"?"selected":""}>Viernes</option>
            </select>
          </div>`}

        <div class="work-calendar-filter-actions-v11362">
          <button type="button" class="work-calendar-filter-reset-v11361" data-plan-filter-reset>Restablecer</button>
          <button type="button" class="work-calendar-filter-close-v11362" data-plan-filter-close>Cerrar</button>
        </div>
      </div>
    </details>

    <section class="work-planner-context-strip">
      <span><b>Horario</b> 07:00–12:00 · 13:40–17:30</span>
      <span><b>Calendario</b> ${canViewTeam?"equipo visible según permisos":"solo tus actividades"}</span>
      <span><b>Interacción</b> toca o pasa el mouse para resumen · doble clic para detalle</span>
    </section>

    <div data-planner-calendar-host>${renderWorkforceCalendarBoard({mode:plannerMode,anchor:plannerAnchor,data:plannerData,calendar,filters:plannerFilters})}</div>

    ${canViewTeam?`<details class="work-team-capacity-v11362 card">
      <summary class="work-team-capacity-summary-v11362">
        <span class="work-team-capacity-icon-v11362">◔</span>
        <div>
          <strong>Capacidad del equipo</strong>
          <small data-team-capacity-label>${selectedWorker()?fmt.escape(selectedWorker().name):"Selecciona un trabajador en Filtros"}</small>
        </div>
        <span class="work-team-capacity-chevron-v11362">⌄</span>
      </summary>
      <div class="work-team-capacity-body-v11362" data-team-capacity-host>
        ${capacityMarkupFor(plannerFilters.profileId)}
      </div>
    </details>`:""}`;

  const calendarHost=content.querySelector("[data-planner-calendar-host]");

  const bindCalendar=()=>{
    plannerCalendarCleanup?.();
    plannerCalendarCleanup=bindWorkforceCalendar({
      container:calendarHost,
      items:timeline,
      api,
      evidenceManager:workEvidenceManager,
      canPlanTeam,
      notify:toast,
      onPlanDay:async day=>{
        assignmentWizard(data,await loadPlannerCatalog(),()=>renderPlanner(root,content),day);
      },
      onCancel:assignmentId=>{
        cancelAssignmentDialog(assignmentId,()=>renderPlanner(root,content));
      },
      onActiveProfile:()=>{
        toast("La actividad actual todavía no tiene detalle disponible en este rango.","warning");
      }
    });
  };

  const repaintCalendar=()=>{
    if(!calendarHost)return;
    calendarHost.innerHTML=renderWorkforceCalendarBoard({
      mode:plannerMode,
      anchor:plannerAnchor,
      data:plannerData,
      calendar,
      filters:plannerFilters
    });
    bindCalendar();
    renderCapacityPanel();
    syncFilterSummary();
  };

  const capacityHost=content.querySelector("[data-team-capacity-host]");
  const capacityLabel=content.querySelector("[data-team-capacity-label]");

  const renderCapacityPanel=()=>{
    if(!capacityHost)return;
    capacityHost.innerHTML=capacityMarkupFor(plannerFilters.profileId);
    if(capacityLabel)capacityLabel.textContent=selectedWorker()?.name||"Selecciona un trabajador en Filtros";
  };

  const syncFilterSummary=()=>{
    const count=activeFilterCount();
    const countNode=content.querySelector("[data-plan-filter-count]");
    const summaryNode=content.querySelector("[data-plan-filter-summary]");
    if(countNode){
      countNode.hidden=!count;
      countNode.textContent=String(count);
    }
    if(summaryNode)summaryNode.textContent=count?`${count} activos · ${filterWorkerName()}`:"Sin filtros activos";
  };

  const move=direction=>{
    if(plannerMode==="day")plannerAnchor=nextBusinessAnchor(plannerAnchor,direction,calendar);
    else if(plannerMode==="week")plannerAnchor=addDays(plannerAnchor,direction*7);
    else plannerAnchor=addMonths(plannerAnchor,direction);
    return renderPlanner(root,content);
  };

  content.querySelector("[data-plan-prev]").onclick=()=>move(-1);
  content.querySelector("[data-plan-next]").onclick=()=>move(1);
  content.querySelector("[data-plan-today]").onclick=()=>{
    plannerAnchor=new Date();
    if(plannerMode==="day"){
      const today=isoDate(plannerAnchor);
      const visible=calendar.workingWeekdays.includes(((plannerAnchor.getDay()+6)%7)+1)&&!calendar.holidayMap.has(today);
      if(!visible)plannerAnchor=nextBusinessAnchor(plannerAnchor,1,calendar);
    }
    renderPlanner(root,content);
  };

  content.querySelectorAll("[data-plan-mode]").forEach(button=>button.onclick=()=>{
    plannerMode=button.dataset.planMode;
    if(plannerMode==="month")plannerAnchor=new Date(plannerAnchor.getFullYear(),plannerAnchor.getMonth(),1);
    if(plannerMode==="day"){
      const iso=isoDate(plannerAnchor);
      const visible=calendar.workingWeekdays.includes(((plannerAnchor.getDay()+6)%7)+1)&&!calendar.holidayMap.has(iso);
      if(!visible)plannerAnchor=nextBusinessAnchor(plannerAnchor,1,calendar);
    }
    renderPlanner(root,content);
  });

  const workerFilter=content.querySelector("[data-plan-filter-worker]");
  if(workerFilter)workerFilter.onchange=()=>{
    plannerFilters.profileId=workerFilter.value||"ALL";
    repaintCalendar();
  };

  const fromFilter=content.querySelector("[data-plan-filter-from]");
  const toFilter=content.querySelector("[data-plan-filter-to]");
  const applyTimeFilters=()=>{
    const from=fromFilter?.value||"07:00";
    const to=toFilter?.value||"17:30";
    if(from>=to){
      toast("La hora inicial debe ser anterior a la hora final.","warning");
      if(fromFilter)fromFilter.value=plannerFilters.fromTime;
      if(toFilter)toFilter.value=plannerFilters.toTime;
      return;
    }
    plannerFilters.fromTime=from;
    plannerFilters.toTime=to;
    repaintCalendar();
  };
  if(fromFilter)fromFilter.onchange=applyTimeFilters;
  if(toFilter)toFilter.onchange=applyTimeFilters;

  const weekdayFilter=content.querySelector("[data-plan-filter-weekday]");
  if(weekdayFilter)weekdayFilter.onchange=()=>{
    plannerFilters.weekday=weekdayFilter.value||"ALL";
    repaintCalendar();
  };

  const dateFilter=content.querySelector("[data-plan-filter-date]");
  if(dateFilter)dateFilter.onchange=()=>{
    const [year,month,day]=String(dateFilter.value||"").split("-").map(Number);
    if(!year||!month||!day)return;
    plannerAnchor=new Date(year,month-1,day);
    renderPlanner(root,content);
  };

  const resetFilters=content.querySelector("[data-plan-filter-reset]");
  if(resetFilters)resetFilters.onclick=()=>{
    plannerFilters={profileId:"ALL",weekday:"ALL",fromTime:"07:00",toTime:"17:30"};
    if(workerFilter)workerFilter.value="ALL";
    if(fromFilter)fromFilter.value="07:00";
    if(toFilter)toFilter.value="17:30";
    if(weekdayFilter)weekdayFilter.value="ALL";
    repaintCalendar();
  };

  const filterBox=content.querySelector("[data-plan-filter-box]");
  const filterClose=content.querySelector("[data-plan-filter-close]");
  if(filterClose)filterClose.onclick=()=>{if(filterBox)filterBox.open=false;};

  if(canPlanTeam){
    content.querySelector("[data-plan-new]").onclick=async()=>assignmentWizard(data,await loadPlannerCatalog(),()=>renderPlanner(root,content),null,{newCatalog:false});
    content.querySelector("[data-plan-new-custom]").onclick=async()=>assignmentWizard(data,await loadPlannerCatalog(),()=>renderPlanner(root,content),null,{newCatalog:true,startNow:true});
  }

  bindCalendar();
}

async function resolvePlannerCalendar(data){
  if(data?.calendar){
    plannerCalendarCache=normalizePlannerCalendar(data.calendar);
    return plannerCalendarCache;
  }
  if(plannerCalendarCache)return plannerCalendarCache;
  plannerCalendarCache=normalizePlannerCalendar(await api.calendar());
  return plannerCalendarCache;
}

async function loadPlannerCatalog(){
  if(plannerCatalogCache)return plannerCatalogCache;
  plannerCatalogCache=await api.workCatalog();
  return plannerCatalogCache;
}

function assignmentWizard(data,catalog,reload,prefillDay=null,options={}){
  const permissions=data.permissions||{};
  const kinds=[];if(permissions.logistics)kinds.push(["ACTIVITY","Actividad de equipo"]);if(permissions.deliverables)kinds.push(["DELIVERABLE","Entregable de gestión"]);
  const defaultKind=kinds[0]?.[0]||"ACTIVITY";
  const day=prefillDay||isoDate(new Date());
  const people=data.people||[];
  const initialMode=options.newCatalog?"NEW":"EXISTING";
  const initialStart=options.startNow?roundToFiveMinutes(new Date()):new Date(`${day}T08:00:00`);
  const initialEnd=new Date(initialStart.getTime()+60*60000);
  wizard({title:options.newCatalog?"Crear y asignar nueva actividad":"Asignar trabajo",subtitle:"Usa el catálogo existente o crea una actividad nueva que quedará disponible para futuras asignaciones.",finishLabel:"Publicar asignación",size:"wide",steps:[
    {title:"Qué se necesita",description:"Selecciona una actividad existente o crea una nueva para incorporarla al catálogo oficial.",content:`
      <div class="work-catalog-mode" role="radiogroup" aria-label="Origen de la actividad">
        <label class="status-choice"><input type="radio" name="catalogMode" value="EXISTING" ${initialMode==="EXISTING"?"checked":""}><span><strong>Usar catálogo</strong><small>Selecciona una actividad ya definida y conserva sus parámetros estándar.</small></span></label>
        <label class="status-choice"><input type="radio" name="catalogMode" value="NEW" ${initialMode==="NEW"?"checked":""}><span><strong>Crear nueva actividad</strong><small>La nueva actividad se guarda automáticamente en el catálogo para reutilizarla.</small></span></label>
      </div>
      <div class="form-grid" data-existing-catalog>
        <div class="field full"><label>Actividad / plantilla *</label><select class="control" name="catalogId"></select></div>
      </div>
      <div class="form-grid work-new-catalog-fields" data-new-catalog hidden>
        <div class="field"><label>Nombre de la nueva actividad *</label><input class="control" name="newCatalogName" maxlength="120" placeholder="Ej. Conteo cíclico extraordinario"></div>
        <div class="field"><label>Categoría *</label><select class="control" name="newCatalogGroup"></select></div>
        <div class="field full"><div class="work-catalog-persistence"><strong>Se incorporará al catálogo</strong><span>Después de publicarla podrá seleccionarse nuevamente sin tener que crearla otra vez. El CRM evita duplicados por nombre.</span></div></div>
      </div>
      <div class="form-grid">
        <div class="field full"><label>Título de esta asignación *</label><input class="control" name="title" required placeholder="Ej. Organizar zona de cables o entregar análisis de cartera"></div>
        <div class="field full"><label>Descripción / resultado esperado</label><textarea class="control" name="description" rows="3"></textarea></div>
      </div>`,onEnter:({form,panel})=>{
        const existing=panel.querySelector('[data-existing-catalog]');
        const custom=panel.querySelector('[data-new-catalog]');
        const syncKind=()=>{
          fillCatalogSelect(form.catalogId,catalog,form.kind?.value||defaultKind);
          fillNewCatalogGroups(form.newCatalogGroup,form.kind?.value||defaultKind);
        };
        const syncMode=()=>{
          const mode=form.querySelector('[name="catalogMode"]:checked')?.value||"EXISTING";
          existing.hidden=mode!=="EXISTING";custom.hidden=mode!=="NEW";
          form.catalogId.required=mode==="EXISTING";
          form.newCatalogName.required=mode==="NEW";
          form.newCatalogGroup.required=mode==="NEW";
          if(mode==="NEW"&&form.newCatalogName.value&&!form.title.value)form.title.value=form.newCatalogName.value;
        };
        // El selector de tipo vive en este mismo paso para que catálogo y alcance nunca se contradigan.
        if(!form.kind){
          const type=document.createElement('div');type.className='field';type.innerHTML=`<label>Tipo *</label><select class="control" name="kind" required>${kinds.map(([v,l])=>`<option value="${v}">${l}</option>`).join("")}</select>`;
          const grid=existing.previousElementSibling?.classList?.contains('form-grid')?existing.previousElementSibling:null;
          (grid||panel.querySelector('.work-catalog-mode')).insertAdjacentElement('beforebegin',type);
        }
        syncKind();syncMode();
        form.querySelectorAll('[name="catalogMode"]').forEach(r=>r.onchange=syncMode);
        form.kind.onchange=()=>{syncKind();syncMode();};
        form.catalogId.onchange=()=>{const c=catalog.find(x=>x.id===form.catalogId.value);if(c){form.title.value=c.name;if(form.description&&!form.description.value&&c.description)form.description.value=c.description;}};
        form.newCatalogName.oninput=()=>{if((form.querySelector('[name="catalogMode"]:checked')?.value||"")==="NEW")form.title.value=form.newCatalogName.value;};
        if(initialMode==="EXISTING"&&!form.title.value){const c=catalog.find(x=>x.id===form.catalogId.value);if(c)form.title.value=c.name;}
      },validate:({form})=>{
        const mode=form.querySelector('[name="catalogMode"]:checked')?.value||"EXISTING";
        if(mode==="EXISTING"&&!form.catalogId.value)throw new Error("Selecciona una actividad del catálogo.");
        if(mode==="NEW"&&String(form.newCatalogName.value||"").trim().length<3)throw new Error("Escribe el nombre de la nueva actividad.");
        return true;
      }},
    {title:"A quién",description:"Puedes asignar una actividad logística al equipo completo; el esfuerzo se medirá por persona-hora.",content:`<div class="work-assignee-picker">${people.map(p=>`<label class="work-person-choice" data-person-kind><input type="checkbox" name="profileId" value="${fmt.escape(p.id)}"><span class="avatar">${fmt.initials(p.name)}</span><span><strong>${fmt.escape(p.name)}</strong><small>${fmt.escape((p.roles||[]).map(r=>fmt.role(r)).join(" · "))}</small></span><b>${p.activeTitle?"Ocupado ahora":`${fmt.number(p.plannedMinutes7d)} min / 7d`}</b></label>`).join("")}</div>`,onEnter:({form})=>{const kind=form.kind.value;form.querySelectorAll('[data-person-kind]').forEach(label=>{const p=people.find(x=>x.id===label.querySelector('input').value);const allowed=kind==="ACTIVITY"?(p.roles||[]).some(r=>["jefe_logistica","coordinador_logistico","aux_logistica","auxiliar_corte","recepcion_mercancia","despacho_nacional"].includes(r)):((p.roles||[]).some(r=>["ventas","jefe_logistica","compras","cartera"].includes(r)));label.hidden=!permissions.all&&!allowed;if(label.hidden)label.querySelector('input').checked=false})},validate:({form})=>{if(!form.querySelector('[name="profileId"]:checked'))throw new Error("Selecciona al menos una persona.");return true}},
    {title:"Cuándo",description:"Asigna para ahora o define un horario futuro. El CRM validará jornada, festivos y superposiciones.",content:`<div class="work-time-presets"><button class="btn btn-ghost" type="button" data-work-time-now>Ahora</button><span>o define el bloque manualmente</span></div><div class="form-grid"><div class="field"><label>Inicio</label><input class="control" type="datetime-local" name="plannedStart" value="${localDateTimeInput(initialStart)}"></div><div class="field"><label>Finalización planificada</label><input class="control" type="datetime-local" name="plannedEnd" value="${localDateTimeInput(initialEnd)}"></div><div class="field"><label>Fecha límite</label><input class="control" type="datetime-local" name="dueAt" value="${day}T17:30"></div><div class="field"><label>Duración estimada (min) *</label><input class="control" type="number" min="1" max="1440" name="estimatedMinutes" value="60" required></div><div class="field"><label>Repetir</label><select class="control" name="frequency"><option value="NONE">No repetir</option><option value="DAILY">Cada día</option><option value="WEEKLY">Cada semana</option><option value="MONTHLY">Cada mes</option></select></div><div class="field"><label>Repetir hasta</label><input class="control" type="date" name="repeatUntil"></div></div><div class="wizard-tip">“Ahora” toma la hora real y calcula el final usando la duración estimada. Si existe un choque, el CRM lo advertirá antes de publicar.</div>`,onEnter:({form,panel})=>{const kind=form.kind.value;form.dueAt.required=kind==="DELIVERABLE";form.plannedStart.required=kind==="ACTIVITY";form.plannedEnd.required=kind==="ACTIVITY";const mode=form.querySelector('[name="catalogMode"]:checked')?.value||"EXISTING";const c=mode==="EXISTING"?catalog.find(x=>x.id===form.catalogId.value):null;if(c&&c.standardMinutes&&!form.dataset.durationTouched)form.estimatedMinutes.value=c.medianMinutes&&c.samples>=5?Math.round(c.medianMinutes):c.standardMinutes;const applyNow=()=>{const start=roundToFiveMinutes(new Date());const mins=Math.max(1,Number(form.estimatedMinutes.value||60));form.plannedStart.value=localDateTimeInput(start);form.plannedEnd.value=localDateTimeInput(new Date(start.getTime()+mins*60000));};panel.querySelector('[data-work-time-now]').onclick=applyNow;form.estimatedMinutes.oninput=()=>{form.dataset.durationTouched="1";};form.frequency.onchange=()=>{form.repeatUntil.required=form.frequency.value!=="NONE"}}},
    {title:"Evidencia y control",description:"Define qué debe quedar demostrado al terminar. Si creaste una actividad nueva, estos parámetros quedarán como estándar de catálogo.",content:`<div class="form-grid"><div class="field"><label>Evidencia *</label><select class="control" name="evidencePolicy"><option value="NONE">Sin evidencia</option><option value="FINAL_PHOTO">Foto final</option><option value="BEFORE_AFTER">Foto antes + después</option><option value="FILE">Archivo</option><option value="LINK">Enlace</option><option value="ERP_REFERENCE">Referencia del CRM</option></select></div><div class="field"><label>Prioridad</label><select class="control" name="priority"><option>MEDIUM</option><option>HIGH</option><option>URGENT</option><option>CRITICAL</option><option>LOW</option></select></div><label class="status-choice full"><input type="checkbox" name="acceptanceRequired"><span><strong>Requiere aceptación final</strong><small>El trabajo queda “En revisión” hasta que el responsable lo acepte. Se recomienda para entregables de Gerencia.</small></span></label></div>`,onEnter:({form})=>{const mode=form.querySelector('[name="catalogMode"]:checked')?.value||"EXISTING";const c=mode==="EXISTING"?catalog.find(x=>x.id===form.catalogId.value):null;if(c)form.evidencePolicy.value=c.evidencePolicy||"NONE";else if(!form.dataset.newEvidenceInitialized){form.evidencePolicy.value=form.kind.value==="DELIVERABLE"?"FILE":"FINAL_PHOTO";form.dataset.newEvidenceInitialized="1";}form.acceptanceRequired.checked=form.kind.value==="DELIVERABLE"||(c?.acceptanceRequired===true)}},
    {title:"Revisión",description:"Publica la asignación. Las actividades nuevas quedan incorporadas al catálogo antes de asignarse.",content:`<div class="wizard-summary work-assignment-review"><div class="wizard-summary-item"><label>Trabajo</label><strong data-review-title>—</strong></div><div class="wizard-summary-item"><label>Origen</label><strong data-review-origin>—</strong></div><div class="wizard-summary-item"><label>Personas</label><strong data-review-people>—</strong></div><div class="wizard-summary-item"><label>Horario</label><strong data-review-time>—</strong></div><div class="wizard-summary-item"><label>Evidencia</label><strong data-review-evidence>—</strong></div></div><label class="status-choice"><input type="checkbox" name="force"><span><strong>Permitir superposición solo si el CRM detecta conflicto</strong><small>Úsalo únicamente cuando la actividad deba coexistir deliberadamente con otro bloque.</small></span></label>`,onEnter:({root,form})=>{const mode=form.querySelector('[name="catalogMode"]:checked')?.value||"EXISTING";root.querySelector('[data-review-title]').textContent=form.title.value;root.querySelector('[data-review-origin]').textContent=mode==="NEW"?`${form.newCatalogName.value} · se guardará en catálogo`:(catalog.find(x=>x.id===form.catalogId.value)?.name||"Catálogo");root.querySelector('[data-review-people]').textContent=[...form.querySelectorAll('[name="profileId"]:checked')].map(i=>people.find(p=>p.id===i.value)?.name||"").join(" · ");root.querySelector('[data-review-time]').textContent=form.kind.value==="DELIVERABLE"?`Vence ${form.dueAt.value||"—"}`:`${form.plannedStart.value||"—"} → ${form.plannedEnd.value||"—"}`;root.querySelector('[data-review-evidence]').textContent=evidenceLabel(form.evidencePolicy.value)}}
  ],onFinish:async({form})=>{
    const mode=form.querySelector('[name="catalogMode"]:checked')?.value||"EXISTING";
    let catalogId=form.catalogId.value||null;
    if(mode==="NEW"){
      const created=await api.workCreateCatalogItem({
        kind:form.kind.value,
        name:form.newCatalogName.value,
        description:form.description.value||null,
        activityGroup:form.newCatalogGroup.value,
        standardMinutes:Number(form.estimatedMinutes.value),
        evidencePolicy:form.evidencePolicy.value,
        acceptanceRequired:form.acceptanceRequired.checked,
        teamAllowed:form.kind.value==="ACTIVITY"
      });
      catalogId=created.item?.id;
      if(!catalogId)throw new Error("No fue posible incorporar la actividad al catálogo.");
      if(created.alreadyExists)toast("Ya existía una actividad con ese nombre; se reutilizó el catálogo existente.");
      else toast("Nueva actividad agregada al catálogo.");
    }
    const payload={kind:form.kind.value,catalogId,title:form.title.value,description:form.description.value||null,profileIds:[...form.querySelectorAll('[name="profileId"]:checked')].map(i=>i.value),plannedStart:form.plannedStart.value?new Date(form.plannedStart.value).toISOString():null,plannedEnd:form.plannedEnd.value?new Date(form.plannedEnd.value).toISOString():null,dueAt:form.dueAt.value?new Date(form.dueAt.value).toISOString():null,estimatedMinutes:Number(form.estimatedMinutes.value),evidencePolicy:form.evidencePolicy.value,acceptanceRequired:form.acceptanceRequired.checked,priority:form.priority.value,force:form.force.checked,recurrence:{frequency:form.frequency.value,until:form.repeatUntil.value||null}};
    const result=await api.workSaveAssignment(payload);
    if(!result.success){const details=[...new Set((result.conflicts||[]).map(x=>x.message).filter(Boolean))].slice(0,2).join(" · ");throw new Error(`Hay ${result.conflicts?.length||1} conflicto(s) de planificación${details?`: ${details}`:""}. Regresa a Revisión y autoriza la excepción solo si realmente corresponde.`)}
    toast(result.createdIds?.length>1?`${result.createdIds.length} actividades programadas.`:"Actividad asignada.");await reload();
  }});
}

function fillCatalogSelect(select,catalog,kind){
  const rows=catalog.filter(c=>c.activityKind===kind);
  select.innerHTML=rows.length?rows.map(c=>`<option value="${fmt.escape(c.id)}">${c.custom?"★ ":""}${fmt.escape(c.name)} · ${fmt.number(c.medianMinutes&&c.samples>=5?c.medianMinutes:c.standardMinutes||0)} min</option>`).join(""):'<option value="">Sin actividades disponibles</option>';
}

function fillNewCatalogGroups(select,kind){
  const rows=kind==="DELIVERABLE"?[["MANAGEMENT","Gestión"],["COMMERCIAL","Comercial"],["FINANCE","Financiera"],["PURCHASING","Compras"],["GENERAL","General"],["IMPROVEMENT","Mejora continua"]]:[["LOGISTICS","Operación logística"],["GENERAL","General"],["IMPROVEMENT","Mejora continua"]];
  const current=select.value;select.innerHTML=rows.map(([v,l])=>`<option value="${v}">${l}</option>`).join("");if(rows.some(([v])=>v===current))select.value=current;
}

function cancelAssignmentDialog(id,reload){modal({title:"Cancelar asignación",confirmLabel:"Cancelar actividad",body:`<div class="field"><label>Motivo</label><textarea class="control" name="note" rows="3" placeholder="Explica por qué deja de realizarse"></textarea></div>`,onConfirm:async dialog=>{await api.workCancelAssignment(id,dialog.querySelector('[name="note"]').value||null);toast("Asignación cancelada.");await reload()}})}

// ---------------------------------------------------------------------------
// ANALÍTICA
// ---------------------------------------------------------------------------
async function renderAnalytics(root,content){
  const canManage=state.profile?.roles?.some(r=>["super_admin","gerencia","jefe_logistica","auditoria"].includes(r));
  const people=canManage?await api.workPeople(null).catch(()=>[]):[];
  const selected=content.dataset.analyticsProfile||"";
  const data=await api.workAnalytics(analyticsRange.from,analyticsRange.to,selected||null);
  const summary=data.summary||{};
  const scopeName=selected?(people.find(person=>String(person.id)===String(selected))?.name||"Trabajador seleccionado"):(canManage?"Ámbito completo":"Mi jornada");
  const utilization=Math.max(0,Math.min(100,Number(summary.utilizationPct||0)));
  const utilizationTone=utilization>=80?"good":utilization>=55?"medium":"low";

  content.innerHTML=`
    <section class="work-indicators-v11363">
      <section class="work-indicator-hero-v11363">
        <div class="work-indicator-hero-copy-v11363">
          <span class="work-indicator-kicker-v11363">INDICADORES DE JORNADA</span>
          <h2>Pulso operativo</h2>
          <p>Capacidad, cumplimiento, tiempos y distribución del trabajo en una lectura visual y verificable.</p>
          <div class="work-indicator-context-v11363">
            <span><b>Periodo</b>${fmt.escape(analyticsRange.from)} → ${fmt.escape(analyticsRange.to)}</span>
            <span><b>Vista</b>${fmt.escape(scopeName)}</span>
            <span class="tone-${utilizationTone}"><b>Clasificación</b>${fmt.number(utilization,1)}%</span>
          </div>
        </div>

        <div class="work-indicator-hero-side-v11363">
          <div class="work-indicator-ring-v11363" style="--indicator-value:${utilization}">
            <div><strong>${fmt.number(utilization,1)}%</strong><span>jornada<br>clasificada</span></div>
          </div>
          <details class="work-indicator-filter-v11363">
            <summary>${icon("search")}<span><strong>Ajustar análisis</strong><small>Periodo y persona</small></span><b>⌄</b></summary>
            <div class="work-indicator-filter-panel-v11363">
              <label><span>Desde</span><input class="control" type="date" data-analytics-from value="${analyticsRange.from}"></label>
              <label><span>Hasta</span><input class="control" type="date" data-analytics-to value="${analyticsRange.to}"></label>
              ${canManage?`<label class="wide"><span>Persona / equipo</span><select class="control" data-analytics-profile><option value="">Mi ámbito completo</option>${people.map(person=>`<option value="${fmt.escape(person.id)}" ${selected===person.id?"selected":""}>${fmt.escape(person.name)}</option>`).join("")}</select></label>`:""}
              <button type="button" class="btn btn-primary wide" data-analytics-apply>Aplicar filtros</button>
            </div>
          </details>
        </div>
      </section>

      ${analyticsSummary(summary)}

      <section class="work-indicator-layout-v11363">
        <section class="work-indicator-panel-v11363 span-2">
          <header><div><span>BALANCE DE JORNADA</span><h3>¿Cómo se distribuyó el tiempo disponible?</h3><p>Contrasta tiempo clasificado y tiempo que todavía no tiene categoría operativa.</p></div></header>
          <div class="work-indicator-panel-body-v11363">${analyticsBalance(summary)}</div>
        </section>

        <section class="work-indicator-panel-v11363">
          <header><div><span>DISTRIBUCIÓN</span><h3>Mapa del trabajo adicional</h3><p>Participación del tiempo activo por familia de actividad.</p></div></header>
          <div class="work-indicator-panel-body-v11363">${barList(data.activityGroups||[],x=>GROUP_LABELS[x.group]||fmt.label(x.group),x=>x.activeSeconds)}</div>
        </section>

        <section class="work-indicator-panel-v11363">
          <header><div><span>DESVIACIONES</span><h3>Qué explica los desvíos</h3><p>Pareto visual de las causas documentadas en el periodo.</p></div></header>
          <div class="work-indicator-panel-body-v11363">${causeList(data.deviationCauses||[])}</div>
        </section>

        <section class="work-indicator-panel-v11363 span-2">
          <header><div><span>TIEMPOS APRENDIDOS</span><h3>Referencias reales por actividad</h3><p>Mediana y P80 construidos con ejecuciones registradas, sin convertirlos en una calificación individual.</p></div></header>
          <div class="work-indicator-panel-body-v11363">${activityStandardsHtml(data.topActivities||[])}</div>
        </section>

        <section class="work-indicator-panel-v11363 span-2">
          <header><div><span>EN ESTE MOMENTO</span><h3>Equipo activo</h3><p>Actividades adicionales que están corriendo o pausadas ahora.</p></div></header>
          <div class="work-indicator-panel-body-v11363">${teamNowHtml(data.teamNow||[])}</div>
        </section>
      </section>

      ${data.pendingReviews?.length?`<section class="work-indicator-panel-v11363 work-review-card-v11363"><header><div><span>REVISIÓN</span><h3>Entregables pendientes</h3><p>Aceptar confirma el resultado; devolver exige una nota para corrección.</p></div><b>${fmt.number(data.pendingReviews.length)}</b></header><div class="work-indicator-panel-body-v11363">${pendingReviewsHtml(data.pendingReviews)}</div></section>`:""}

      <details class="work-indicator-method-v11363">
        <summary>${icon("audit")}<div><strong>Cómo leer estos indicadores</strong><small>Metodología y límites de interpretación</small></div><b>⌄</b></summary>
        <div><p><strong>Utilización, puntualidad y duración describen procesos y capacidad.</strong> No constituyen por sí solos una calificación de desempeño.</p><p>El CRM conserva tiempo no clasificado como <b>“sin categoría”</b>; no lo interpreta automáticamente como improductividad. Las referencias de tiempo se construyen con ejecuciones históricas.</p></div>
      </details>
    </section>`;

  content.querySelector("[data-analytics-apply]").onclick=()=>{
    analyticsRange={from:content.querySelector("[data-analytics-from]").value,to:content.querySelector("[data-analytics-to]").value};
    content.dataset.analyticsProfile=content.querySelector("[data-analytics-profile]")?.value||"";
    renderAnalytics(root,content);
  };
  content.querySelectorAll("[data-review-accept]").forEach(button=>button.onclick=()=>reviewDelivery(button.dataset.reviewAccept,"ACCEPTED",content,root));
  content.querySelectorAll("[data-review-return]").forEach(button=>button.onclick=()=>reviewDelivery(button.dataset.reviewReturn,"RETURNED",content,root));
}

function analyticsSummary(s={}){
  const scheduled=Math.max(0,Number(s.scheduledBusinessSeconds||0));
  const classified=Math.max(0,Number(s.classifiedBusinessSeconds||0));
  const unclassified=Math.max(0,Number(s.unclassifiedBusinessSeconds||0));
  const util=Math.max(0,Math.min(100,Number(s.utilizationPct||0)));
  const onTime=Math.max(0,Math.min(100,Number(s.onTimePct||0)));
  const adherence=Math.max(0,Math.min(100,Number(s.startAdherencePct||0)));
  const completed=Number(s.completedAssignments||0);
  const reviews=Number(s.pendingReviews||0);
  const uncPct=scheduled>0?Math.max(0,Math.min(100,100*unclassified/scheduled)):0;
  return `<section class="work-indicator-metrics-v11363">
    ${indicatorMetric("Jornada clasificada",`${fmt.number(util,1)}%`,`${fmt.hours(classified)} de ${fmt.hours(scheduled)}`,"blue",util,"Tiempo identificado dentro de la jornada laboral")}
    ${indicatorMetric("Sin categoría",fmt.hours(unclassified),`${fmt.number(uncPct,1)}% de la jornada`,"amber",uncPct,"No equivale automáticamente a improductividad")}
    ${indicatorMetric("Cumplimiento",`${fmt.number(onTime,1)}%`,`${fmt.number(completed)} completada${completed===1?"":"s"}`,"green",onTime,"Finalizadas dentro del compromiso")}
    ${indicatorMetric("Inicio según plan",`${fmt.number(adherence,1)}%`,"Ventana de ±5 minutos","violet",adherence,"Adherencia al bloque programado")}
    ${indicatorMetric("Actividad completada",fmt.number(completed),s.people?`${fmt.number(s.people)} persona${Number(s.people)===1?"":"s"} en el ámbito`:"Periodo seleccionado","cyan",Math.min(100,completed*10),"Volumen de asignaciones terminadas")}
    ${indicatorMetric("En revisión",fmt.number(reviews),reviews?"Requieren decisión":"Sin entregables pendientes","rose",reviews?Math.min(100,25+reviews*15):0,"Entregables enviados para aceptación")}
  </section>`;
}

function indicatorMetric(label,value,detail,tone,progress,help){
  return `<article class="work-indicator-metric-v11363 tone-${tone}">
    <div class="work-indicator-metric-top-v11363"><span>${fmt.escape(label)}</span><i></i></div>
    <strong>${value}</strong>
    <small>${detail}</small>
    <div class="work-indicator-metric-progress-v11363"><span style="--metric-progress:${Math.max(0,Math.min(100,Number(progress||0)))}%"></span></div>
    <p>${fmt.escape(help)}</p>
  </article>`;
}

function analyticsBalance(s={}){
  const scheduled=Math.max(0,Number(s.scheduledBusinessSeconds||0));
  const classified=Math.max(0,Number(s.classifiedBusinessSeconds||0));
  const unclassified=Math.max(0,Number(s.unclassifiedBusinessSeconds||0));
  const total=Math.max(1,scheduled||classified+unclassified);
  const classifiedPct=Math.max(0,Math.min(100,100*classified/total));
  const unclassifiedPct=Math.max(0,Math.min(100,100*unclassified/total));
  return `<div class="work-indicator-balance-visual-v11363">
    <div class="work-indicator-balance-bar-v11363"><span class="classified" style="--balance-size:${classifiedPct}%"></span><span class="unclassified" style="--balance-size:${unclassifiedPct}%"></span></div>
    <div class="work-indicator-balance-legend-v11363">
      <div><i class="classified"></i><span>Clasificado</span><strong>${fmt.hours(classified)}</strong><small>${fmt.number(classifiedPct,1)}%</small></div>
      <div><i class="unclassified"></i><span>Sin categoría</span><strong>${fmt.hours(unclassified)}</strong><small>${fmt.number(unclassifiedPct,1)}%</small></div>
      <div><i class="scheduled"></i><span>Jornada programada</span><strong>${fmt.hours(scheduled)}</strong><small>base</small></div>
    </div>
  </div>`;
}

function barList(rows,label,value){
  if(!rows.length)return indicatorEmpty("Sin distribución todavía","Cuando existan ejecuciones aparecerá la participación por familia.");
  const total=rows.reduce((sum,row)=>sum+Number(value(row)||0),0);
  const max=Math.max(...rows.map(row=>Number(value(row)||0)),1);
  return `<div class="work-indicator-bars-v11363">${rows.map((row,index)=>{
    const current=Number(value(row)||0);
    const share=total?100*current/total:0;
    const width=Math.max(4,100*current/max);
    return `<div class="work-indicator-bar-v11363 tone-${index%6}">
      <div class="work-indicator-bar-copy-v11363"><span><strong>${fmt.escape(label(row))}</strong><small>${fmt.number(row.executions)} ejecución${Number(row.executions)===1?"":"es"}</small></span><b>${fmt.hours(current)}</b></div>
      <div class="work-indicator-bar-track-v11363"><span style="--bar-size:${width}%"></span></div>
      <small>${fmt.number(share,1)}% del tiempo activo adicional</small>
    </div>`;
  }).join("")}</div>`;
}

function activityStandardsHtml(rows){
  if(!rows.length)return indicatorEmpty("Aún no hay referencias suficientes","Con ejecuciones reales el CRM aprende medianas y percentil 80 por actividad.");
  return `<div class="work-indicator-standards-v11363">${rows.slice(0,8).map((row,index)=>{
    const median=Math.max(0,Number(row.medianMinutes||0));
    const p80=Math.max(median,Number(row.p80Minutes||0));
    const max=Math.max(1,p80);
    return `<article>
      <span class="work-indicator-rank-v11363">${String(index+1).padStart(2,"0")}</span>
      <div class="work-indicator-standard-copy-v11363"><strong>${fmt.escape(row.name)}</strong><small>${fmt.escape(GROUP_LABELS[row.group]||fmt.label(row.group))} · ${fmt.number(row.executions)} muestras</small><div class="work-indicator-standard-bars-v11363"><span class="median" style="--standard-size:${Math.max(6,100*median/max)}%"></span><span class="p80" style="--standard-size:100%"></span></div></div>
      <div class="work-indicator-standard-values-v11363"><span><b>${fmt.number(median,1)}</b><small>min mediana</small></span><span><b>${fmt.number(p80,1)}</b><small>min P80</small></span></div>
    </article>`;
  }).join("")}</div>`;
}

function causeList(rows){
  if(!rows.length)return indicatorEmpty("Sin causas registradas","Las causas aparecerán cuando el equipo las indique al finalizar una actividad.");
  const max=Math.max(...rows.map(row=>Number(row.executions||0)),1);
  return `<div class="work-indicator-deviations-v11363">${rows.slice(0,7).map((row,index)=>{
    const width=Math.max(8,100*Number(row.executions||0)/max);
    return `<article><span class="work-indicator-deviation-index-v11363">${index+1}</span><div><strong>${fmt.escape(DEVIATION_REASONS[row.reason]||fmt.label(row.reason))}</strong><small>${fmt.number(row.executions)} caso${Number(row.executions)===1?"":"s"} · ${fmt.hours(row.activeSeconds)}</small><div><span style="--cause-size:${width}%"></span></div></div></article>`;
  }).join("")}</div>`;
}

function teamNowHtml(rows){
  if(!rows.length)return indicatorEmpty("Sin actividades adicionales activas","El equipo puede estar en procesos normales del CRM o sin actividad adicional iniciada.");
  return `<div class="work-indicator-team-v11363">${rows.map(row=>`<article class="tone-${String(row.status||"").toLowerCase()}"><span class="work-indicator-team-avatar-v11363">${fmt.initials(row.profileName)}</span><div><strong>${fmt.escape(row.profileName)}</strong><span>${fmt.escape(row.title||"Actividad")}</span><small>Desde ${timeOnly(row.startedAt)} · ${fmt.escape(GROUP_LABELS[row.group]||fmt.label(row.group||"GENERAL"))}</small></div>${statusBadge(row.status)}</article>`).join("")}</div>`;
}

function pendingReviewsHtml(rows){
  return `<div class="work-review-list-v11363">${rows.map(row=>`<article><div class="work-review-copy-v11363"><strong>${fmt.escape(row.title)}</strong><span>${fmt.escape(row.profileName)} · ${row.dueAt?`vencía ${fmt.date(row.dueAt)}`:"sin fecha"}</span><small>${fmt.escape(row.resultNote||"Sin nota de resultado")}</small></div><div class="work-review-evidence-v11363">${(row.evidence||[]).map(evidence=>evidence.webViewLink?`<a href="${fmt.escape(evidence.webViewLink)}" target="_blank" rel="noopener">${fmt.escape(evidence.fileName||fmt.label(evidence.type))}</a>`:`<span>${fmt.escape(evidence.value||fmt.label(evidence.type))}</span>`).join("")}</div><div class="work-review-actions-v11363"><button class="btn btn-ghost" data-review-return="${fmt.escape(row.executionId)}">Devolver</button><button class="btn btn-primary" data-review-accept="${fmt.escape(row.executionId)}">Aceptar</button></div></article>`).join("")}</div>`;
}

function indicatorEmpty(title,detail){
  return `<div class="work-indicator-empty-v11363"><span>◇</span><div><strong>${fmt.escape(title)}</strong><p>${fmt.escape(detail)}</p></div></div>`;
}

function reviewDelivery(id,decision,content,root){modal({title:decision==="ACCEPTED"?"Aceptar entregable":"Devolver entregable",confirmLabel:decision==="ACCEPTED"?"Aceptar resultado":"Devolver para corrección",body:`<div class="field"><label>${decision==="RETURNED"?"Qué debe corregirse *":"Nota opcional"}</label><textarea class="control" name="note" rows="4" ${decision==="RETURNED"?"required":""}></textarea></div>`,onConfirm:async dialog=>{await api.workReviewDelivery(id,decision,dialog.querySelector('[name="note"]').value||null);toast(decision==="ACCEPTED"?"Entregable aceptado.":"Entregable devuelto para corrección.");await renderAnalytics(root,content)}})}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------
function evidenceLabel(policy){return ({NONE:"sin evidencia",FINAL_PHOTO:"foto final",BEFORE_AFTER:"antes + después",FILE:"archivo",LINK:"enlace",ERP_REFERENCE:"referencia del CRM"})[policy]||fmt.label(policy)}
function activityGlyph(code=""){if(code.includes("CLEAN"))return"✦";if(code.includes("LOADING"))return"↑";if(code.includes("UNLOADING"))return"↓";if(code.includes("COUNT"))return"#";if(code.includes("ORGANIZE")||code.includes("RELOCATION"))return"▦";if(code.includes("TRAIN"))return"△";if(code.includes("IMPROVEMENT"))return"↗";return"●"}
function roundToFiveMinutes(value){const d=new Date(value);d.setSeconds(0,0);const remainder=d.getMinutes()%5;if(remainder)d.setMinutes(d.getMinutes()+(5-remainder));return d}
function localDateTimeInput(value){const d=new Date(value);const pad=n=>String(n).padStart(2,"0");return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`}
function clock(seconds){const n=Math.max(0,Math.floor(Number(seconds||0))),h=Math.floor(n/3600),m=Math.floor((n%3600)/60),s=n%60;return [h,m,s].map(x=>String(x).padStart(2,"0")).join(":")}
function isoDate(d){const date=new Date(d);const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,"0"),day=String(date.getDate()).padStart(2,"0");return `${y}-${m}-${day}`}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
function addMonths(d,n){const x=new Date(d);x.setMonth(x.getMonth()+n);return x}
function timeOnly(value){if(!value)return"—";return new Intl.DateTimeFormat("es-CO",{hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"America/Bogota"}).format(new Date(value))}
function weekdayShort(value){return new Intl.DateTimeFormat("es-CO",{weekday:"short",timeZone:"America/Bogota"}).format(new Date(value)).replace(".","").replace(/^./,c=>c.toUpperCase())}
