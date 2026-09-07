import {api} from "../services/api.js";
import {fmt,priorityBadge,statusBadge} from "../core/format.js";
import {loading,empty,toast,guide} from "../core/ui.js";

/* CRM Suministros · Flujo y tiempos V11.12.0
   Mapa VSM operacional: lead time, toque, espera, WIP, aging, SLA y trazabilidad. */

const DAY_MS=864e5;
const clamp=(value,min=0,max=100)=>Math.max(min,Math.min(max,Number(value||0)));
const num=value=>Number(value||0);
const isoDay=date=>date.toISOString().slice(0,10);
const daysBefore=(days,base=new Date())=>isoDay(new Date(base.getTime()-days*DAY_MS));
const hoursLabel=value=>{
  const n=num(value);
  if(!Number.isFinite(n)||n<=0)return "0 h";
  if(n<1)return `${fmt.number(n*60,0)} min`;
  return `${fmt.number(n,1)} h`;
};
const pctLabel=value=>`${fmt.number(value,1)}%`;
const csvEscape=value=>`"${String(value??"").replaceAll('"','""')}"`;

export async function renderVsm(root){
  const today=new Date();
  const to=isoDay(today);
  const initialFrom=daysBefore(29,today);
  let lastData=null;
  let lastPartial={orders:[]};

  root.innerHTML=`
    <section class="page-head flow-page-head-v11120">
      <div>
        <span class="flow-kicker-v11120">Control de flujo · VSM</span>
        <h2>Flujo y tiempos de la operación</h2>
        <p>Ve el recorrido completo del pedido, dónde trabaja realmente la operación, dónde espera y qué etapa está frenando el flujo.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-ghost" id="flow-help-v11120">Cómo leerlo</button>
        <button class="btn btn-primary" id="flow-export-v11120" disabled>Exportar análisis</button>
      </div>
    </section>

    <section class="flow-control-v11120" aria-label="Periodo de análisis">
      <div class="flow-presets-v11120" role="group" aria-label="Periodos rápidos">
        <button class="flow-preset-v11120" data-flow-preset="7">7 días</button>
        <button class="flow-preset-v11120 active" data-flow-preset="30">30 días</button>
        <button class="flow-preset-v11120" data-flow-preset="90">90 días</button>
      </div>
      <div class="flow-date-range-v11120">
        <label><span>Desde</span><input class="control" id="flow-from-v11120" type="date" value="${initialFrom}"></label>
        <span class="flow-date-arrow-v11120" aria-hidden="true">→</span>
        <label><span>Hasta</span><input class="control" id="flow-to-v11120" type="date" value="${to}"></label>
        <button class="btn btn-primary" id="flow-run-v11120">Actualizar</button>
      </div>
    </section>

    <div id="vsm-result">${loading("Construyendo el mapa real del flujo…")}</div>`;

  const fromInput=root.querySelector("#flow-from-v11120");
  const toInput=root.querySelector("#flow-to-v11120");
  const exportButton=root.querySelector("#flow-export-v11120");

  const markPreset=value=>{
    root.querySelectorAll("[data-flow-preset]").forEach(button=>button.classList.toggle("active",button.dataset.flowPreset===value));
  };

  const load=async(from=fromInput.value,toValue=toInput.value)=>{
    if(!from||!toValue)return toast("Selecciona fecha inicial y final.","error");
    if(from>toValue)return toast("La fecha inicial no puede ser posterior a la final.","error");
    const span=Math.round((new Date(`${toValue}T00:00:00`)-new Date(`${from}T00:00:00`))/DAY_MS);
    if(span>366)return toast("El análisis admite un máximo de 367 días por consulta.","error");

    const target=root.querySelector("#vsm-result");
    target.innerHTML=loading("Calculando lead time, toque, espera, WIP, SLA y percentiles…");
    exportButton.disabled=true;

    const [vsmResult,partialResult]=await Promise.allSettled([
      api.vsm(from,toValue),
      api.partialFulfillmentMetrics(from,toValue)
    ]);

    if(vsmResult.status==="rejected"){
      target.innerHTML=`<section class="card card-pad module-error"><strong>No fue posible calcular el flujo</strong><p>${fmt.escape(vsmResult.reason?.message||"Error de consulta")}</p></section>`;
      throw vsmResult.reason;
    }

    lastData=vsmResult.value||{};
    lastPartial=partialResult.status==="fulfilled"?(partialResult.value||{orders:[]}):{orders:[]};
    target.innerHTML=renderFlow(lastData,lastPartial);
    bindFlowInteractions(root);
    exportButton.disabled=false;

    if(partialResult.status==="rejected"){
      const note=target.querySelector("[data-partial-health]");
      if(note)note.textContent="La métrica de pedidos parciales no estuvo disponible en esta actualización.";
    }
  };

  root.querySelectorAll("[data-flow-preset]").forEach(button=>button.addEventListener("click",()=>{
    const days=Number(button.dataset.flowPreset);
    fromInput.value=daysBefore(days-1,new Date(`${toInput.value||to}T12:00:00`));
    markPreset(String(days));
    load().catch(error=>toast(error.message,"error",7000));
  }));

  root.querySelector("#flow-run-v11120").addEventListener("click",()=>{
    markPreset("");
    load().catch(error=>toast(error.message,"error",7000));
  });

  root.querySelector("#flow-help-v11120").addEventListener("click",()=>guide({
    title:"Cómo leer Flujo y tiempos",
    description:"El módulo separa el tiempo de trabajo real del tiempo que un pedido permanece esperando dentro del sistema.",
    items:[
      {title:"Lead time del pedido",detail:"Horas laborales desde la creación del pedido hasta su cierre. Mide el recorrido completo de extremo a extremo."},
      {title:"Tiempo de toque",detail:"Suma de las sesiones efectivamente trabajadas dentro del calendario laboral configurado."},
      {title:"Espera",detail:"Tiempo laboral de la etapa menos tiempo de toque. Expone cola, pausas y tiempo sin trabajo efectivo."},
      {title:"Eficiencia de flujo",detail:"Tiempo de toque ÷ lead time de las etapas. Un porcentaje bajo indica que domina la espera."},
      {title:"WIP y aging",detail:"Trabajo actualmente en curso y antigüedad laboral de la tarea activa. Ayudan a detectar acumulación."},
      {title:"P90 y SLA",detail:"P90 muestra un escenario alto pero frecuente; SLA compara el tiempo de la etapa con el objetivo configurado."}
    ]
  }));

  exportButton.addEventListener("click",()=>{
    if(!lastData)return;
    exportFlow(lastData,lastPartial);
  });

  await load(initialFrom,to);
}

