import {getSupabase} from "../services/supabase.js";
import {fmt} from "../core/format.js";
import {loading,toast,guide} from "../core/ui.js";

/* CRM Suministros · V11.13.0
   Analítica de personas: jornada, trabajo efectivo, pausas, tiempo sin clasificar,
   productividad, puntualidad, adherencia, estimación y contribución al proceso. */

const MOUNT_ID="flow-people-analytics-v11130";
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,Number(v||0)));
const num=v=>Number(v||0);
const hours=s=>{
  const n=num(s);
  if(n<=0)return "0 h";
  if(n<3600)return `${fmt.number(n/60,0)} min`;
  return `${fmt.number(n/3600,1)} h`;
};
const pct=v=>v===null||v===undefined?"—":`${fmt.number(v,1)}%`;
const safe=v=>fmt.escape(String(v??"—"));
const roleLabel=roles=>(roles||[]).map(r=>String(r).replaceAll("_"," ")).join(" · ")||"Sin rol visible";
let activeRequest=0;
let selectedProfile="";
let lastRangeKey="";
let observer=null;

async function peopleRpc(from,to,profileId=null){
  const {data,error}=await getSupabase().rpc("erp_x_vsm_people",{
    p_date_from:from,
    p_date_to:to,
    p_profile_id:profileId||null
  });
  if(error)throw error;
  return data||{};
}

function rangeFromPage(){
  const from=document.querySelector("#flow-from-v11120")?.value;
  const to=document.querySelector("#flow-to-v11120")?.value;
  return from&&to?{from,to}:null;
}

function ensureMount(){
  const head=document.querySelector(".flow-page-head-v11120");
  const anchor=document.querySelector("#vsm-result");
  if(!head||!anchor)return;
  let mount=document.getElementById(MOUNT_ID);
  if(!mount){
    mount=document.createElement("section");
    mount.id=MOUNT_ID;
    mount.className="people-analytics-v11130";
    mount.innerHTML=loading("Construyendo analítica de personas y tiempos…");
    anchor.insertAdjacentElement("afterend",mount);
    selectedProfile="";
    lastRangeKey="";
    refreshPeople(true).catch(()=>{});
  }
}

async function refreshPeople(force=false){
  const mount=document.getElementById(MOUNT_ID);
  const range=rangeFromPage();
  if(!mount||!range)return;
  const key=`${range.from}|${range.to}|${selectedProfile||"TEAM"}`;
  if(!force&&key===lastRangeKey)return;
  lastRangeKey=key;
  const request=++activeRequest;
  mount.innerHTML=loading("Midiendo jornada, trabajo efectivo, pausas, productividad y calidad de registro…");
  try{
    const data=await peopleRpc(range.from,range.to,selectedProfile||null);
    if(request!==activeRequest)return;
    mount.innerHTML=renderPeopleAnalytics(data);
    bindLocal(mount,data);
  }catch(error){
    if(request!==activeRequest)return;
    lastRangeKey="";
    mount.innerHTML=`<section class="people-error-v11130"><strong>No fue posible calcular la analítica de personas</strong><p>${safe(error?.message||"Error de consulta")}</p></section>`;
  }
}

