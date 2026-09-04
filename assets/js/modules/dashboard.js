import {api} from "../services/api.js";
import {fmt,statusBadge} from "../core/format.js";
import {empty,actionCards,guide} from "../core/ui.js";
import {workspaceIntro} from "../core/guided.js";
import {icon} from "../core/icons.js";
import {navigate} from "../core/router.js";
import {state,can} from "../core/state.js";

export async function renderDashboard(root){
  const today=new Date();
  const to=today.toISOString().slice(0,10);
  const from=new Date(Date.now()-30*864e5).toISOString().slice(0,10);
  const [data,partialData,exceptionData]=await Promise.all([api.dashboard(),api.partialFulfillmentMetrics(from,to),api.exceptionSummary().catch(()=>({}))]);
  const k=data.kpis||{};
  const queues=data.queues||[];
  const recent=data.recent||[];
  const partialSummary=partialData.summary||{};
  const partialOrders=partialData.orders||[];
  const cards=[];
  if(can("sales","canCreate")||can("orders","canCreate"))cards.push({id:"guide-new-order",title:"Crear un pedido",description:"Registra únicamente la información necesaria y valida el pedido antes de crearlo.",icon:icon("plus","dashboard-action-svg"),tone:"accent"});
  if(state.modules.some(m=>["cartera","caja","purchasing","receiving","picking","cutting","billing","shipping"].includes(m.code)&&m.canRead))cards.push({id:"guide-my-work",title:"Ver mis tareas",description:"Abre los pedidos asignados a tu usuario y continúa la etapa correspondiente.",icon:icon("check","dashboard-action-svg"),tone:"primary"});
  if(can("approvals","canRead"))cards.push({id:"guide-approvals",title:"Centro de excepciones",description:"Atiende Novedades, Reportes, Aprobaciones y alertas SLA desde una sola bandeja.",icon:icon("approvals","dashboard-action-svg"),tone:"warning"});
  if(can("orders","canRead"))cards.push({id:"guide-orders",title:"Buscar un pedido",description:"Encuentra rápidamente un pedido por número, cliente, etapa o estado.",icon:icon("search","dashboard-action-svg")});

  root.innerHTML=`<div class="dashboard-v1185">
    <section class="page-head dashboard-page-head"><div><h2>Estado de la operación</h2><p>Indicadores, cargas, excepciones y actividad reciente en una sola vista.</p></div></section>
    ${workspaceIntro({title:`Hola, ${state.profile?.name?.split(" ")[0]||"bienvenido"}`,description:"Accede a las funciones prioritarias habilitadas para tu rol y continúa la operación desde un único punto.",cards:actionCards(cards)})}
    <section class="grid grid-kpi">
      ${kpi("Pedidos activos",k.activeOrders,"Actualmente en proceso","orders")}
      ${kpi("Mis tareas",k.myTasks,"Asignadas a tu usuario","check")}
      ${kpi("Pedidos parciales",partialSummary.partialPending||0,"Con mercancía pendiente","picking","warning")}
      ${kpi("Pedidos bloqueados",k.blocked,"Necesitan intervención","approvals","warning")}
      ${kpi("Excepciones escaladas",exceptionData.escalated||0,exceptionData.critical?`${exceptionData.critical} crítica(s) por SLA`:"SLA bajo control","audit",exceptionData.critical?"danger":exceptionData.escalated?"warning":"success")}
      ${kpi("Prioridad alta",k.critical,"Urgentes o críticos","activity","danger")}
      ${kpi("Cerrados hoy",k.closedToday,"Entregas finalizadas","check","success")}
      ${kpi("Decisiones pendientes",exceptionData.pendingApprovals??k.pendingApprovals,"Solicitudes por revisar","approvals")}
    </section>
    ${partialOrders.length?`<div class="section-gap"></div><section class="card partial-time-card"><header class="card-head"><div><h3>Pedidos parciales: tiempo parcial y tiempo real</h3><p class="muted">Cada fila corresponde al mismo pedido; no se crean pedidos duplicados.</p></div></header><div class="card-body">${partialTimesTable(partialOrders.slice(0,8))}</div></section>`:""}
    <div class="section-gap"></div>
    <section class="card dashboard-queue-section"><header class="card-head"><h3>Carga de trabajo por etapa</h3><span class="muted">Actualizado ${fmt.date(data.generatedAt)}</span></header><div class="card-body"><div class="queue-grid">${queues.map(queueCard).join("")}</div></div></section>
    <div class="section-gap"></div>
    <section class="grid grid-2 dashboard-bottom-grid">
      <article class="card"><header class="card-head"><h3>Pedidos actualizados recientemente</h3><button class="btn btn-ghost" id="all-orders">Ver todos</button></header><div class="card-body">${recent.length?recentTable(recent):empty()}</div></article>
      <article class="card"><header class="card-head"><h3>Principios de operación</h3></header><div class="card-body"><div class="timeline">${principle("Selecciona una tarea","Ubica el pedido o tarea correspondiente y abre su etapa activa.")}${principle("Completa la etapa activa","Registra la información solicitada y valida los datos antes de avanzar.")}${principle("Revisa antes de confirmar","La última pantalla resume lo que se guardará para evitar errores.")}${principle("Consulta la trazabilidad","Cada decisión, tiempo y documento queda dentro del expediente del pedido.")}</div><button class="btn btn-ghost" id="dashboard-help">Ver guía operativa</button></div></article>
    </section>
  </div>`;

  root.querySelector("#guide-new-order")?.addEventListener("click",()=>navigate("sales",{create:"1"}));
  root.querySelector("#guide-my-work")?.addEventListener("click",()=>navigate("orders",{assignment:"MINE",history:"0"}));
  root.querySelector("#guide-approvals")?.addEventListener("click",()=>navigate("approvals"));
  root.querySelector("#guide-orders")?.addEventListener("click",()=>navigate("orders"));
  root.querySelector("#all-orders").onclick=()=>navigate("orders");
  root.querySelector("#dashboard-help").onclick=()=>guide({title:"Guía operativa del ERP",description:"La operación sigue el mismo patrón en todos los módulos.",items:[{title:"Elige una opción",detail:"Las acciones disponibles corresponden a los permisos asignados a tu rol."},{title:"Selecciona un pedido",detail:"Las tarjetas de pedidos muestran cliente, etapa, prioridad y responsable."},{title:"Completa pasos cortos",detail:"Cada proceso presenta solo los campos requeridos para la etapa actual."},{title:"Confirma la información",detail:"Antes de guardar verás un resumen completo."}]});
  root.querySelectorAll("[data-step]").forEach(element=>element.onclick=()=>navigate("orders",{step:element.dataset.step,history:"0"}));
  root.querySelectorAll("[data-order]").forEach(element=>element.onclick=()=>window.dispatchEvent(new CustomEvent("erp:open-order",{detail:element.dataset.order})));
}