function renderFlow(data,partialData){
  const summary=data.summary||{};
  const steps=data.steps||[];
  const throughput=data.throughput||[];
  const atRisk=data.atRisk||[];
  const slowest=data.slowestOrders||[];
  const partials=partialData?.orders||[];
  const range=data.range||{};
  const diagnostics=buildDiagnostics(summary,steps,throughput);
  const completed=num(summary.completedTasks);
  const closed=num(summary.closedOrders);
  const waitShare=num(summary.totalStageLeadHours)>0?num(summary.totalWaitHours)/num(summary.totalStageLeadHours)*100:0;
  const coverageClass=completed>=30?"good":completed>=10?"medium":"low";

  return `
    <section class="flow-summary-v11120" aria-label="Indicadores principales del flujo">
      ${metric("Lead time mediano",hoursLabel(summary.medianOrderLeadHours),`P90 ${hoursLabel(summary.p90OrderLeadHours)}`,"lead")}
      ${metric("Eficiencia de flujo",pctLabel(summary.flowEfficiencyPct),`${hoursLabel(summary.totalTouchHours)} de toque`,"efficiency")}
      ${metric("Espera del proceso",hoursLabel(summary.totalWaitHours),`${pctLabel(waitShare)} del tiempo de etapas`,"wait")}
      ${metric("WIP actual",fmt.number(summary.currentWip),`${fmt.number(summary.currentWaitingBlocked)} esperando o bloqueados`,"wip")}
      ${metric("Cumplimiento SLA",pctLabel(summary.slaCompliancePct),`${fmt.number(summary.currentOverdue)} actualmente vencidos`,"sla")}
      ${metric("Pedidos cerrados",fmt.number(closed),`${fmt.number(summary.reworkOrders)} con reproceso de etapa`,"throughput")}
    </section>

    <section class="flow-diagnostics-v11120" aria-label="Diagnóstico automático del flujo">
      ${diagnostics.map(item=>`
        <article class="flow-diagnostic-v11120 ${item.tone}">
          <span>${fmt.escape(item.label)}</span>
          <strong>${fmt.escape(item.title)}</strong>
          <p>${fmt.escape(item.detail)}</p>
        </article>`).join("")}
    </section>

    <section class="flow-panel-v11120 flow-map-panel-v11120">
      <header class="flow-panel-head-v11120">
        <div>
          <span class="flow-section-kicker-v11120">Estado actual + comportamiento histórico</span>
          <h3>Mapa de extremo a extremo</h3>
          <p>Cada bloque representa una etapa real del pedido. Selecciona una etapa para ubicarla en las tablas de control.</p>
        </div>
        <div class="flow-legend-v11120" aria-label="Leyenda">
          <span><i class="touch"></i>Toque</span>
          <span><i class="wait"></i>Espera</span>
          <span><i class="risk"></i>Presión SLA</span>
        </div>
      </header>
      ${renderValueStream(steps)}
    </section>

    <section class="flow-grid-v11120 flow-grid-primary-v11120">
      <article class="flow-panel-v11120">
        <header class="flow-panel-head-v11120 compact">
          <div><span class="flow-section-kicker-v11120">Capacidad y acumulación</span><h3>Control del flujo actual</h3><p>WIP, estados detenidos, vencimientos y antigüedad por etapa.</p></div>
        </header>
        ${renderCurrentFlowTable(steps)}
      </article>

      <article class="flow-panel-v11120">
        <header class="flow-panel-head-v11120 compact">
          <div><span class="flow-section-kicker-v11120">Trabajo vs. espera</span><h3>Composición del tiempo</h3><p>La barra separa tiempo de toque y tiempo laboral sin trabajo efectivo.</p></div>
        </header>
        ${renderTimeComposition(steps)}
      </article>
    </section>

    <section class="flow-panel-v11120">
      <header class="flow-panel-head-v11120">
        <div>
          <span class="flow-section-kicker-v11120">Demanda, salida y acumulación</span>
          <h3>Comportamiento diario del sistema</h3>
          <p>Compara pedidos creados y cerrados con el WIP estimado al final de cada día.</p>
        </div>
        <div class="flow-balance-v11120">
          <span>Entraron <strong>${fmt.number(throughput.reduce((sum,row)=>sum+num(row.created),0))}</strong></span>
          <span>Salieron <strong>${fmt.number(throughput.reduce((sum,row)=>sum+num(row.closed),0))}</strong></span>
        </div>
      </header>
      ${renderFlowTrend(throughput)}
    </section>

    <section class="flow-grid-v11120 flow-orders-grid-v11120">
      <article class="flow-panel-v11120">
        <header class="flow-panel-head-v11120 compact">
          <div><span class="flow-section-kicker-v11120">Intervención inmediata</span><h3>Pedidos que requieren atención</h3><p>Priorización por vencimiento de SLA, espera/bloqueo y prioridad del pedido.</p></div>
          <span class="flow-count-v11120">${fmt.number(atRisk.length)} visibles</span>
        </header>
        ${renderAtRisk(atRisk)}
      </article>

      <article class="flow-panel-v11120">
        <header class="flow-panel-head-v11120 compact">
          <div><span class="flow-section-kicker-v11120">Verificación extremo a extremo</span><h3>Pedidos con mayor lead time</h3><p>Pedidos cerrados del periodo ordenados por horas laborales de recorrido.</p></div>
          <span class="flow-count-v11120">${fmt.number(slowest.length)} visibles</span>
        </header>
        ${renderSlowest(slowest)}
      </article>
    </section>

    ${partials.length?`
      <section class="flow-panel-v11120">
        <header class="flow-panel-head-v11120">
          <div><span class="flow-section-kicker-v11120">Cumplimiento parcial</span><h3>Pedidos con más de una ronda de alistamiento</h3><p>Contrasta la primera salida con el tiempo real requerido para completar el pedido.</p></div>
          <span class="flow-count-v11120">${fmt.number(partials.length)} pedido(s)</span>
        </header>
        ${renderPartials(partials)}
      </section>`:`
      <div class="flow-partial-health-v11120" data-partial-health>No hay pedidos parciales registrados en el periodo seleccionado.</div>`}

    <section class="flow-verification-v11120">
      <header>
        <div><span class="flow-section-kicker-v11120">Trazabilidad del cálculo</span><h3>Verificación del análisis</h3></div>
        <span class="flow-coverage-v11120 ${coverageClass}">${coverageLabel(coverageClass)}</span>
      </header>
      <div class="flow-verification-grid-v11120">
        <div><small>Periodo</small><strong>${fmt.escape(String(range.from||"—"))} → ${fmt.escape(String(range.to||"—"))}</strong><span>${fmt.number(range.days||0)} día(s)</span></div>
        <div><small>Tareas terminadas</small><strong>${fmt.number(completed)}</strong><span>${fmt.number(steps.filter(step=>num(step.tasks)>0).length)} etapa(s) con muestra</span></div>
        <div><small>Pedidos cerrados</small><strong>${fmt.number(closed)}</strong><span>${fmt.number(summary.ordersWithPromise||0)} con promesa registrada</span></div>
        <div><small>Último cálculo</small><strong>${fmt.date(data.generatedAt)}</strong><span>Calendario laboral institucional</span></div>
      </div>
      <p class="flow-method-note-v11120"><strong>Método:</strong> toque = sesiones trabajadas; lead time de etapa = creación de tarea → finalización dentro del calendario laboral; espera = lead time de etapa − toque; lead time del pedido = creación → cierre. Los pedidos visibles permiten abrir el detalle original para contrastar la trazabilidad.</p>
    </section>`;
}