function renderPeopleAnalytics(data){
  const summary=data.summary||{};
  const people=data.people||[];
  const profiles=data.profiles||[];
  const daily=data.daily||[];
  const pauses=data.pauseReasons||[];
  const idle=data.topIdlePeriods||[];
  const steps=data.stepContribution||[];
  const groups=data.activityGroups||[];
  const range=data.range||{};
  const coverage=num(summary.people)?num(summary.peopleWithActivity)/num(summary.people)*100:0;
  const effectiveShare=clamp(summary.effectiveOccupationPct);
  const idleShare=clamp(summary.idlePct);

  return `
    <section class="people-hero-v11130">
      <div>
        <span class="people-kicker-v11130">Analítica integral · Personas y tiempos</span>
        <h3>Rendimiento, ocupación y calidad del tiempo</h3>
        <p>Mide cuánto tiempo registra cada usuario, cómo se distribuye, cuánto queda sin clasificar, dónde existen pausas y qué tan consistente es la ejecución frente a compromisos y estimaciones.</p>
      </div>
      <div class="people-actions-v11130">
        ${profiles.length>1?`<label><span>Vista</span><select class="control" id="people-profile-v11130"><option value="">Equipo completo</option>${profiles.map(p=>`<option value="${safe(p.id)}" ${selectedProfile===p.id?"selected":""}>${safe(p.name)}</option>`).join("")}</select></label>`:""}
        <button class="btn btn-ghost" id="people-method-v11130">Método de cálculo</button>
      </div>
    </section>

    <section class="people-kpis-v11130" aria-label="Indicadores de personas y tiempos">
      ${kpi("Jornada programada",hours(summary.scheduledSeconds),`${fmt.number(summary.people||0)} persona(s)`,"schedule")}
      ${kpi("Tiempo efectivo",hours(summary.effectiveSeconds),`${pct(effectiveShare)} de ocupación efectiva`,"effective")}
      ${kpi("Sin clasificar",hours(summary.unclassifiedSeconds),"Sin tarea o actividad registrada","idle")}
      ${kpi("Pausas explícitas",hours(summary.explicitPauseSeconds),"Pausas registradas dentro de actividades","pause")}
      ${kpi("Proceso ERP",hours(summary.fixedProcessSeconds),`${fmt.number(summary.taskSessions||0)} sesiones de tarea`,"process")}
      ${kpi("Actividades",hours(summary.miscActivitySeconds),`${fmt.number(summary.activityExecutions||0)} ejecuciones`,"activity")}
      ${kpi("Tareas completadas",fmt.number(summary.tasksCompleted||0),`${fmt.number(summary.tasksHandled||0)} tareas tocadas`,"tasks")}
      ${kpi("Tiempo muerto potencial",hours(summary.potentialDeadSeconds),`${pct(idleShare)} de la jornada`,"risk")}
    </section>

    <section class="people-grid-v11130 people-grid-main-v11130">
      <article class="people-panel-v11130">
        <header><div><span>Composición por persona</span><h4>¿En qué se está yendo la jornada?</h4><p>Trabajo efectivo, pausas explícitas y tiempo sin clasificar dentro del calendario laboral.</p></div><strong>${fmt.number(people.length)} usuario(s)</strong></header>
        ${renderComposition(people)}
      </article>
      <article class="people-panel-v11130 people-ring-panel-v11130">
        <header><div><span>Cobertura de captura</span><h4>Confiabilidad del dato</h4><p>Una ocupación baja puede significar falta de registro, no necesariamente inactividad real.</p></div></header>
        <div class="people-ring-layout-v11130">
          <div class="people-ring-v11130" style="--people-value:${clamp(coverage)}"><strong>${pct(coverage)}</strong><span>personas con tiempo clasificado</span></div>
          <div class="people-quality-list-v11130">
            <div><span>Con registro</span><b>${fmt.number(summary.peopleWithActivity||0)}</b></div>
            <div><span>Sin registro</span><b>${fmt.number(summary.peopleWithoutActivity||0)}</b></div>
            <div><span>Sesiones ERP abiertas</span><b>${fmt.number(summary.openTaskSessions||0)}</b></div>
            <div><span>Actividades abiertas</span><b>${fmt.number(summary.openActivityExecutions||0)}</b></div>
          </div>
        </div>
      </article>
    </section>

    <section class="people-panel-v11130">
      <header><div><span>Tendencia ${range.trendGranularity==="WEEK"?"semanal":"diaria"}</span><h4>Ocupación efectiva vs. tiempo muerto potencial</h4><p>La serie usa el calendario empresarial; para periodos extensos se agrupa semanalmente para conservar legibilidad.</p></div><div class="people-legend-v11130"><i class="effective"></i>Efectivo <i class="idle"></i>Sin clasificar + pausas</div></header>
      ${renderTrend(daily)}
    </section>

    <section class="people-panel-v11130">
      <header><div><span>Comparación detallada</span><h4>KPIs por usuario</h4><p>Tiempo, volumen, velocidad, puntualidad, adherencia de inicio y exactitud frente a estimaciones.</p></div><small>Desplaza horizontalmente para ver todos los indicadores.</small></header>
      ${renderPeopleTable(people)}
    </section>

    <section class="people-grid-v11130 people-grid-three-v11130">
      <article class="people-panel-v11130">
        <header><div><span>Causas</span><h4>Pausas explícitas</h4><p>Duración y frecuencia por motivo registrado.</p></div></header>
        ${renderBarList(pauses.map(x=>({label:pauseLabel(x.reason),value:num(x.seconds),detail:`${fmt.number(x.events)} evento(s)`})),"seconds")}
      </article>
      <article class="people-panel-v11130">
        <header><div><span>Proceso</span><h4>Contribución por etapa</h4><p>Tiempo de toque registrado por usuario y etapa del pedido.</p></div></header>
        ${renderBarList(steps.slice(0,15).map(x=>({label:`${x.profileName} · ${x.stepName}`,value:num(x.seconds),detail:`${fmt.number(x.tasks)} tarea(s) · ${fmt.number(x.sessions)} sesión(es)`})),"seconds")}
      </article>
      <article class="people-panel-v11130">
        <header><div><span>Trabajo complementario</span><h4>Actividades por grupo</h4><p>Tiempo registrado fuera de las tareas fijas del pedido.</p></div></header>
        ${renderBarList(groups.slice(0,15).map(x=>({label:`${x.profileName} · ${x.group||"Sin grupo"}`,value:num(x.seconds),detail:`${fmt.number(x.executions)} ejecución(es)`})),"seconds")}
      </article>
    </section>

    <section class="people-grid-v11130 people-grid-main-v11130">
      <article class="people-panel-v11130">
        <header><div><span>Excepciones</span><h4>Periodos con mayor tiempo sin clasificar</h4><p>Sirve para investigar faltantes de registro, pausas prolongadas o capacidad no utilizada.</p></div></header>
        ${renderIdleTable(idle)}
      </article>
      <article class="people-panel-v11130">
        <header><div><span>Interpretación</span><h4>Lectura ejecutiva</h4><p>Los indicadores se calculan sin convertir automáticamente ausencia de registro en una conclusión disciplinaria.</p></div></header>
        ${renderDiagnostics(summary,people)}
      </article>
    </section>

    <section class="people-method-note-v11130">
      <strong>Base de medición:</strong> jornada programada según calendario institucional; proceso ERP mediante sesiones de tareas y corte; actividades mediante ejecuciones de trabajo; pausa explícita mediante registros de pausa; tiempo sin clasificar = jornada programada − tiempo clasificado. El “tiempo muerto potencial” combina tiempo sin clasificar y pausas explícitas y debe analizarse junto con la cobertura de captura.
    </section>`;
}

