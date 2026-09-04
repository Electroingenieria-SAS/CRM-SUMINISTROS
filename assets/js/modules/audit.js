import {getSupabase} from "../services/supabase.js";
import {fmt,statusBadge} from "../core/format.js";
import {loading,empty,paginationHtml,guide,toast} from "../core/ui.js";
import {openOrder} from "./orders.js";

const CATEGORIES=[
  {id:"ALL",label:"Todos los eventos",hint:"Trazabilidad completa",icon:"▦",count:"all"},
  {id:"CREATED",label:"Pedidos creados",hint:"Origen del pedido",icon:"＋",count:"created"},
  {id:"FLOW",label:"Acciones del flujo",hint:"Avances y cambios",icon:"→",count:"flow"},
  {id:"DECISIONS",label:"Decisiones",hint:"Aprobaciones y rechazos",icon:"✓",count:"decisions"},
  {id:"INCIDENTS",label:"Incidencias",hint:"Hallazgos operativos",icon:"!",count:"incidents",summaryOnly:true},
  {id:"TRACE",label:"Trazabilidad completa",hint:"Pedidos con evidencia",icon:"⌘",count:"traceability",summaryOnly:true}
];

function localDate(value){
  const d=value instanceof Date?value:new Date(value);
  const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function duration(seconds){
  const n=Math.max(0,Number(seconds||0));
  if(!n)return "—";
  const h=Math.floor(n/3600),m=Math.floor((n%3600)/60),s=Math.floor(n%60);
  if(h)return `${h}h ${String(m).padStart(2,"0")}m`;
  if(m)return `${m}m ${String(s).padStart(2,"0")}s`;
  return `${s}s`;
}
function riskBadge(value="LOW"){
  const key=String(value||"LOW").toUpperCase();
  const label={CRITICAL:"Crítico",HIGH:"Alto",MEDIUM:"Medio",LOW:"Bajo"}[key]||fmt.label(key);
  return `<span class="audit-risk audit-risk-${key.toLowerCase()}">${fmt.escape(label)}</span>`;
}
function eventLabel(event){return fmt.action(event.actionCode||event.eventType||"EVENT")}
function eventFamily(event){return fmt.label(event.eventType||"Evento")}
function pct(part,total){return total?Math.max(0,Math.min(100,Math.round(Number(part||0)*100/Number(total)))):0}
function csvCell(value){const text=String(value??"").replaceAll('"','""');return `"${text}"`}
function evidenceLinks(files=[]){
  if(!files?.length)return `<span class="audit-muted">Sin archivo asociado</span>`;
  return `<div class="audit-evidence-list">${files.map(file=>file.url?`<a href="${fmt.escape(file.url)}" target="_blank" rel="noopener" class="audit-evidence-link">${fmt.escape(file.name||file.category||"Evidencia")}</a>`:`<span>${fmt.escape(file.name||file.category||"Evidencia")}</span>`).join("")}</div>`;
}

async function fetchAudit(filters){
  const {data,error}=await getSupabase().rpc("erp_x_audit_dashboard",{p_filters:filters});
  if(error)throw new Error(error.message||"No fue posible consultar la auditoría.");
  return data||{};
}

export async function renderAudit(root){
  const now=new Date();
  const since=new Date(now);since.setDate(since.getDate()-30);
  const state={category:"ALL",page:1,pageSize:50,selected:null,data:null,filters:{search:"",dateFrom:localDate(since),dateTo:localDate(now),step:"",actorId:"",priority:"",client:""}};

  root.innerHTML=`
    <section class="page-head audit-page-head">
      <div>
        <span class="audit-kicker">CONTROL · TRAZABILIDAD · EVIDENCIA</span>
        <h2>Auditoría de la operación</h2>
        <p>Consulta trazabilidad, responsables, tiempos, decisiones y evidencias de cada pedido.</p>
      </div>
      <div class="page-actions audit-head-actions">
        <button class="btn btn-ghost" id="audit-export">Exportar CSV</button>
        <button class="btn btn-help" id="audit-help">Ver guía</button>
      </div>
    </section>

    <section class="audit-kpis" id="audit-kpis">${kpiSkeleton()}</section>

    <section class="card audit-filter-card">
      <div class="audit-filter-grid">
        <label class="audit-field audit-field-search"><span>Buscar</span><input class="control" id="audit-search" placeholder="Pedido, cliente, evento, responsable o contenido"></label>
        <label class="audit-field"><span>Desde</span><input class="control" type="date" id="audit-from" value="${state.filters.dateFrom}"></label>
        <label class="audit-field"><span>Hasta</span><input class="control" type="date" id="audit-to" value="${state.filters.dateTo}"></label>
        <label class="audit-field"><span>Proceso / etapa</span><select class="control" id="audit-step"><option value="">Todas</option></select></label>
        <label class="audit-field"><span>Responsable</span><select class="control" id="audit-actor"><option value="">Todos</option></select></label>
        <label class="audit-field"><span>Prioridad</span><select class="control" id="audit-priority"><option value="">Todas</option><option value="LOW">Baja</option><option value="MEDIUM">Media</option><option value="URGENT">Urgente</option></select></label>
        <label class="audit-field"><span>Cliente</span><select class="control" id="audit-client"><option value="">Todos</option></select></label>
        <div class="audit-filter-actions"><button class="btn btn-search" id="audit-load">Buscar</button><button class="btn btn-ghost" id="audit-clear">Limpiar filtros</button></div>
      </div>
    </section>

    <section class="audit-category-strip" id="audit-categories">${categorySkeleton()}</section>

    <section class="audit-workspace">
      <div class="card audit-main-card">
        <div id="audit-result">${loading("Consultando trazabilidad…")}</div>
        <div id="audit-detail"></div>
      </div>
      <aside class="audit-insights" id="audit-insights">${insightSkeleton()}</aside>
    </section>`;

  const $=selector=>root.querySelector(selector);
  const readFilters=()=>{
    state.filters={
      search:$("#audit-search").value.trim(),dateFrom:$("#audit-from").value||null,dateTo:$("#audit-to").value||null,
      step:$("#audit-step").value||null,actorId:$("#audit-actor").value||null,priority:$("#audit-priority").value||null,client:$("#audit-client").value||null
    };
  };
  const requestFilters=(page=state.page,pageSize=state.pageSize,category=state.category)=>({...state.filters,category:category==="TRACE"?"ALL":category==="INCIDENTS"?"ALL":category,page,pageSize});

  async function load(page=1){
    readFilters();state.page=page;state.selected=null;
    $("#audit-result").innerHTML=loading("Consultando eventos, riesgos y evidencias…");
    $("#audit-detail").innerHTML="";
    try{
      const data=await fetchAudit(requestFilters(page));
      state.data=data;
      hydrateFacets(data.facets||{});
      renderKpis(data.summary||{});
      renderCategories(data.summary?.tabCounts||{});
      renderInsights(data.summary||{},data.insights||{});
      renderResults(data);
    }catch(error){
      $("#audit-result").innerHTML=empty("No fue posible cargar la auditoría",error.message||"Revisa la conexión e inténtalo nuevamente.");
      toast(error.message||"No fue posible cargar la auditoría.","error",6500);
    }
  }

  function hydrateFacets(facets){
    const step=$("#audit-step"),actor=$("#audit-actor"),client=$("#audit-client");
    const values={step:step.value,actor:actor.value,client:client.value};
    step.innerHTML=`<option value="">Todas</option>${(facets.steps||[]).map(item=>`<option value="${fmt.escape(item.code)}">${fmt.escape(item.label||fmt.step(item.code))}</option>`).join("")}`;
    actor.innerHTML=`<option value="">Todos</option>${(facets.actors||[]).map(item=>`<option value="${fmt.escape(item.id)}">${fmt.escape(item.name)}</option>`).join("")}`;
    client.innerHTML=`<option value="">Todos</option>${(facets.clients||[]).map(name=>`<option value="${fmt.escape(name)}">${fmt.escape(name)}</option>`).join("")}`;
    step.value=values.step;actor.value=values.actor;client.value=values.client;
  }

  function renderKpis(summary){
    $("#audit-kpis").innerHTML=`
      ${kpi("Pedidos auditados",fmt.number(summary.auditedOrders),"Trazabilidad con eventos","orders")}
      ${kpi("Eventos del flujo",fmt.number(summary.eventCount),"Registros del periodo","events")}
      ${kpi("Aprobaciones pendientes",fmt.number(summary.pendingApprovals),`${fmt.number(summary.approvalTotal)} solicitudes registradas`,"approvals")}
      ${kpi("Incidencias abiertas",fmt.number(summary.openIssues),"Hallazgos aún sin cierre","issues")}
      ${kpi("Tiempo promedio por etapa",duration(summary.avgStageSeconds),"Tiempo operativo registrado","time")}
      ${kpi("Pedidos críticos",fmt.number(summary.criticalOrders),"Urgentes o con alerta crítica","critical")}`;
  }

  function renderCategories(counts){
    $("#audit-categories").innerHTML=CATEGORIES.map(item=>{
      const value=counts?.[item.count]??0;
      const active=state.category===item.id;
      return `<button type="button" class="audit-category ${active?"active":""}" data-audit-category="${item.id}"><span class="audit-category-icon">${item.icon}</span><span><strong>${fmt.escape(item.label)}</strong><small>${fmt.escape(item.hint)}</small></span><b>${fmt.number(value)}</b></button>`;
    }).join("");
    $("#audit-categories").querySelectorAll("[data-audit-category]").forEach(button=>button.onclick=async()=>{
      const category=button.dataset.auditCategory;
      if(category==="INCIDENTS"){
        state.category="INCIDENTS";renderCategories(counts);$("#audit-result").innerHTML=empty("Incidencias en el resumen","Las incidencias se auditan desde el panel lateral y el Centro de Excepciones. Aquí mantenemos la bitácora de eventos del pedido.");$("#audit-detail").innerHTML="";return;
      }
      state.category=category;await load(1);
    });
  }

  function renderResults(data){
    const target=$("#audit-result");
    const items=data.items||[];
    target.innerHTML=items.length?`${auditTable(items)}${paginationHtml(data.pagination)}`:empty("Sin eventos","No existen registros para la combinación de filtros seleccionada.");
    target.querySelectorAll("[data-order]").forEach(link=>link.onclick=event=>{event.stopPropagation();openOrder(link.dataset.order)});
    target.querySelectorAll("[data-audit-row]").forEach(row=>row.onclick=()=>selectEvent(row.dataset.auditRow));
    target.querySelectorAll("[data-page]").forEach(button=>button.onclick=()=>load(Number(button.dataset.page)));
  }

  function selectEvent(id){
    state.selected=id;
    $("#audit-result").querySelectorAll("[data-audit-row]").forEach(row=>row.classList.toggle("selected",row.dataset.auditRow===id));
    const event=(state.data?.items||[]).find(item=>String(item.id)===String(id));
    $("#audit-detail").innerHTML=event?eventDetail(event):"";
    $("#audit-detail").querySelector("[data-open-order]")?.addEventListener("click",()=>openOrder(event.orderId));
  }

  function renderInsights(summary,insights){
    const severities=insights.issueSeverity||{};
    const critical=Number(severities.CRITICAL||0),high=Number(severities.HIGH||0),medium=Number(severities.MEDIUM||0),low=Number(severities.LOW||0),total=critical+high+medium+low;
    const cDeg=total?critical/total*360:0,hDeg=total?high/total*360:0,mDeg=total?medium/total*360:0;
    const approvalPct=pct(summary.pendingApprovals,summary.approvalTotal);
    const sla=summary.slaCompliance==null?null:Number(summary.slaCompliance);
    const bottlenecks=insights.bottlenecks||[],max=Math.max(...bottlenecks.map(x=>Number(x.avgSeconds||0)),1);
    $("#audit-insights").innerHTML=`
      <section class="card audit-side-card">
        <div class="audit-side-title"><div><span>RESUMEN DE AUDITORÍA</span><h3>Hallazgos y control</h3></div><span class="audit-live-dot">En línea</span></div>
        <div class="audit-severity-block">
          <div class="audit-donut" style="background:conic-gradient(#dc2626 0 ${cDeg}deg,#f97316 ${cDeg}deg ${cDeg+hDeg}deg,#eab308 ${cDeg+hDeg}deg ${cDeg+hDeg+mDeg}deg,#16a34a ${cDeg+hDeg+mDeg}deg 360deg)"><div><b>${fmt.number(total)}</b><span>Alertas</span></div></div>
          <div class="audit-severity-list">
            ${severityRow("Críticas",critical,"critical")}${severityRow("Altas",high,"high")}${severityRow("Medias",medium,"medium")}${severityRow("Bajas",low,"low")}
          </div>
        </div>
      </section>
      <section class="card audit-side-card">
        <div class="audit-side-heading"><strong>Aprobaciones</strong><span>${fmt.number(summary.pendingApprovals)} / ${fmt.number(summary.approvalTotal)}</span></div>
        <div class="audit-progress"><i style="width:${approvalPct}%"></i></div><div class="audit-progress-note"><span>Pendientes</span><b>${approvalPct}%</b></div>
      </section>
      <section class="card audit-side-card">
        <div class="audit-side-heading"><strong>Cuellos de botella</strong><span>Promedio por etapa</span></div>
        <div class="audit-bottlenecks">${bottlenecks.length?bottlenecks.map((item,index)=>`<div class="audit-bottleneck"><div><span>${fmt.escape(fmt.step(item.stepCode))}</span><b>${duration(item.avgSeconds)}</b></div><div class="audit-bar"><i style="width:${Math.max(8,Number(item.avgSeconds||0)*100/max)}%" data-rank="${index+1}"></i></div></div>`).join(""):"<p class='audit-muted'>Aún no hay tiempos completados suficientes.</p>"}</div>
      </section>
      <section class="card audit-side-card audit-split-card">
        <div><div class="audit-side-heading"><strong>Responsables con más eventos</strong></div>${(insights.topActors||[]).slice(0,4).map(item=>`<div class="audit-actor-row"><span class="audit-avatar">${fmt.escape(fmt.initials(item.actor))}</span><span><b>${fmt.escape(item.actor)}</b><small>${fmt.escape(fmt.role(item.roleCode||""))}</small></span><strong>${fmt.number(item.events)}</strong></div>`).join("")||"<p class='audit-muted'>Sin actividad registrada.</p>"}</div>
        <div class="audit-sla-box"><span>Cumplimiento SLA</span>${sla==null?`<div class="audit-sla-empty">Sin base</div><small>No hay pedidos cerrados con promesa registrada.</small>`:`<div class="audit-sla-ring" style="--audit-sla:${Math.max(0,Math.min(100,sla))}%"><b>${fmt.number(sla,1)}%</b></div><small>Pedidos cerrados dentro de la promesa.</small>`}</div>
      </section>
      <section class="card audit-side-card">
        <div class="audit-side-heading"><strong>Alertas activas</strong><span>${fmt.number((insights.alerts||[]).length)} visibles</span></div>
        <div class="audit-alert-list">${(insights.alerts||[]).length?(insights.alerts||[]).map(alert=>`<div class="audit-alert-item"><span class="audit-alert-level level-${Number(alert.level||1)}">!</span><div><b>${fmt.escape(alert.orderNumber||"Pedido")}</b><p>${fmt.escape(alert.message||"Alerta operativa")}</p><small>${fmt.date(alert.createdAt)}</small></div></div>`).join(""):"<p class='audit-muted'>No hay alertas operativas abiertas.</p>"}</div>
      </section>`;
  }

  async function exportCsv(){
    try{
      readFilters();toast("Preparando archivo de auditoría…","success",1800);
      const first=await fetchAudit(requestFilters(1,100,state.category));
      const pages=Math.min(Number(first.pagination?.totalPages||1),50),rows=[...(first.items||[])];
      for(let page=2;page<=pages;page++)rows.push(...((await fetchAudit(requestFilters(page,100,state.category))).items||[]));
      const headers=["Fecha y hora","Pedido","Cliente","Prioridad","Proceso anterior","Proceso nuevo","Evento","Tipo de evento","Estado anterior","Estado nuevo","Responsable","Rol","Duración segundos","Riesgo","Evidencias","Referencia técnica","Detalle"];
      const lines=[headers.map(csvCell).join(";")].concat(rows.map(event=>[
        fmt.date(event.createdAt),event.orderNumber,event.clientName,fmt.label(event.priority),fmt.step(event.fromStep),fmt.step(event.toStep),eventLabel(event),eventFamily(event),fmt.label(event.fromStatus),fmt.label(event.toStatus),event.actor,fmt.role(event.actorRole),event.durationSeconds,event.riskLevel,event.evidenceCount,event.id,event.detail||fmt.data(event.payload)
      ].map(csvCell).join(";")));
      const blob=new Blob(["\uFEFF"+lines.join("\n")],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");
      a.href=url;a.download=`auditoria-operacion-${localDate(new Date())}.csv`;document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url);
      if(Number(first.pagination?.totalPages||1)>50)toast("El archivo se limitó a 5.000 eventos. Ajusta los filtros para un informe más específico.","error",6500);else toast(`Auditoría exportada: ${fmt.number(rows.length)} eventos.`);
    }catch(error){toast(error.message||"No fue posible exportar la auditoría.","error",6500)}
  }

  $("#audit-load").onclick=()=>load(1);
  $("#audit-search").onkeydown=event=>{if(event.key==="Enter")load(1)};
  $("#audit-clear").onclick=()=>{
    $("#audit-search").value="";$("#audit-from").value=localDate(since);$("#audit-to").value=localDate(now);$("#audit-step").value="";$("#audit-actor").value="";$("#audit-priority").value="";$("#audit-client").value="";state.category="ALL";load(1);
  };
  $("#audit-export").onclick=exportCsv;
  $("#audit-help").onclick=()=>guide({title:"Cómo auditar la operación",description:"La auditoría reúne la trazabilidad del pedido, el responsable, los tiempos, los cambios y la evidencia disponible.",items:[{title:"Define el periodo",detail:"Filtra por fechas, proceso, responsable, prioridad o cliente."},{title:"Identifica riesgos",detail:"Los eventos se clasifican según alertas, bloqueos, prioridad y aprobaciones pendientes."},{title:"Abre un evento",detail:"Revisa el antes y después, la duración, el payload técnico y las evidencias registradas."},{title:"Contrasta el pedido",detail:"Abre el expediente completo desde cualquier evento para verificar el proceso de punta a punta."},{title:"Exporta la evidencia",detail:"Descarga la vista filtrada en CSV para análisis externo o papeles de trabajo."}]});

  await load();
}

function kpiSkeleton(){return Array.from({length:6},()=>`<div class="card audit-kpi audit-kpi-loading"><span></span><i></i></div>`).join("")}
function categorySkeleton(){return CATEGORIES.map(item=>`<div class="audit-category audit-category-loading"><span></span><i></i></div>`).join("")}
function insightSkeleton(){return `<section class="card audit-side-card">${loading("Construyendo resumen…")}</section>`}
function kpi(title,value,note,tone){return `<article class="card audit-kpi tone-${tone}"><span class="audit-kpi-icon"></span><div><small>${fmt.escape(title)}</small><strong>${fmt.escape(String(value??"—"))}</strong><p>${fmt.escape(note)}</p></div></article>`}
function severityRow(label,value,tone){return `<div><span class="audit-severity-dot ${tone}"></span><span>${label}</span><b>${fmt.number(value)}</b></div>`}

function auditTable(rows){
  return `<div class="audit-table-head"><div><span>BITÁCORA DE EVENTOS</span><h3>Trazabilidad registrada</h3></div><small>Selecciona una fila para revisar el detalle y la evidencia.</small></div><div class="table-wrap audit-table-wrap"><table class="audit-table"><thead><tr><th>Fecha y hora</th><th>Pedido / Cliente</th><th>Proceso / Etapa</th><th>Evento</th><th>Cambio realizado</th><th>Responsable</th><th>Duración</th><th>Riesgo</th><th>Evidencia</th><th>Estado</th></tr></thead><tbody>${rows.map(event=>`<tr data-audit-row="${fmt.escape(event.id)}"><td data-label="Fecha y hora"><div class="cell-main">${fmt.date(event.createdAt)}</div><div class="cell-sub">Ref. ${fmt.escape(event.id)}</div></td><td data-label="Pedido / Cliente"><button class="table-link audit-order-link" data-order="${fmt.escape(event.orderId||"")}">${fmt.escape(event.orderNumber||"—")}</button><div class="cell-sub">${fmt.escape(event.clientName||"—")}</div>${event.priority?`<div class="audit-priority-inline">${fmt.escape(fmt.label(event.priority))}</div>`:""}</td><td data-label="Proceso / Etapa"><div class="cell-main">${fmt.escape(fmt.step(event.toStep||event.fromStep||event.currentStep))}</div><div class="cell-sub">${fmt.escape(fmt.label(event.toStatus||event.orderStatus))}</div></td><td data-label="Evento"><div class="cell-main">${fmt.escape(eventLabel(event))}</div><div class="cell-sub">${fmt.escape(eventFamily(event))}</div></td><td data-label="Cambio realizado"><div class="audit-change"><span>${fmt.escape(fmt.step(event.fromStep))}</span><b>→</b><span>${fmt.escape(fmt.step(event.toStep))}</span></div><div class="cell-sub">${fmt.escape(fmt.label(event.fromStatus))} → ${fmt.escape(fmt.label(event.toStatus))}</div></td><td data-label="Responsable"><div class="audit-person"><span class="audit-avatar">${fmt.escape(fmt.initials(event.actor))}</span><span><b>${fmt.escape(event.actor||"Sistema")}</b><small>${fmt.escape(fmt.role(event.actorRole||""))}</small></span></div></td><td data-label="Duración">${duration(event.durationSeconds)}</td><td data-label="Riesgo">${riskBadge(event.riskLevel)}</td><td data-label="Evidencia"><span class="audit-evidence-count ${Number(event.evidenceCount||0)?"has":""}">${Number(event.evidenceCount||0)?`${fmt.number(event.evidenceCount)} archivo${Number(event.evidenceCount)===1?"":"s"}`:"Sin evidencia"}</span></td><td data-label="Estado">${statusBadge(event.toStatus||event.orderStatus||"COMPLETED")}</td></tr>`).join("")}</tbody></table></div>`;
}

function eventDetail(event){
  const beforeStep=fmt.step(event.fromStep),afterStep=fmt.step(event.toStep),beforeStatus=fmt.label(event.fromStatus),afterStatus=fmt.label(event.toStatus);
  return `<section class="audit-event-detail">
    <header><div><span>DETALLE DEL EVENTO</span><h3>${fmt.escape(eventLabel(event))}</h3><p>${fmt.escape(event.orderNumber)} · ${fmt.escape(event.clientName)}</p></div><button class="btn btn-ghost" type="button" data-open-order>Ver expediente del pedido</button></header>
    <div class="audit-trace-line"><div class="done"><i></i><span><b>${fmt.escape(beforeStep)}</b><small>${fmt.escape(beforeStatus)}</small></span></div><div class="active"><i></i><span><b>${fmt.escape(eventLabel(event))}</b><small>${fmt.date(event.createdAt)}</small></span></div><div class="done"><i></i><span><b>${fmt.escape(afterStep)}</b><small>${fmt.escape(afterStatus)}</small></span></div></div>
    <div class="audit-detail-grid">
      <article><h4>Responsabilidad</h4><dl><div><dt>Usuario</dt><dd>${fmt.escape(event.actor||"Sistema")}</dd></div><div><dt>Rol</dt><dd>${fmt.escape(fmt.role(event.actorRole||""))}</dd></div><div><dt>Acción</dt><dd>${fmt.escape(eventLabel(event))}</dd></div><div><dt>Fecha y hora</dt><dd>${fmt.date(event.createdAt)}</dd></div><div><dt>Duración asociada</dt><dd>${duration(event.durationSeconds)}</dd></div></dl></article>
      <article><h4>Cambio registrado</h4><div class="audit-before-after"><div><span>ANTES</span><b>${fmt.escape(beforeStep)}</b><small>${fmt.escape(beforeStatus)}</small></div><i>→</i><div><span>DESPUÉS</span><b>${fmt.escape(afterStep)}</b><small>${fmt.escape(afterStatus)}</small></div></div><dl><div><dt>Riesgo contextual</dt><dd>${riskBadge(event.riskLevel)}</dd></div><div><dt>Prioridad del pedido</dt><dd>${fmt.escape(fmt.label(event.priority))}</dd></div></dl></article>
      <article><h4>Evidencia y referencia</h4><dl><div><dt>Archivos asociados</dt><dd>${evidenceLinks(event.evidenceFiles)}</dd></div><div><dt>Aprobación asociada</dt><dd>${fmt.escape(event.approvalRef||"No registrada en este evento")}</dd></div><div><dt>Referencia técnica</dt><dd>${fmt.escape(event.id)}</dd></div></dl></article>
      <article class="audit-payload"><h4>Información registrada</h4>${event.detail?`<p class="audit-event-note">${fmt.escape(event.detail)}</p>`:""}<pre class="code">${fmt.escape(fmt.data(event.payload))}</pre></article>
    </div>
  </section>`;
}