function metric(label,value,detail,tone){
  return `<article class="flow-metric-v11120 ${tone}"><span>${fmt.escape(label)}</span><strong>${fmt.escape(String(value))}</strong><small>${fmt.escape(detail)}</small></article>`;
}

function buildDiagnostics(summary,steps,throughput){
  const active=steps.filter(step=>num(step.wip)>0||num(step.tasks)>0);
  const bottleneck=[...active].sort((a,b)=>bottleneckScore(b)-bottleneckScore(a))[0];
  const waiting=[...active].sort((a,b)=>num(b.avgWaitHours)-num(a.avgWaitHours))[0];
  const variable=[...active].sort((a,b)=>(num(b.p90LeadHours)-num(b.medianLeadHours))-(num(a.p90LeadHours)-num(a.medianLeadHours)))[0];
  const created=throughput.reduce((sum,row)=>sum+num(row.created),0);
  const closed=throughput.reduce((sum,row)=>sum+num(row.closed),0);
  const balance=closed-created;

  return [
    {
      label:"Cuello de botella",
      title:bottleneck?.name||"Sin presión identificada",
      detail:bottleneck?`${fmt.number(bottleneck.wip)} en WIP · ${fmt.number(bottleneck.overdue)} vencido(s) · P90 ${hoursLabel(bottleneck.p90LeadHours)}.`:"Aún no hay suficiente actividad para priorizar una etapa.",
      tone:bottleneck&&num(bottleneck.overdue)>0?"risk":"info"
    },
    {
      label:"Mayor espera",
      title:waiting?.name||"Sin muestra",
      detail:waiting?`${hoursLabel(waiting.avgWaitHours)} de espera promedio y ${pctLabel(waiting.flowEfficiencyPct)} de eficiencia de flujo.`:"No hay etapas terminadas en el periodo.",
      tone:waiting&&num(waiting.avgWaitHours)>num(waiting.avgTouchHours)?"warning":"info"
    },
    {
      label:"Variabilidad",
      title:variable?.name||"Sin muestra",
      detail:variable?`Mediana ${hoursLabel(variable.medianLeadHours)} frente a P90 ${hoursLabel(variable.p90LeadHours)}.`:"No hay suficientes cierres de etapa para calcular dispersión.",
      tone:variable&&num(variable.p90LeadHours)>num(variable.medianLeadHours)*2?"warning":"info"
    },
    {
      label:"Balance del periodo",
      title:balance>=0?`${balance>0?"+":""}${fmt.number(balance)} pedidos`:`${fmt.number(balance)} pedidos`,
      detail:balance>=0?"Se cerraron tantos o más pedidos de los que ingresaron.":"Ingresaron más pedidos de los que se cerraron; vigila crecimiento del WIP.",
      tone:balance>=0?"good":"warning"
    }
  ];
}