function kpi(label,value,detail,tone){
  return `<article class="people-kpi-v11130 ${tone}"><span>${safe(label)}</span><strong>${safe(value)}</strong><small>${safe(detail)}</small></article>`;
}

function renderComposition(people){
  if(!people.length)return `<div class="people-empty-v11130">No hay personas disponibles en este periodo.</div>`;
  const rows=[...people].sort((a,b)=>num(b.scheduledSeconds)-num(a.scheduledSeconds)||String(a.profileName).localeCompare(String(b.profileName)));
  return `<div class="people-composition-v11130">${rows.map(p=>{
    const scheduled=Math.max(num(p.scheduledSeconds),1);
    const effective=clamp(num(p.effectiveSeconds)/scheduled*100);
    const pause=clamp(num(p.explicitPauseSeconds)/scheduled*100);
    const unclassified=clamp(num(p.unclassifiedSeconds)/scheduled*100);
    return `<button class="people-composition-row-v11130" data-people-profile="${safe(p.profileId)}" title="Ver detalle de ${safe(p.profileName)}">
      <span class="person"><strong>${safe(p.profileName)}</strong><small>${safe(roleLabel(p.roles))}</small></span>
      <span class="bar"><i class="effective" style="width:${effective}%"></i><i class="pause" style="width:${pause}%"></i><i class="idle" style="width:${unclassified}%"></i></span>
      <span class="value"><b>${pct(p.effectiveOccupationPct)}</b><small>${hours(p.effectiveSeconds)} efectivas</small></span>
    </button>`;
  }).join("")}</div>`;
}

