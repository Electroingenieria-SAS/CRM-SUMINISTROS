import {getSupabase} from "../services/supabase.js";
import {fmt} from "../core/format.js";
import {loading,toast,guide} from "../core/ui.js";

/* CRM Suministros · Analítica y reportes V11.14.0 */
const TZ="America/Bogota";
const TABS=[
  ["executive","Resumen ejecutivo"],
  ["operation","Operación y SLA"],
  ["commercial","Comercial"],
  ["logistics","Logística e inventario"],
  ["people","Personas"],
  ["explorer","Explorador BI"],
  ["quality","Calidad del dato"],
  ["saved","Vistas guardadas"]
];

const DATASETS={
  orders:{
    label:"Pedidos",
    dimensions:{status:"Estado",step:"Etapa",route:"Ruta",type:"Tipo",city:"Ciudad",seller:"Asesor",client:"Cliente",priority:"Prioridad",day:"Día"},
    metrics:{count:"Pedidos",closed:"Pedidos cerrados",invoice_amount:"Valor facturado",avg_cycle_hours:"Ciclo promedio (h)"}
  },
  tasks:{
    label:"Tareas",
    dimensions:{step:"Etapa",status:"Estado",assignee:"Responsable",day:"Día"},
    metrics:{count:"Tareas",completed:"Tareas completadas",avg_hours:"Tiempo promedio (h)",p90_hours:"P90 de tiempo (h)",business_hours:"Horas productivas"}
  },
  invoices:{
    label:"Facturación",
    dimensions:{status:"Estado",currency:"Moneda",seller:"Asesor",client:"Cliente",day:"Día"},
    metrics:{count:"Facturas",amount:"Valor facturado",avg_amount:"Factura promedio"}
  },
  deliveries:{
    label:"Entregas",
    dimensions:{route:"Ruta",carrier:"Transportadora",status:"Estado",day:"Día"},
    metrics:{count:"Entregas",delivered:"Entregas completadas",cost:"Costo logístico",avg_transit_hours:"Tránsito promedio (h)"}
  },
  inventory:{
    label:"Inventario",
    dimensions:{reference:"Referencia",location:"Ubicación",warehouse:"Bodega",item_type:"Tipo de material"},
    metrics:{available:"Disponible",reserved:"Reservado",blocked:"Bloqueado",lots:"Lotes"}
  },
  people:{
    label:"Personas",
    dimensions:{person:"Persona"},
    metrics:{session_hours:"Horas en sesiones ERP",sessions:"Sesiones ERP",tasks:"Tareas asignadas",completed_tasks:"Tareas completadas",work_hours:"Horas en actividades",paused_hours:"Horas en pausa"}
  },
  issues:{
    label:"Incidencias",
    dimensions:{type:"Tipo",source:"Origen",status:"Estado",resolution:"Resolución",day:"Día"},
    metrics:{count:"Incidencias",resolved:"Resueltas",avg_resolution_hours:"Resolución promedio (h)"}
  },
  approvals:{
    label:"Aprobaciones",
    dimensions:{type:"Tipo",status:"Estado",role:"Rol responsable",day:"Día"},
    metrics:{count:"Solicitudes",approved:"Aprobadas",avg_decision_hours:"Decisión promedio (h)"}
  }
};

let rootNode=null;
const state={
  from:"",
  to:"",
  tab:"executive",
  data:null,
  views:[],
  explorer:{dataset:"orders",dimension:"status",metric:"count",chart:"bar",limit:20,result:null}
};