function bottleneckScore(step){
  const sla=num(step.slaHours);
  const pressure=sla>0?num(step.avgBusinessLeadHours)/sla:0;
  return num(step.overdue)*40+num(step.blocked)*24+num(step.waiting)*14+num(step.wip)*5+pressure*8+(100-clamp(step.flowEfficiencyPct))*0.08;
}

function renderValueStream(steps){
  if(!steps.length)return empty("No hay etapas configuradas.");
  return `<div class="flow-map-scroll-v11120"><div class="flow-map-v11120" role="list" aria-label="Etapas del flujo">${steps.map((step,index)=>{
    const score=bottleneckScore(step);
    const state=num(step.overdue)>0?"risk":num(step.waiting)+num(step.blocked)>0?"warning":num(step.wip)>0?"active":"quiet";
    return `<button class="flow-node-v11120 ${state}" data-flow-stage="${fmt.escape(step.code)}" role="listitem" aria-label="${fmt.escape(step.name)}, WIP ${fmt.number(step.wip)}, lead ${hoursLabel(step.avgBusinessLeadHours)}">
      <span class="flow-node-sequence-v11120">${String(index+1).padStart(2,"0")}</span>
      <span class="flow-node-title-v11120"><strong>${fmt.escape(step.name)}</strong><small>SLA ${step.slaHours?hoursLabel(step.slaHours):"—"}</small></span>
      <span class="flow-node-kpis-v11120">
        <span><small>WIP</small><b>${fmt.number(step.wip)}</b></span>
        <span><small>Toque</small><b>${hoursLabel(step.avgTouchHours)}</b></span>
        <span><small>Espera</small><b>${hoursLabel(step.avgWaitHours)}</b></span>
        <span><small>P90</small><b>${hoursLabel(step.p90LeadHours)}</b></span>
      </span>
      <span class="flow-node-foot-v11120"><span>Efic. <b>${pctLabel(step.flowEfficiencyPct)}</b></span>${num(step.overdue)>0?`<em>${fmt.number(step.overdue)} SLA vencido(s)</em>`:`<em>${score>25?"Vigilar":"Estable"}</em>`}</span>
    </button>`;
  }).join("")}</div></div>`;
}