function renderTrend(rows){
  if(!rows.length)return `<div class="people-empty-v11130">Aún no hay serie temporal para este periodo.</div>`;
  const w=Math.max(760,rows.length*38),h=250,pad={l:42,r:18,t:18,b:38};
  const x=i=>pad.l+(rows.length===1?0:(i*(w-pad.l-pad.r)/(rows.length-1)));
  const y=v=>pad.t+(100-clamp(v))*(h-pad.t-pad.b)/100;
  const line=key=>rows.map((r,i)=>`${i?"L":"M"}${x(i).toFixed(1)},${y(r[key]).toFixed(1)}`).join(" ");
  const labels=rows.map((r,i)=>i%Math.max(1,Math.ceil(rows.length/10))===0?`<text x="${x(i)}" y="${h-12}" text-anchor="middle">${safe(shortDate(r.periodStart))}</text>`:"").join("");
  return `<div class="people-trend-scroll-v11130"><svg class="people-trend-v11130" viewBox="0 0 ${w} ${h}" role="img" aria-label="Ocupación efectiva y tiempo muerto potencial">
    <g class="grid">${[0,25,50,75,100].map(v=>`<line x1="${pad.l}" y1="${y(v)}" x2="${w-pad.r}" y2="${y(v)}"></line><text x="${pad.l-8}" y="${y(v)+3}" text-anchor="end">${v}%</text>`).join("")}</g>
    <path class="idle-line" d="${line("idlePct")}"></path>
    <path class="effective-line" d="${line("effectiveOccupationPct")}"></path>
    <g class="labels">${labels}</g>
    <g class="points">${rows.map((r,i)=>`<circle class="effective-point" cx="${x(i)}" cy="${y(r.effectiveOccupationPct)}" r="3"><title>${safe(shortDate(r.periodStart))}: ${pct(r.effectiveOccupationPct)} efectivo</title></circle><circle class="idle-point" cx="${x(i)}" cy="${y(r.idlePct)}" r="3"><title>${safe(shortDate(r.periodStart))}: ${pct(r.idlePct)} sin clasificar/pausa</title></circle>`).join("")}</g>
  </svg></div>`;
}

function renderPeopleTable(people){
  if(!people.length)return `<div class="people-empty-v11130">No hay información por usuario.</div>`;
  const rows=[...people].sort((a,b)=>num(b.effectiveSeconds)-num(a.effectiveSeconds));
  return `<div class="people-table-wrap-v11130"><table class="people-table-v11130"><thead><tr>
    <th>Usuario</th><th>Jornada</th><th>Efectivo</th><th>Sin clasificar</th><th>Pausas</th><th>Ocup. efectiva</th><th>Proceso ERP</th><th>Actividades</th><th>Tareas</th><th>Sesiones</th><th>Sesión prom.</th><th>P90 sesión</th><th>Tareas / h</th><th>Asignaciones</th><th>A tiempo</th><th>Inicio ≤5 min</th><th>Demora prom.</th><th>Exactitud estimación</th><th>Fragmentación / h</th>
  </tr></thead><tbody>${rows.map(p=>`<tr data-people-profile="${safe(p.profileId)}">
    <td><button class="people-name-v11130" data-people-profile="${safe(p.profileId)}"><strong>${safe(p.profileName)}</strong><small>${safe(roleLabel(p.roles))}</small></button></td>
    <td>${hours(p.scheduledSeconds)}</td><td><b>${hours(p.effectiveSeconds)}</b></td><td>${hours(p.unclassifiedSeconds)}</td><td>${hours(p.explicitPauseSeconds)}</td><td>${ratioBadge(p.effectiveOccupationPct)}</td><td>${hours(p.processTouchSeconds)}</td><td>${hours(p.activityNetSeconds)}</td><td>${fmt.number(p.tasksCompleted||0)}<small>${fmt.number(p.tasksHandled||0)} tocadas</small></td><td>${fmt.number(p.taskSessions||0)}</td><td>${fmt.number(p.avgSessionMinutes||0,1)} min</td><td>${fmt.number(p.p90SessionMinutes||0,1)} min</td><td>${fmt.number(p.tasksPerEffectiveHour||0,2)}</td><td>${fmt.number(p.completedAssignments||0)}<small>${fmt.number(p.pendingAssignments||0)} pendientes</small></td><td>${pct(p.onTimePct)}</td><td>${pct(p.startAdherencePct)}</td><td>${fmt.number(p.avgStartDelayMinutes||0,1)} min</td><td>${pct(p.estimateAccuracyPct)}</td><td>${fmt.number(p.eventsPerEffectiveHour||0,2)}</td>
  </tr>`).join("")}</tbody></table></div>`;
}