function localIso(date=new Date()){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);
  const values=Object.fromEntries(parts.filter(p=>p.type!=="literal").map(p=>[p.type,p.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
function shiftIso(iso,days){
  const d=new Date(`${iso}T12:00:00-05:00`);
  d.setDate(d.getDate()+days);
  return localIso(d);
}
function startOfYear(iso){return `${iso.slice(0,4)}-01-01`}
function safe(value){return fmt.escape(String(value??"—"))}
function num(value){return Number(value||0)}
function pct(value){return value===null||value===undefined||Number.isNaN(Number(value))?"—":`${fmt.number(value,1)}%`}
function money(value){return new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(num(value))}
function hours(seconds){
  const value=num(seconds);
  if(value<=0)return "0 h";
  return value<3600?`${fmt.number(value/60,0)} min`:`${fmt.number(value/3600,1)} h`;
}
function metricValue(metric,value){
  if(["invoice_amount","amount","avg_amount","cost"].includes(metric))return money(value);
  if(metric.includes("hours"))return `${fmt.number(value,1)} h`;
  if(["count","closed","completed","delivered","lots","sessions","tasks","completed_tasks","resolved","approved"].includes(metric))return fmt.number(value,0);
  return fmt.number(value,2);
}
function pretty(value){
  return String(value??"Sin dato").replaceAll("_"," ").toLowerCase().replace(/(^|\s)\S/g,m=>m.toUpperCase());
}
function empty(text){return `<div class="bi-empty-v11140">${safe(text)}</div>`}

async function rpc(name,params={}){
  const {data,error}=await getSupabase().rpc(name,params);
  if(error)throw error;
  return data;
}

export async function renderReports(root){
  rootNode=root;
  const today=localIso();
  state.to=today;
  state.from=shiftIso(today,-29);
  state.tab="executive";
  state.data=null;
  state.explorer.result=null;

  root.innerHTML=`
    <section class="bi-v11140">
      <header class="bi-head-v11140">
        <div>
          <span class="bi-kicker-v11140">Intelligence Center · V11.14.0</span>
          <h2>Analítica y reportes</h2>
          <p>Centro de inteligencia operacional para analizar pedidos, tiempos, facturación, logística, inventario, personas, incidencias y calidad del dato desde una única capa de medición.</p>
        </div>
        <div class="bi-head-actions-v11140">
          <button class="btn btn-ghost" data-bi-export="xlsx">Excel completo</button>
          <button class="btn btn-ghost" data-bi-export="json">JSON</button>
          <button class="btn btn-ghost" data-bi-print>Imprimir / PDF</button>
          <button class="btn btn-help" data-bi-help>Metodología</button>
        </div>
      </header>
      <section class="bi-filterbar-v11140">
        <label>Desde<input class="control" type="date" data-bi-from value="${state.from}"></label>
        <label>Hasta<input class="control" type="date" data-bi-to value="${state.to}"></label>
        <div class="bi-presets-v11140">
          <button class="btn btn-ghost" data-bi-preset="7">7 días</button>
          <button class="btn btn-ghost" data-bi-preset="30">30 días</button>
          <button class="btn btn-ghost" data-bi-preset="90">90 días</button>
          <button class="btn btn-ghost" data-bi-preset="ytd">Año actual</button>
        </div>
        <button class="btn btn-primary" data-bi-refresh>Actualizar análisis</button>
        <span class="bi-toolbar-spacer-v11140"></span>
        <span class="bi-export-status-v11140">Comparación automática contra periodo anterior equivalente</span>
      </section>
      <nav class="bi-tabs-v11140">
        ${TABS.map(([id,label])=>`<button class="bi-tab-v11140 ${id===state.tab?"active":""}" data-bi-tab="${id}">${safe(label)}</button>`).join("")}
      </nav>
      <main class="bi-content-v11140" data-bi-content>
        <div class="bi-skeleton-v11140">${loading("Construyendo el centro de inteligencia…")}</div>
      </main>
    </section>`;

  bindShell();
  await Promise.all([loadDashboard(),loadViews()]);
}

function bindShell(){
  rootNode.querySelectorAll("[data-bi-tab]").forEach(button=>button.addEventListener("click",()=>{
    state.tab=button.dataset.biTab;
    rootNode.querySelectorAll("[data-bi-tab]").forEach(node=>node.classList.toggle("active",node===button));
    renderActive();
  }));

  rootNode.querySelector("[data-bi-refresh]")?.addEventListener("click",async()=>{
    state.from=rootNode.querySelector("[data-bi-from]").value;
    state.to=rootNode.querySelector("[data-bi-to]").value;
    state.explorer.result=null;
    await loadDashboard();
    if(state.tab==="explorer")await loadExplorer();
  });

  rootNode.querySelectorAll("[data-bi-preset]").forEach(button=>button.addEventListener("click",async()=>{
    const preset=button.dataset.biPreset;
    state.to=localIso();
    state.from=preset==="ytd"?startOfYear(state.to):shiftIso(state.to,-Number(preset)+1);
    rootNode.querySelector("[data-bi-from]").value=state.from;
    rootNode.querySelector("[data-bi-to]").value=state.to;
    state.explorer.result=null;
    await loadDashboard();
  }));

  rootNode.querySelectorAll("[data-bi-export]").forEach(button=>button.addEventListener("click",()=>{
    if(button.dataset.biExport==="xlsx")exportWorkbook();
    else exportJson();
  }));
  rootNode.querySelector("[data-bi-print]")?.addEventListener("click",()=>window.print());
  rootNode.querySelector("[data-bi-help]")?.addEventListener("click",()=>guide({
    title:"Cómo leer Analítica y reportes",
    description:"El módulo utiliza una capa semántica controlada sobre los datos operativos del CRM.",
    items:[
      {title:"Periodo comparable",detail:"Cada KPI se compara con un periodo anterior de igual duración."},
      {title:"Datos curados",detail:"El explorador solo expone dimensiones y métricas aprobadas; no ejecuta SQL escrito desde el navegador."},
      {title:"Detalle exportable",detail:"Los datasets admiten exportación detallada hasta 5.000 filas por consulta."},
      {title:"Calidad primero",detail:"Los indicadores de completitud y sesiones abiertas ayudan a interpretar correctamente los resultados."},
      {title:"Vistas guardadas",detail:"Puedes conservar configuraciones del Explorador BI y compartirlas dentro de la organización."}
    ]
  }));
}

async function loadDashboard(){
  const content=rootNode.querySelector("[data-bi-content]");
  content.innerHTML=`<div class="bi-skeleton-v11140">${loading("Calculando KPIs, tendencias, SLA, inventario y productividad…")}</div>`;
  try{
    state.data=await rpc("erp_x_reports_analytics",{p_from:state.from,p_to:state.to});
    renderActive();
  }catch(error){
    content.innerHTML=`<section class="bi-panel-v11140"><h3>No fue posible cargar la analítica</h3><p>${safe(error.message)}</p></section>`;
  }
}

async function loadViews(){
  try{
    state.views=await rpc("erp_x_reports_views",{p_action:"LIST",p_payload:{}})||[];
    if(state.tab==="saved")renderActive();
  }catch{
    state.views=[];
  }
}

function renderActive(){
  const content=rootNode?.querySelector("[data-bi-content]");
  if(!content||!state.data)return;
  const renderers={
    executive:renderExecutive,
    operation:renderOperation,
    commercial:renderCommercial,
    logistics:renderLogistics,
    people:renderPeople,
    explorer:renderExplorer,
    quality:renderQuality,
    saved:renderSaved
  };
  content.innerHTML=(renderers[state.tab]||renderExecutive)();
  bindActive();
}

function kpi(label,value,detail,current=null,previous=null,tone=""){
  return `<article class="bi-kpi-v11140 ${tone}">
    <small>${safe(label)}</small>
    <strong>${safe(value)}</strong>
    <div class="bi-kpi-foot-v11140"><span>${safe(detail)}</span>${current!==null&&previous!==null?delta(current,previous):""}</div>
  </article>`;
}

function delta(current,previous,invert=false){
  const cur=num(current),prev=num(previous);
  if(prev===0&&cur===0)return `<span class="bi-delta-v11140 flat">0%</span>`;
  if(prev===0)return `<span class="bi-delta-v11140 up">Nuevo</span>`;
  const change=(cur-prev)/Math.abs(prev)*100;
  const good=invert?change<0:change>0;
  const cls=Math.abs(change)<0.05?"flat":good?"up":"down";
  return `<span class="bi-delta-v11140 ${cls}">${change>0?"+":""}${fmt.number(change,1)}%</span>`;
}

function renderExecutive(){
  const summary=state.data.summary||{},previous=state.data.previous||{};
  return `<section class="bi-tab-section-v11140">
    <div class="bi-kpis-v11140">
      ${kpi("Pedidos creados",fmt.number(summary.orders),`${fmt.number(summary.activeOrders)} activos`,summary.orders,previous.orders)}
      ${kpi("Facturación",money(summary.invoiceAmount),`${fmt.number(summary.invoicedOrders)} pedidos facturados`,summary.invoiceAmount,previous.invoiceAmount,"good")}
      ${kpi("Pedidos cerrados",fmt.number(summary.closedOrders),`A tiempo: ${pct(summary.onTimePct)}`,summary.closedOrders,previous.closedOrders)}
      ${kpi("Ciclo promedio",hours(summary.avgCycleSeconds),`P90: ${hours(summary.p90CycleSeconds)}`,summary.avgCycleSeconds,previous.avgCycleSeconds,"warn")}
      ${kpi("Entregas",fmt.number(summary.delivered),`${fmt.number(summary.deliveries)} gestiones`,summary.delivered,previous.delivered,"good")}
      ${kpi("Costo logístico",money(summary.shippingCost),"Transportadoras y despachos",summary.shippingCost,previous.shippingCost,"warn")}
      ${kpi("Tareas completadas",fmt.number(summary.tasksCompleted),`${hours(summary.taskBusinessSeconds)} productivas`,summary.tasksCompleted,previous.tasksCompleted)}
      ${kpi("Incidencias",fmt.number(summary.issues),`${fmt.number(summary.blockingIssues)} bloqueantes`,summary.issues,previous.issues,summary.issues?"risk":"good")}
    </div>
    <div class="bi-grid-v11140">
      <article class="bi-panel-v11140">
        <header><div><h3>Tendencia operacional</h3><p>Pedidos creados y cerrados durante el periodo.</p></div><div class="bi-legend-v11140"><i></i>Creados<i class="secondary"></i>Cerrados</div></header>
        ${lineChart(state.data.trend||[],"ordersCreated","ordersClosed")}
      </article>
      <article class="bi-panel-v11140"><header><div><h3>Lectura ejecutiva</h3><p>Señales que requieren atención o seguimiento.</p></div></header>${insights()}</article>
    </div>
    <div class="bi-grid-3-v11140">
      ${barPanel("Distribución por estado",state.data.dimensions?.status,"Pedidos según estado actual")}
      ${barPanel("Etapas actuales",state.data.dimensions?.steps,"Carga visible por etapa")}
      ${barPanel("Ciudades",state.data.dimensions?.cities,"Concentración geográfica de pedidos")}
    </div>
  </section>`;
}

function insights(){
  const summary=state.data.summary||{},quality=state.data.quality||{},stages=state.data.stages||[];
  const slow=[...stages].sort((a,b)=>num(b.p90_seconds)-num(a.p90_seconds))[0];
  const items=[];
  if(num(quality.orderFieldCompletenessPct)<90)items.push(["Calidad de datos",`La completitud de campos clave está en ${pct(quality.orderFieldCompletenessPct)}. Conviene cerrar primero las brechas de captura.`]);
  if(num(quality.openTaskSessions)>0)items.push(["Sesiones abiertas",`${fmt.number(quality.openTaskSessions)} sesión(es) de tarea continúan abiertas y pueden distorsionar tiempos.`]);
  if(num(summary.pendingApprovals)>0)items.push(["Aprobaciones pendientes",`${fmt.number(summary.pendingApprovals)} solicitud(es) permanecen pendientes.`]);
  if(num(summary.blockingIssues)>0)items.push(["Bloqueos",`${fmt.number(summary.blockingIssues)} incidencia(s) bloqueante(s) fueron registradas en el periodo.`]);
  if(slow)items.push(["Etapa con mayor P90",`${slow.step_name||slow.step_code} presenta P90 de ${hours(slow.p90_seconds)}.`]);
  if(!items.length)items.push(["Sin alertas críticas","Los indicadores disponibles no muestran alertas fuertes para este periodo; valida siempre la cobertura de captura."]);
  return `<div class="bi-insights-v11140">${items.map(([title,text])=>`<div class="bi-insight-v11140"><strong>${safe(title)}</strong><p>${safe(text)}</p></div>`).join("")}</div>`;
}

function renderOperation(){
  const summary=state.data.summary||{};
  return `<section class="bi-tab-section-v11140">
    <div class="bi-kpis-v11140">
      ${kpi("Tareas",fmt.number(summary.tasks),`${fmt.number(summary.tasksCompleted)} completadas`)}
      ${kpi("Tiempo productivo",hours(summary.taskBusinessSeconds),"Tiempo de negocio registrado")}
      ${kpi("Sesiones ERP",fmt.number(summary.taskSessions),`${fmt.number(summary.openTaskSessions)} abiertas`,null,null,summary.openTaskSessions?"risk":"good")}
      ${kpi("Incidencias",fmt.number(summary.issues),`${fmt.number(summary.openIssues)} abiertas`,null,null,summary.openIssues?"risk":"good")}
    </div>
    <article class="bi-panel-v11140"><header><div><h3>Rendimiento por etapa</h3><p>Volumen, tiempos promedio, percentiles y espera antes de iniciar.</p></div></header>${stageTable(state.data.stages||[])}</article>
    <div class="bi-grid-2-v11140">
      <article class="bi-panel-v11140"><header><div><h3>Throughput</h3><p>Tareas completadas por periodo.</p></div></header>${lineChart(state.data.trend||[],"tasksCompleted",null)}</article>
      ${barPanel("Pareto de incidencias",state.data.causes?.issueType,"Tipos de problema registrados")}
    </div>
  </section>`;
}

function stageTable(rows){
  if(!rows.length)return empty("No hay etapas con actividad en el periodo.");
  return `<div class="bi-table-wrap-v11140"><table class="bi-table-v11140">
    <thead><tr><th>Etapa</th><th>Tareas</th><th>Completadas</th><th>Bloqueadas</th><th>Promedio</th><th>P50</th><th>P90</th><th>Espera prom.</th></tr></thead>
    <tbody>${rows.map(row=>`<tr>
      <td><strong>${safe(row.step_name)}</strong><small>${safe(row.step_code)}</small></td>
      <td>${fmt.number(row.tasks)}</td><td>${fmt.number(row.completed)}</td><td>${fmt.number(row.blocked)}</td>
      <td>${hours(row.avg_seconds)}</td><td>${hours(row.p50_seconds)}</td><td>${hours(row.p90_seconds)}</td><td>${hours(row.avg_wait_seconds)}</td>
    </tr>`).join("")}</tbody>
  </table></div>`;
}

function renderCommercial(){
  const summary=state.data.summary||{};
  return `<section class="bi-tab-section-v11140">
    <div class="bi-kpis-v11140">
      ${kpi("Facturas",fmt.number(summary.invoiceCount),`${fmt.number(summary.invoicedOrders)} pedidos`)}
      ${kpi("Valor facturado",money(summary.invoiceAmount),"Periodo seleccionado",null,null,"good")}
      ${kpi("Ticket promedio",money(summary.avgTicket),"Por pedido facturado")}
      ${kpi("Pedidos creados",fmt.number(summary.orders),`${fmt.number(summary.closedOrders)} cerrados`)}
    </div>
    <div class="bi-grid-2-v11140">
      ${barPanel("Asesores",state.data.dimensions?.sellers,"Pedidos registrados por asesor")}
      ${barPanel("Clientes",state.data.dimensions?.clients,"Clientes con mayor recurrencia")}
      ${barPanel("Tipos de pedido",state.data.dimensions?.types,"Mezcla de operación")}
      ${barPanel("Rutas de entrega",state.data.dimensions?.routes,"Preferencia de ruta comercial")}
    </div>
  </section>`;
}

function renderLogistics(){
  const summary=state.data.summary||{};
  return `<section class="bi-tab-section-v11140">
    <div class="bi-kpis-v11140">
      ${kpi("Entregas registradas",fmt.number(summary.deliveries),`${fmt.number(summary.delivered)} completadas`)}
      ${kpi("Costo de transporte",money(summary.shippingCost),"Costo capturado")}
      ${kpi("Inventario disponible",fmt.number(summary.inventoryAvailable,2),`${fmt.number(summary.inventorySkus)} referencias`,null,null,"good")}
      ${kpi("Inventario reservado",fmt.number(summary.inventoryReserved,2),`Bloqueado: ${fmt.number(summary.inventoryBlocked,2)}`,null,null,"warn")}
    </div>
    <article class="bi-panel-v11140"><header><div><h3>Desempeño logístico por ruta</h3><p>Entregas, cumplimiento, costo y tránsito observado.</p></div></header>${logisticsTable(state.data.logistics||[])}</article>
    <div class="bi-grid-v11140">
      <article class="bi-panel-v11140"><header><div><h3>Referencias con mayor disponibilidad</h3><p>Snapshot actual de inventario.</p></div></header>${inventoryTable(state.data.inventory||[])}</article>
      ${barPanel("Pedidos por ruta",state.data.dimensions?.routes,"Distribución de rutas en pedidos del periodo")}
    </div>
  </section>`;
}

function logisticsTable(rows){
  if(!rows.length)return empty("No hay entregas registradas en el periodo.");
  return `<div class="bi-table-wrap-v11140"><table class="bi-table-v11140">
    <thead><tr><th>Ruta</th><th>Gestiones</th><th>Entregadas</th><th>Cumplimiento</th><th>Costo</th><th>Tránsito prom.</th></tr></thead>
    <tbody>${rows.map(row=>`<tr><td><strong>${safe(pretty(row.route))}</strong></td><td>${fmt.number(row.deliveries)}</td><td>${fmt.number(row.delivered)}</td><td>${pct(num(row.deliveries)?num(row.delivered)/num(row.deliveries)*100:0)}</td><td>${money(row.carrier_cost)}</td><td>${hours(row.avg_transit_seconds)}</td></tr>`).join("")}</tbody>
  </table></div>`;
}

function inventoryTable(rows){
  if(!rows.length)return empty("No hay inventario disponible.");
  return `<div class="bi-table-wrap-v11140"><table class="bi-table-v11140">
    <thead><tr><th>Referencia</th><th>Descripción</th><th>Disponible</th><th>Reservado</th><th>Bloqueado</th><th>Lotes</th></tr></thead>
    <tbody>${rows.map(row=>`<tr><td><strong>${safe(row.reference)}</strong><small>${safe(row.unit)}</small></td><td>${safe(row.description)}</td><td>${fmt.number(row.available,2)}</td><td>${fmt.number(row.reserved,2)}</td><td>${fmt.number(row.blocked,2)}</td><td>${fmt.number(row.lots)}</td></tr>`).join("")}</tbody>
  </table></div>`;
}

function renderPeople(){
  const summary=state.data.summary||{},rows=state.data.people||[];
  return `<section class="bi-tab-section-v11140">
    <div class="bi-kpis-v11140">
      ${kpi("Personas activas",fmt.number(summary.activePeople),"Perfiles operativos")}
      ${kpi("Sesiones ERP",fmt.number(summary.taskSessions),hours(summary.sessionBusinessSeconds))}
      ${kpi("Actividades",fmt.number(summary.workExecutions),hours(summary.workActiveSeconds))}
      ${kpi("Pausas registradas",hours(summary.workPausedSeconds),"Dentro de actividades")}
    </div>
    <article class="bi-panel-v11140"><header><div><h3>Actividad por persona</h3><p>Sesiones, tareas y actividades capturadas. La ausencia de registro no equivale automáticamente a inactividad.</p></div></header>${peopleTable(rows)}</article>
    <div class="bi-data-note-v11140"><strong>Interpretación:</strong> esta vista mide actividad registrada en el ERP y en Jornada y actividades. Para evaluación individual debe analizarse junto con la cobertura de captura y el contexto operativo.</div>
  </section>`;
}

function peopleTable(rows){
  if(!rows.length)return empty("No hay perfiles para analizar.");
  return `<div class="bi-table-wrap-v11140"><table class="bi-table-v11140">
    <thead><tr><th>Persona</th><th>Sesiones</th><th>Tiempo sesiones</th><th>Tareas</th><th>Completadas</th><th>Actividades</th><th>Tiempo actividades</th><th>Pausas</th></tr></thead>
    <tbody>${rows.map(row=>`<tr><td><strong>${safe(row.profile_name)}</strong></td><td>${fmt.number(row.sessions)}</td><td>${hours(row.session_seconds)}</td><td>${fmt.number(row.tasks)}</td><td>${fmt.number(row.tasks_completed)}</td><td>${fmt.number(row.work_executions)}</td><td>${hours(row.work_active_seconds)}</td><td>${hours(row.work_paused_seconds)}</td></tr>`).join("")}</tbody>
  </table></div>`;
}

function renderQuality(){
  const quality=state.data.quality||{};
  const values=[
    ["Completitud general",quality.orderFieldCompletenessPct],
    ["Documento cliente",quality.clientDocumentPct],
    ["Ciudad",quality.clientCityPct],
    ["Dirección",quality.clientAddressPct],
    ["Promesa/fecha requerida",quality.promisePct],
    ["Valor de factura",quality.invoiceAmountPct],
    ["Trazabilidad de entrega",quality.deliveryTrackingPct]
  ];
  const valid=values.map(([,value])=>num(value)).filter(Number.isFinite);
  const score=valid.length?valid.reduce((sum,value)=>sum+value,0)/valid.length:0;
  return `<section class="bi-tab-section-v11140">
    <div class="bi-grid-v11140">
      <article class="bi-panel-v11140">
        <header><div><h3>Índice de calidad de información</h3><p>Completitud de campos relevantes para análisis y trazabilidad.</p></div></header>
        <div class="bi-ring-layout-v11140">
          <div class="bi-ring-v11140" style="--value:${Math.max(0,Math.min(100,score))}"><div><strong>${pct(score)}</strong><span>calidad promedio</span></div></div>
          <div class="bi-quality-list-v11140">${values.map(([label,value])=>qualityRow(label,value)).join("")}</div>
        </div>
      </article>
      <article class="bi-panel-v11140">
        <header><div><h3>Excepciones de captura</h3><p>Registros que deben revisarse para mantener KPIs confiables.</p></div></header>
        <div class="bi-insights-v11140">
          ${exceptionCard("Sesiones de tarea abiertas",quality.openTaskSessions)}
          ${exceptionCard("Actividades abiertas",quality.openWorkExecutions)}
          ${exceptionCard("Pedidos sin líneas",quality.ordersWithoutItems)}
          ${exceptionCard("Pedidos sin tareas",quality.ordersWithoutTasks)}
        </div>
      </article>
    </div>
    <div class="bi-data-note-v11140">Un KPI con baja completitud debe interpretarse como una señal de captura insuficiente. El tablero separa la calidad del dato del desempeño para evitar conclusiones incorrectas.</div>
  </section>`;
}

function qualityRow(label,value){
  const n=num(value);
  return `<div class="bi-quality-row-v11140"><span>${safe(label)}</span><span class="track"><i style="width:${Math.max(0,Math.min(100,n))}%"></i></span><b>${pct(n)}</b></div>`;
}
function exceptionCard(label,value){
  const n=num(value);
  return `<div class="bi-insight-v11140"><strong>${safe(label)}</strong><p><span class="${n?"bi-number-risk":"bi-number-good"}">${fmt.number(n)}</span> registro(s).</p></div>`;
}

function renderExplorer(){
  const explorer=state.explorer,meta=DATASETS[explorer.dataset];
  return `<section class="bi-explorer-v11140">
    <aside class="bi-panel-v11140 bi-builder-v11140">
      <header><div><h3>Constructor de análisis</h3><p>Selecciona dataset, dimensión y métrica.</p></div></header>
      <label>Dataset<select class="control" data-exp-dataset>${Object.entries(DATASETS).map(([key,value])=>`<option value="${key}" ${key===explorer.dataset?"selected":""}>${safe(value.label)}</option>`).join("")}</select></label>
      <label>Dimensión<select class="control" data-exp-dimension>${Object.entries(meta.dimensions).map(([key,value])=>`<option value="${key}" ${key===explorer.dimension?"selected":""}>${safe(value)}</option>`).join("")}</select></label>
      <label>Métrica<select class="control" data-exp-metric>${Object.entries(meta.metrics).map(([key,value])=>`<option value="${key}" ${key===explorer.metric?"selected":""}>${safe(value)}</option>`).join("")}</select></label>
      <label>Máximo de categorías<select class="control" data-exp-limit>${[10,20,50,100].map(value=>`<option value="${value}" ${value===explorer.limit?"selected":""}>${value}</option>`).join("")}</select></label>
      <div class="bi-chart-switch-v11140">
        <button data-exp-chart="bar" class="${explorer.chart==="bar"?"active":""}">Barras</button>
        <button data-exp-chart="line" class="${explorer.chart==="line"?"active":""}">Línea</button>
        <button data-exp-chart="table" class="${explorer.chart==="table"?"active":""}">Tabla</button>
      </div>
      <div class="bi-builder-actions-v11140"><button class="btn btn-primary" data-exp-run>Analizar</button><button class="btn btn-ghost" data-exp-save>Guardar vista</button></div>
      <div class="bi-builder-actions-v11140"><button class="btn btn-ghost" data-exp-detail="xlsx">Detalle XLSX</button><button class="btn btn-ghost" data-exp-detail="csv">Detalle CSV</button></div>
      <div class="bi-data-note-v11140">El detalle se obtiene desde el servidor con un máximo de 5.000 filas por consulta. No se exponen tablas ni SQL arbitrario.</div>
    </aside>
    <article class="bi-panel-v11140 bi-explorer-result-v11140">
      <header><div><h3>${safe(meta.label)} · ${safe(meta.metrics[explorer.metric])}</h3><p>Agrupado por ${safe(meta.dimensions[explorer.dimension])} · ${state.from} → ${state.to}</p></div><span class="bi-chip-v11140">${explorer.result?.rows?.length||0} categorías</span></header>
      <div data-exp-result>${explorer.result?renderExplorerResult():empty("Configura el análisis y pulsa Analizar.")}</div>
    </article>
  </section>`;
}

async function loadExplorer(){
  const explorer=state.explorer;
  const box=rootNode.querySelector("[data-exp-result]");
  if(box)box.innerHTML=loading("Analizando dataset…");
  try{
    explorer.result=await rpc("erp_x_reports_explore",{p_payload:{dataset:explorer.dataset,dimension:explorer.dimension,metric:explorer.metric,from:state.from,to:state.to,limit:explorer.limit}});
    if(box)box.innerHTML=renderExplorerResult();
  }catch(error){
    if(box)box.innerHTML=empty(error.message);
  }
}

function renderExplorerResult(){
  const explorer=state.explorer,rows=explorer.result?.rows||[];
  if(!rows.length)return empty("No hay registros para esta combinación.");
  if(explorer.chart==="table")return genericTable(rows,[["label","Categoría"],["value",DATASETS[explorer.dataset].metrics[explorer.metric]],["records","Registros"]],explorer.metric);
  if(explorer.chart==="line")return explorerLine(rows);
  return bars(rows,explorer.metric);
}

function renderSaved(){
  const rows=state.views||[];
  return `<section class="bi-tab-section-v11140"><article class="bi-panel-v11140">
    <header><div><h3>Vistas guardadas</h3><p>Configuraciones propias y vistas compartidas del Explorador BI.</p></div><span>${fmt.number(rows.length)} vista(s)</span></header>
    ${rows.length?`<div class="bi-view-list-v11140">${rows.map(view=>`<article class="bi-view-card-v11140">
      <h4>${safe(view.name)}</h4><p>${safe(view.description||"Vista de análisis guardada")}</p>
      <div class="bi-view-meta-v11140"><span>${view.isShared?"Compartida":"Privada"}</span><span>${safe(view.ownerName)}</span></div>
      <div class="bi-view-actions-v11140"><button class="btn btn-primary" data-view-open="${safe(view.id)}">Abrir</button>${view.canEdit?`<button class="btn btn-ghost" data-view-delete="${safe(view.id)}">Eliminar</button>`:""}</div>
    </article>`).join("")}</div>`:empty("Todavía no hay vistas guardadas. Crea una desde Explorador BI.")}
  </article></section>`;
}

function bindActive(){
  if(state.tab==="explorer"){
    const dataset=rootNode.querySelector("[data-exp-dataset]");
    dataset?.addEventListener("change",()=>{
      state.explorer.dataset=dataset.value;
      const meta=DATASETS[dataset.value];
      state.explorer.dimension=Object.keys(meta.dimensions)[0];
      state.explorer.metric=Object.keys(meta.metrics)[0];
      state.explorer.result=null;
      renderActive();
    });
    rootNode.querySelector("[data-exp-dimension]")?.addEventListener("change",event=>state.explorer.dimension=event.target.value);
    rootNode.querySelector("[data-exp-metric]")?.addEventListener("change",event=>state.explorer.metric=event.target.value);
    rootNode.querySelector("[data-exp-limit]")?.addEventListener("change",event=>state.explorer.limit=Number(event.target.value));
    rootNode.querySelectorAll("[data-exp-chart]").forEach(button=>button.addEventListener("click",()=>{
      state.explorer.chart=button.dataset.expChart;
      rootNode.querySelectorAll("[data-exp-chart]").forEach(node=>node.classList.toggle("active",node===button));
      if(state.explorer.result)rootNode.querySelector("[data-exp-result]").innerHTML=renderExplorerResult();
    }));
    rootNode.querySelector("[data-exp-run]")?.addEventListener("click",loadExplorer);
    rootNode.querySelector("[data-exp-save]")?.addEventListener("click",openSaveModal);
    rootNode.querySelectorAll("[data-exp-detail]").forEach(button=>button.addEventListener("click",()=>exportDetail(button.dataset.expDetail)));
    if(!state.explorer.result)loadExplorer();
  }

  if(state.tab==="saved"){
    rootNode.querySelectorAll("[data-view-open]").forEach(button=>button.addEventListener("click",()=>openSaved(button.dataset.viewOpen)));
    rootNode.querySelectorAll("[data-view-delete]").forEach(button=>button.addEventListener("click",()=>deleteView(button.dataset.viewDelete)));
  }
}

function barPanel(title,rows=[],subtitle=""){
  return `<article class="bi-panel-v11140"><header><div><h3>${safe(title)}</h3><p>${safe(subtitle)}</p></div><span>${fmt.number(rows?.length||0)}</span></header>${bars(rows||[],"count")}</article>`;
}

function bars(rows=[],metric="count"){
  if(!rows.length)return empty("Sin datos para este criterio.");
  const max=Math.max(1,...rows.map(row=>num(row.value)));
  return `<div class="bi-bar-list-v11140">${rows.map((row,index)=>`<div class="bi-bar-row-v11140">
    <div class="label"><strong>${index+1}. ${safe(pretty(row.label))}</strong><small>${row.records!==undefined?`${fmt.number(row.records)} registro(s)`:""}</small></div>
    <span class="bi-bar-track-v11140"><i style="width:${Math.max(2,num(row.value)/max*100)}%"></i></span>
    <b>${safe(metricValue(metric,row.value))}</b>
  </div>`).join("")}</div>`;
}

function lineChart(rows,key1,key2){
  if(!rows.length)return empty("No hay serie temporal.");
  const width=Math.max(720,rows.length*32),height=245,pad={left:42,right:20,top:18,bottom:36};
  const values=rows.flatMap(row=>[num(row[key1]),key2?num(row[key2]):0]);
  const max=Math.max(1,...values);
  const x=index=>pad.left+(rows.length===1?0:index*(width-pad.left-pad.right)/(rows.length-1));
  const y=value=>pad.top+(max-num(value))*(height-pad.top-pad.bottom)/max;
  const path=key=>rows.map((row,index)=>`${index?"L":"M"}${x(index).toFixed(1)},${y(row[key]).toFixed(1)}`).join(" ");
  const labelStep=Math.max(1,Math.ceil(rows.length/9));
  return `<div class="bi-chart-scroll-v11140"><svg class="bi-line-v11140" viewBox="0 0 ${width} ${height}" role="img" aria-label="Serie temporal">
    <g class="grid">${[0,.25,.5,.75,1].map(factor=>`<line x1="${pad.left}" y1="${y(max*factor)}" x2="${width-pad.right}" y2="${y(max*factor)}"></line><text x="${pad.left-7}" y="${y(max*factor)+3}" text-anchor="end">${fmt.number(max*factor,0)}</text>`).join("")}</g>
    <path class="primary" d="${path(key1)}"></path>
    ${key2?`<path class="secondary" d="${path(key2)}"></path>`:""}
    <g class="labels">${rows.map((row,index)=>index%labelStep===0?`<text x="${x(index)}" y="${height-11}" text-anchor="middle">${safe(String(row.periodStart||"").slice(5))}</text>`:"").join("")}</g>
  </svg></div>`;
}

function explorerLine(rows){
  return lineChart(rows.map(row=>({periodStart:row.label,value:num(row.value)})),"value",null);
}

function genericTable(rows,columns,metric){
  return `<div class="bi-table-wrap-v11140"><table class="bi-table-v11140"><thead><tr>${columns.map(([,label])=>`<th>${safe(label)}</th>`).join("")}</tr></thead><tbody>${rows.map(row=>`<tr>${columns.map(([key])=>`<td>${key==="value"?safe(metricValue(metric,row[key])):safe(row[key])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

async function exportDetail(format){
  const explorer=state.explorer;
  try{
    toast("Preparando exportación detallada…","info",3000);
    const data=await rpc("erp_x_reports_export",{p_payload:{dataset:explorer.dataset,from:state.from,to:state.to,limit:5000}});
    const rows=data?.rows||[];
    if(!rows.length){toast("No hay filas para exportar.","error");return}
    if(format==="xlsx")downloadXlsx({[DATASETS[explorer.dataset].label]:rows},`CRM_${explorer.dataset}_${state.from}_${state.to}.xlsx`);
    else downloadCsv(rows,`CRM_${explorer.dataset}_${state.from}_${state.to}.csv`);
    toast(`${fmt.number(rows.length)} fila(s) exportadas.`);
  }catch(error){toast(error.message,"error",7000)}
}

function exportWorkbook(){
  if(!state.data)return;
  const data=state.data,summary=data.summary||{};
  const sheets={
    Resumen:Object.entries(summary).map(([Indicador,Valor])=>({Indicador,Valor})),
    Tendencia:data.trend||[],
    Etapas:data.stages||[],
    Logistica:data.logistics||[],
    Inventario:data.inventory||[],
    Personas:data.people||[],
    Calidad:[data.quality||{}],
    Estados:data.dimensions?.status||[],
    Rutas:data.dimensions?.routes||[],
    Ciudades:data.dimensions?.cities||[],
    Asesores:data.dimensions?.sellers||[],
    Clientes:data.dimensions?.clients||[]
  };
  downloadXlsx(sheets,`CRM_Analitica_${state.from}_${state.to}.xlsx`);
}

function downloadXlsx(sheets,name){
  if(!window.XLSX){toast("El motor Excel aún no está disponible.","error");return}
  const workbook=window.XLSX.utils.book_new();
  Object.entries(sheets).forEach(([sheetName,rows])=>window.XLSX.utils.book_append_sheet(workbook,window.XLSX.utils.json_to_sheet(rows||[]),sheetName.slice(0,31)));
  window.XLSX.writeFile(workbook,name,{compression:true});
}

function downloadCsv(rows,name){
  const headers=[...new Set(rows.flatMap(row=>Object.keys(row||{})))];
  const csv=[headers,...rows.map(row=>headers.map(header=>row?.[header]))]
    .map(row=>row.map(value=>`"${String(typeof value==="object"&&value!==null?JSON.stringify(value):value??"").replaceAll('"','""')}"`).join(","))
    .join("\n");
  downloadBlob(csv,"text/csv;charset=utf-8",name);
}

function exportJson(){
  downloadBlob(JSON.stringify({generatedAt:new Date().toISOString(),range:{from:state.from,to:state.to},dashboard:state.data,explorer:state.explorer.result},null,2),"application/json",`CRM_Analitica_${state.from}_${state.to}.json`);
}

function downloadBlob(content,type,name){
  const link=document.createElement("a");
  link.href=URL.createObjectURL(new Blob([content],{type}));
  link.download=name;
  link.click();
  setTimeout(()=>URL.revokeObjectURL(link.href),0);
}

function openSaveModal(){
  const explorer=state.explorer;
  const host=document.createElement("div");
  host.className="bi-modal-backdrop-v11140";
  host.innerHTML=`<form class="bi-modal-v11140">
    <h3>Guardar vista</h3><p>Conserva esta combinación de dataset, dimensión, métrica y visualización.</p>
    <label>Nombre<input class="control" name="name" required maxlength="80"></label>
    <label>Descripción<textarea class="control" name="description" rows="3" maxlength="240"></textarea></label>
    <label><span><input type="checkbox" name="shared"> Compartir con otros usuarios que tengan acceso a Reportes</span></label>
    <div class="bi-modal-actions-v11140"><button type="button" class="btn btn-ghost" data-cancel>Cancelar</button><button class="btn btn-primary">Guardar</button></div>
  </form>`;
  document.body.append(host);
  host.querySelector("[data-cancel]").onclick=()=>host.remove();
  host.querySelector("form").onsubmit=async event=>{
    event.preventDefault();
    const form=event.currentTarget;
    try{
      await rpc("erp_x_reports_views",{p_action:"SAVE",p_payload:{name:form.name.value.trim(),description:form.description.value.trim(),isShared:form.shared.checked,config:{...explorer,from:state.from,to:state.to,result:null}}});
      host.remove();
      await loadViews();
      toast("Vista guardada.");
    }catch(error){toast(error.message,"error",7000)}
  };
}

function openSaved(id){
  const view=state.views.find(item=>item.id===id);
  if(!view)return;
  const config=view.config||{};
  state.explorer={...state.explorer,...config,result:null};
  if(config.from&&config.to){
    state.from=config.from;state.to=config.to;
    rootNode.querySelector("[data-bi-from]").value=state.from;
    rootNode.querySelector("[data-bi-to]").value=state.to;
  }
  state.tab="explorer";
  rootNode.querySelectorAll("[data-bi-tab]").forEach(node=>node.classList.toggle("active",node.dataset.biTab==="explorer"));
  renderActive();
}

async function deleteView(id){
  if(!confirm("¿Eliminar esta vista guardada?"))return;
  try{
    await rpc("erp_x_reports_views",{p_action:"DELETE",p_payload:{id}});
    await loadViews();
    renderActive();
    toast("Vista eliminada.");
  }catch(error){toast(error.message,"error",7000)}
}