function renderCurrentFlowTable(steps){
  const rows=steps.filter(step=>num(step.wip)>0||num(step.tasks)>0);
  if(!rows.length)return `<div class="flow-empty-v11120">No hay actividad suficiente para construir el control por etapa.</div>`;
  return `<div class="table-wrap flow-table-wrap-v11120"><table class="flow-table-v11120">
    <thead><tr><th>Etapa</th><th>WIP</th><th>Trabajando</th><th>Espera</th><th>Bloq.</th><th>Vencidos</th><th>Más antiguo</th><th>SLA</th></tr></thead>
    <tbody>${rows.map(step=>`<tr data-stage-row="${fmt.escape(step.code)}" class="${num(step.overdue)>0?"flow-row-risk-v11120":""}">
      <td data-label="Etapa"><strong>${fmt.escape(step.name)}</strong><small>${fmt.number(step.tasks)} cierre(s) en muestra</small></td>
      <td data-label="WIP"><b>${fmt.number(step.wip)}</b></td>
      <td data-label="Trabajando">${fmt.number(step.inProgress)}</td>
      <td data-label="Espera">${fmt.number(step.waiting)}</td>
      <td data-label="Bloqueados">${fmt.number(step.blocked)}</td>
      <td data-label="Vencidos"><span class="${num(step.overdue)>0?"danger":"success"}">${fmt.number(step.overdue)}</span></td>
      <td data-label="Más antiguo">${hoursLabel(step.oldestBusinessHours)}</td>
      <td data-label="SLA">${step.slaHours?hoursLabel(step.slaHours):"—"}</td>
    </tr>`).join("")}</tbody>
  </table></div>`;
}