function renderBarList(rows,kind="seconds"){
  if(!rows.length)return `<div class="people-empty-v11130">No hay registros para esta categoría en el periodo.</div>`;
  const max=Math.max(...rows.map(r=>num(r.value)),1);
  return `<div class="people-bar-list-v11130">${rows.map(r=>`<div class="people-bar-row-v11130"><div><strong>${safe(r.label)}</strong><small>${safe(r.detail)}</small></div><span class="track"><i style="width:${clamp(num(r.value)/max*100)}%"></i></span><b>${kind==="seconds"?hours(r.value):fmt.number(r.value)}</b></div>`).join("")}</div>`;
}

function renderIdleTable(rows){
  if(!rows.length)return `<div class="people-empty-v11130">No hay periodos laborales para analizar.</div>`;
  return `<div class="people-table-wrap-v11130 compact"><table class="people-table-v11130"><thead><tr><th>Usuario</th><th>Periodo</th><th>Jornada</th><th>Efectivo</th><th>Pausa</th><th>Sin clasificar / muerto potencial</th><th>%</th></tr></thead><tbody>${rows.map(r=>`<tr><td><button class="people-name-v11130" data-people-profile="${safe(r.profileId)}">${safe(r.profileName)}</button></td><td>${safe(shortDate(r.periodStart))}</td><td>${hours(r.scheduledSeconds)}</td><td>${hours(r.effectiveSeconds)}</td><td>${hours(r.explicitPauseSeconds)}</td><td><b>${hours(r.potentialDeadSeconds)}</b></td><td>${ratioBadge(100-num(r.idlePct),true)}</td></tr>`).join("")}</tbody></table></div>`;
}

function renderDiagnostics(summary,people){
  const coverage=num(summary.people)?num(summary.peopleWithActivity)/num(summary.people)*100:0;
  const avgEffective=people.length?people.reduce((a,p)=>a+num(p.effectiveOccupationPct),0)/people.length:0;
  const highIdle=people.filter(p=>num(p.idlePct)>=50).length;
  const withEstimate=people.filter(p=>p.estimateAccuracyPct!==null&&p.estimateAccuracyPct!==undefined).length;
  const items=[
    {label:"Cobertura",value:pct(coverage),text:coverage<70?"La captura de tiempo aún es insuficiente para interpretar ausencia de registro como inactividad real.":"La mayoría de usuarios tiene tiempo clasificado en el periodo."},
    {label:"Ocupación media",value:pct(avgEffective),text:"Promedio simple de ocupación efectiva entre los usuarios visibles."},
    {label:"Alta brecha de registro",value:fmt.number(highIdle),text:"Usuarios con 50% o más de jornada sin clasificar o en pausa explícita."},
    {label:"Estimaciones evaluables",value:fmt.number(withEstimate),text:"Usuarios con ejecuciones que permiten comparar duración real frente a duración estimada."}
  ];
  return `<div class="people-diagnostics-v11130">${items.map(i=>`<div><span>${safe(i.label)}</span><strong>${safe(i.value)}</strong><p>${safe(i.text)}</p></div>`).join("")}</div>`;
}