function kpi(label,value,foot,iconName="dashboard",tone=""){
  return `<article class="card kpi dashboard-kpi ${tone?`tone-${tone}`:""}"><div class="dashboard-kpi-head"><span class="dashboard-kpi-figure">${icon(iconName)}</span><div class="kpi-label">${fmt.escape(label)}</div></div><div class="kpi-value ${tone}">${fmt.number(value)}</div><div class="kpi-foot">${fmt.escape(foot)}</div></article>`;
}

function queueIcon(stepCode=""){
  const code=String(stepCode||"").toUpperCase();
  if(code.includes("CARTERA"))return "wallet";
  if(code.includes("CAJA"))return "cash";
  if(code.includes("COMPRA"))return "purchasing";
  if(code.includes("RECEPCION"))return "receiving";
  if(code.includes("ALISTAMIENTO"))return "picking";
  if(code.includes("CORTE"))return "cutting";
  if(code.includes("FACTURACION"))return "billing";
  if(code.includes("DISPATCH")||code.includes("CLIENT_")||code.includes("CLOSURE"))return "shipping";
  return "activity";
}

function queueCard(q){
  const total=Number(q.quantity||0),overdue=Number(q.overdue||0);
  return `<article class="queue-card dashboard-queue-card" data-step="${fmt.escape(q.stepCode)}"><div class="queue-top"><span class="dashboard-queue-title"><span class="dashboard-queue-figure">${icon(queueIcon(q.stepCode),"dashboard-queue-svg")}</span><span class="queue-name">${fmt.escape(fmt.step(q.name||q.stepCode))}</span></span>${overdue?`<span class="badge badge-red"><span class="badge-dot"></span>${overdue} fuera de plazo</span>`:""}</div><div class="queue-number">${fmt.number(total)}</div><div class="progress"><span style="width:${Math.min(100,total?Number(q.inProgress||0)/total*100:0)}%"></span></div><div class="queue-meta"><span>${fmt.number(q.inProgress)} en proceso</span><span>${fmt.number(q.waiting)} en espera</span></div></article>`;
}

function recentTable(rows){return `<div class="table-wrap mobile-card-table"><table><thead><tr><th>Pedido</th><th>Cliente</th><th>Etapa actual</th><th>Estado</th></tr></thead><tbody>${rows.map(row=>`<tr><td data-label="Pedido"><span class="table-link" data-order="${row.id}">${fmt.escape(row.orderNumber)}</span><div class="cell-sub">${fmt.escape(fmt.label(row.orderType))}</div></td><td data-label="Cliente">${fmt.escape(row.clientName)}</td><td data-label="Etapa actual">${fmt.escape(fmt.step(row.currentStep))}</td><td data-label="Estado">${statusBadge(row.status)}</td></tr>`).join("")}</tbody></table></div>`}
function principle(title,text){return `<div class="timeline-item"><h4>${title}</h4><p>${text}</p></div>`}

function partialTimesTable(rows){return `<div class="table-wrap mobile-card-table"><table><thead><tr><th>Pedido</th><th>Cliente</th><th>Rondas</th><th>Tiempo parcial</th><th>Tiempo real</th><th>Pendientes</th><th>Estado</th></tr></thead><tbody>${rows.map(row=>`<tr><td data-label="Pedido"><span class="table-link" data-order="${fmt.escape(row.id)}">${fmt.escape(row.orderNumber)}</span></td><td data-label="Cliente">${fmt.escape(row.clientName)}</td><td data-label="Rondas">${fmt.number(row.roundCount)}</td><td data-label="Tiempo parcial">${fmt.number(row.partialHours,2)} h</td><td data-label="Tiempo real">${fmt.number(row.realHours,2)} h</td><td data-label="Pendientes">${fmt.number(row.pendingItemCount)}</td><td data-label="Estado"><span class="order-partial-tag">${row.status==="COMPLETE"?"Completado":"Pedido parcial"}</span></td></tr>`).join("")}</tbody></table></div>`}