function renderTimeComposition(steps){
  const rows=steps.filter(step=>num(step.tasks)>0);
  if(!rows.length)return `<div class="flow-empty-v11120">Las etapas aún no tienen cierres dentro del periodo seleccionado.</div>`;
  return `<div class="flow-time-list-v11120">${rows.map(step=>{
    const lead=Math.max(num(step.avgBusinessLeadHours),num(step.avgTouchHours)+num(step.avgWaitHours),0);
    const touchPct=lead>0?clamp(num(step.avgTouchHours)/lead*100):0;
    const waitPct=lead>0?clamp(num(step.avgWaitHours)/lead*100):0;
    return `<article class="flow-time-row-v11120" data-stage-time="${fmt.escape(step.code)}">
      <div class="flow-time-label-v11120"><strong>${fmt.escape(step.name)}</strong><span>${fmt.number(step.tasks)} tarea(s) · SLA ${step.slaHours?hoursLabel(step.slaHours):"—"}</span></div>
      <div class="flow-time-bar-v11120" aria-label="Toque ${pctLabel(touchPct)}, espera ${pctLabel(waitPct)}">
        <span class="touch" style="--flow-size:${touchPct}%"></span><span class="wait" style="--flow-size:${waitPct}%"></span>
      </div>
      <div class="flow-time-values-v11120"><span><small>Toque</small><b>${hoursLabel(step.avgTouchHours)}</b></span><span><small>Espera</small><b>${hoursLabel(step.avgWaitHours)}</b></span><span><small>Lead</small><b>${hoursLabel(step.avgBusinessLeadHours)}</b></span><span><small>Efic.</small><b>${pctLabel(step.flowEfficiencyPct)}</b></span></div>
    </article>`;
  }).join("")}</div>`;
}

function renderFlowTrend(rows){
  if(!rows.length)return `<div class="flow-empty-v11120">No hay movimiento diario en el periodo.</div>`;
  const width=960,height=250,pad={left:42,right:20,top:18,bottom:36};
  const innerW=width-pad.left-pad.right,innerH=height-pad.top-pad.bottom;
  const maxValue=Math.max(1,...rows.flatMap(row=>[num(row.created),num(row.closed),num(row.wipAtEnd)]));
  const group=innerW/rows.length;
  const barW=Math.max(2,Math.min(10,group*.23));
  const y=value=>pad.top+innerH-(num(value)/maxValue*innerH);
  const wipPoints=rows.map((row,index)=>`${pad.left+group*(index+.5)},${y(row.wipAtEnd)}`).join(" ");
  const tickEvery=Math.max(1,Math.ceil(rows.length/7));
  const bars=rows.map((row,index)=>{
    const center=pad.left+group*(index+.5);
    const createdH=innerH-(y(row.created)-pad.top);
    const closedH=innerH-(y(row.closed)-pad.top);
    return `<rect class="created" x="${center-barW-1}" y="${y(row.created)}" width="${barW}" height="${createdH}" rx="2"></rect><rect class="closed" x="${center+1}" y="${y(row.closed)}" width="${barW}" height="${closedH}" rx="2"></rect>`;
  }).join("");
  const labels=rows.map((row,index)=>index%tickEvery===0||index===rows.length-1?`<text x="${pad.left+group*(index+.5)}" y="${height-10}" text-anchor="middle">${fmt.escape(shortDay(row.day))}</text>`:"").join("");
  const grid=[0,.25,.5,.75,1].map(ratio=>{
    const value=maxValue*ratio,cy=pad.top+innerH*(1-ratio);
    return `<line x1="${pad.left}" y1="${cy}" x2="${width-pad.right}" y2="${cy}"></line><text x="${pad.left-7}" y="${cy+4}" text-anchor="end">${fmt.number(value,0)}</text>`;
  }).join("");

  return `<div class="flow-trend-v11120">
    <div class="flow-chart-legend-v11120"><span><i class="created"></i>Creados</span><span><i class="closed"></i>Cerrados</span><span><i class="wip"></i>WIP al cierre del día</span></div>
    <div class="flow-chart-scroll-v11120"><svg class="flow-chart-v11120" viewBox="0 0 ${width} ${height}" role="img" aria-label="Tendencia diaria de creados, cerrados y WIP">
      <g class="grid">${grid}</g><g class="bars">${bars}</g><polyline class="wip-line" points="${wipPoints}"></polyline><g class="labels">${labels}</g>
    </svg></div>
    <details class="flow-daily-details-v11120"><summary>Ver cifras diarias</summary>
      <div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Creados</th><th>Cerrados</th><th>Balance</th><th>WIP fin de día</th></tr></thead><tbody>
      ${rows.map(row=>{const balance=num(row.closed)-num(row.created);return `<tr><td>${fmt.day(row.day)}</td><td>${fmt.number(row.created)}</td><td>${fmt.number(row.closed)}</td><td class="${balance>=0?"success":"warning"}">${balance>0?"+":""}${fmt.number(balance)}</td><td>${fmt.number(row.wipAtEnd)}</td></tr>`}).join("")}
      </tbody></table></div>
    </details>
  </div>`;
}