function ratioBadge(value,invert=false){
  if(value===null||value===undefined)return `<span class="people-ratio-v11130 neutral">—</span>`;
  const v=clamp(value);
  const score=invert?100-v:v;
  const tone=score>=80?"good":score>=55?"mid":"low";
  return `<span class="people-ratio-v11130 ${tone}">${pct(v)}</span>`;
}

function pauseLabel(code){
  const map={BREAK:"Descanso",MEETING:"Reunión",MATERIAL:"Espera de material",SYSTEM:"Sistema",CLIENT:"Cliente",OTHER:"Otro"};
  return map[String(code||"").toUpperCase()]||String(code||"Otro").replaceAll("_"," ");
}

function shortDate(value){
  if(!value)return "—";
  try{return new Intl.DateTimeFormat("es-CO",{day:"2-digit",month:"short"}).format(new Date(`${String(value).slice(0,10)}T12:00:00`));}catch{return String(value);}
}

function bindLocal(mount,data){
  mount.querySelector("#people-profile-v11130")?.addEventListener("change",event=>{
    selectedProfile=event.target.value||"";
    lastRangeKey="";
    refreshPeople(true).catch(error=>toast(error.message,"error",7000));
  });
  mount.querySelectorAll("[data-people-profile]").forEach(node=>node.addEventListener("click",event=>{
    const id=event.currentTarget.dataset.peopleProfile;
    if(!id||!(data.profiles||[]).some(p=>p.id===id))return;
    selectedProfile=id;
    lastRangeKey="";
    refreshPeople(true).catch(error=>toast(error.message,"error",7000));
    document.getElementById(MOUNT_ID)?.scrollIntoView({behavior:"smooth",block:"start"});
  }));
  mount.querySelector("#people-method-v11130")?.addEventListener("click",()=>guide({
    title:"Cómo se calculan los tiempos por usuario",
    description:"El tablero separa captura de tiempo, capacidad programada y pausas para evitar conclusiones incorrectas.",
    items:[
      {title:"Jornada programada",detail:"Horas laborables del calendario institucional; excluye periodos no laborables configurados."},
      {title:"Proceso ERP",detail:"Intervalos unidos de sesiones sobre tareas del pedido y ejecuciones de corte."},
      {title:"Actividades",detail:"Intervalos registrados en Jornada y actividades. Los solapamientos se consolidan para no contar dos veces la misma franja."},
      {title:"Tiempo efectivo",detail:"Tiempo clasificado consolidado menos pausas explícitas registradas dentro de actividades."},
      {title:"Tiempo sin clasificar",detail:"Jornada programada sin una tarea o actividad registrada. Es una brecha de captura y no prueba por sí sola inactividad."},
      {title:"Tiempo muerto potencial",detail:"Tiempo sin clasificar más pausas explícitas, limitado a la jornada programada."},
      {title:"Exactitud de estimación",detail:"Cercanía entre la duración real y la duración estimada de las ejecuciones que cuentan con estimación."},
      {title:"Fragmentación",detail:"Cantidad de sesiones ERP y ejecuciones de actividad por hora efectiva; valores altos sugieren mayor cambio de contexto."}
    ]
  }));
}

function scheduleRefresh(){
  setTimeout(()=>{
    lastRangeKey="";
    refreshPeople(true).catch(()=>{});
  },0);
}

document.addEventListener("click",event=>{
  if(event.target.closest("#flow-run-v11120,[data-flow-preset]"))scheduleRefresh();
});

document.addEventListener("change",event=>{
  if(event.target.matches("#flow-from-v11120,#flow-to-v11120"))lastRangeKey="";
});

const app=document.getElementById("app")||document.body;
observer=new MutationObserver(()=>ensureMount());
observer.observe(app,{childList:true,subtree:true});
ensureMount();