function shortDay(value){
  if(!value)return "";
  return new Intl.DateTimeFormat("es-CO",{day:"2-digit",month:"short",timeZone:"America/Bogota"}).format(new Date(`${String(value).slice(0,10)}T12:00:00`)).replace(".","");
}

function renderAtRisk(rows){
  if(!rows.length)return `<div class="flow-empty-v11120 good">No hay pedidos visibles con presión operativa en este momento.</div>`;
  return `<div class="table-wrap flow-table-wrap-v11120"><table class="flow-table-v11120 flow-order-table-v11120"><thead><tr><th>Pedido</th><th>Etapa</th><th>Estado</th><th>Aging</th><th>SLA</th><th>Responsable</th><th></th></tr></thead><tbody>${rows.map(row=>`
    <tr>
      <td data-label="Pedido"><strong>${fmt.escape(row.orderNumber)}</strong><small>${fmt.escape(row.clientName||"")}</small>${priorityBadge(row.priority)}</td>
      <td data-label="Etapa">${fmt.escape(row.stepName||fmt.step(row.stepCode))}</td>
      <td data-label="Estado">${statusBadge(row.status)}</td>
      <td data-label="Aging"><b class="${num(row.overdueHours)>0?"danger":""}">${hoursLabel(row.ageBusinessHours)}</b>${num(row.overdueHours)>0?`<small>+${hoursLabel(row.overdueHours)} sobre SLA</small>`:""}</td>
      <td data-label="SLA">${row.slaHours?hoursLabel(row.slaHours):"—"}</td>
      <td data-label="Responsable">${fmt.escape(row.assigneeName||"Sin asignar")}</td>
      <td data-label="Acción"><button class="btn btn-ghost flow-open-order-v11120" data-open-flow-order="${fmt.escape(row.orderId)}">Abrir</button></td>
    </tr>`).join("")}</tbody></table></div>`;
}

function renderSlowest(rows){
  if(!rows.length)return `<div class="flow-empty-v11120">No hay pedidos cerrados visibles en el periodo.</div>`;
  return `<div class="table-wrap flow-table-wrap-v11120"><table class="flow-table-v11120 flow-order-table-v11120"><thead><tr><th>Pedido</th><th>Ruta</th><th>Lead laboral</th><th>Tiempo calendario</th><th>Promesa</th><th></th></tr></thead><tbody>${rows.map(row=>`
    <tr>
      <td data-label="Pedido"><strong>${fmt.escape(row.orderNumber)}</strong><small>${fmt.escape(row.clientName||"")}</small></td>
      <td data-label="Ruta">${fmt.escape(fmt.route(row.route))}</td>
      <td data-label="Lead laboral"><b>${hoursLabel(row.leadBusinessHours)}</b></td>
      <td data-label="Tiempo calendario">${hoursLabel(row.elapsedHours)}</td>
      <td data-label="Promesa">${row.promisedAt?`${row.onTime===true?'<span class="success">A tiempo</span>':row.onTime===false?'<span class="danger">Fuera de promesa</span>':"—"}<small>${fmt.date(row.promisedAt)}</small>`:"Sin promesa"}</td>
      <td data-label="Acción"><button class="btn btn-ghost flow-open-order-v11120" data-open-flow-order="${fmt.escape(row.orderId)}">Abrir</button></td>
    </tr>`).join("")}</tbody></table></div>`;
}

function renderPartials(rows){
  return `<div class="table-wrap flow-table-wrap-v11120"><table class="flow-table-v11120"><thead><tr><th>Pedido</th><th>Cliente</th><th>Rondas</th><th>Primera salida</th><th>Tiempo real</th><th>Pendientes</th><th>Resultado</th></tr></thead><tbody>${rows.map(row=>`
    <tr><td data-label="Pedido"><strong>${fmt.escape(row.orderNumber)}</strong></td><td data-label="Cliente">${fmt.escape(row.clientName||"")}</td><td data-label="Rondas">${fmt.number(row.roundCount)}</td><td data-label="Primera salida">${hoursLabel(row.partialHours)}</td><td data-label="Tiempo real"><b>${hoursLabel(row.realHours)}</b></td><td data-label="Pendientes">${fmt.number(row.pendingItemCount)}</td><td data-label="Resultado"><span class="order-partial-tag">${row.status==="COMPLETE"?"Completado":"Pedido parcial"}</span></td></tr>`).join("")}</tbody></table></div>`;
}

function coverageLabel(level){
  return level==="good"?"Muestra sólida":level==="medium"?"Muestra moderada":"Muestra inicial";
}

function bindFlowInteractions(root){
  root.querySelectorAll("[data-flow-stage]").forEach(button=>button.addEventListener("click",()=>{
    const code=button.dataset.flowStage;
    root.querySelectorAll("[data-flow-stage]").forEach(node=>node.classList.toggle("selected",node===button));
    root.querySelectorAll("[data-stage-row],[data-stage-time]").forEach(row=>row.classList.toggle("selected",row.dataset.stageRow===code||row.dataset.stageTime===code));
    const target=root.querySelector(`[data-stage-row="${cssEscape(code)}"]`)||root.querySelector(`[data-stage-time="${cssEscape(code)}"]`);
    target?.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"center"});
  }));

  root.querySelectorAll("[data-open-flow-order]").forEach(button=>button.addEventListener("click",()=>{
    const id=button.dataset.openFlowOrder;
    if(id)window.dispatchEvent(new CustomEvent("erp:open-order",{detail:id}));
  }));
}

function cssEscape(value){
  if(globalThis.CSS?.escape)return CSS.escape(value);
  return String(value||"").replace(/["\\]/g,"\\$&");
}

function exportFlow(data,partialData){
  const summary=data.summary||{};
  const steps=data.steps||[];
  const atRisk=data.atRisk||[];
  const slowest=data.slowestOrders||[];
  const partials=partialData?.orders||[];
  const rows=[
    ["SECCION","ELEMENTO","METRICA","VALOR"],
    ["RESUMEN","Flujo","Lead time mediano pedido (h)",summary.medianOrderLeadHours],
    ["RESUMEN","Flujo","P90 lead time pedido (h)",summary.p90OrderLeadHours],
    ["RESUMEN","Flujo","Eficiencia de flujo (%)",summary.flowEfficiencyPct],
    ["RESUMEN","Flujo","Tiempo de toque total (h)",summary.totalTouchHours],
    ["RESUMEN","Flujo","Espera total de etapas (h)",summary.totalWaitHours],
    ["RESUMEN","Flujo","WIP actual",summary.currentWip],
    ["RESUMEN","Flujo","Vencidos actuales",summary.currentOverdue],
    ["RESUMEN","Flujo","Cumplimiento SLA (%)",summary.slaCompliancePct],
    ["RESUMEN","Flujo","Pedidos cerrados",summary.closedOrders],
    ["RESUMEN","Flujo","Pedidos con reproceso",summary.reworkOrders]
  ];

  steps.forEach(step=>rows.push([
    "ETAPA",step.name,
    "Detalle",
    `WIP=${num(step.wip)} | toque=${num(step.avgTouchHours)}h | espera=${num(step.avgWaitHours)}h | lead=${num(step.avgBusinessLeadHours)}h | P90=${num(step.p90LeadHours)}h | eficiencia=${num(step.flowEfficiencyPct)}% | SLA=${step.slaHours??""}h | vencidos=${num(step.overdue)}`
  ]));
  atRisk.forEach(row=>rows.push(["RIESGO",row.orderNumber,row.stepName,`aging=${num(row.ageBusinessHours)}h | SLA=${row.slaHours??""}h | estado=${row.status} | prioridad=${row.priority}`]));
  slowest.forEach(row=>rows.push(["PEDIDO_CERRADO",row.orderNumber,row.clientName,`lead=${num(row.leadBusinessHours)}h | calendario=${num(row.elapsedHours)}h | ruta=${row.route}`]));
  partials.forEach(row=>rows.push(["PARCIAL",row.orderNumber,row.clientName,`rondas=${num(row.roundCount)} | primera_salida=${num(row.partialHours)}h | real=${num(row.realHours)}h | pendientes=${num(row.pendingItemCount)}`]));

  const csv="\ufeff"+rows.map(row=>row.map(csvEscape).join(";")).join("\n");
  const link=document.createElement("a");
  link.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  link.download=`crm_flujo_tiempos_${data.range?.from||"desde"}_${data.range?.to||"hasta"}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  toast("Análisis de Flujo y tiempos exportado.");
}
