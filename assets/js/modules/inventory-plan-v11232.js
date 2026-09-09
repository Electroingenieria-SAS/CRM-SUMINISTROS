import {inventoryCountCenter} from "../services/inventory.js";
import {fmt} from "../core/format.js";
import {state} from "../core/state.js";
import {empty,toast} from "../core/ui.js";

const esc=v=>fmt.escape(v??"");
const pct=v=>v==null?"Sin base":`${fmt.number(v,1)}%`;
const localDay=()=>new Intl.DateTimeFormat("en-CA",{timeZone:state.organization?.timezone||"America/Bogota",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const metric=(label,value,detail,tone="neutral",raw=false)=>`<article class="inventory-summary-item-v11109 ${tone}"><span></span><div><strong>${raw?esc(value):fmt.number(value)}</strong><b>${esc(label)}</b><small>${esc(detail)}</small></div></article>`;

export async function renderInventoryPlan(root){
  const data=await inventoryCountCenter(localDay());
  if(!data.access?.controller){root.innerHTML=empty("Acceso restringido","Esta vista corresponde al control de la programación de inventario.");return}
  const c=data.control||{},s=c.summary||{},r=c.reports||{},q=c.dataQuality||{},plan=c.plan||[],bands=c.bands||[];
  root.innerHTML=`<section class="page-head inventory-page-head-v11109"><div><span class="inventory-kicker-v11109">PLAN DE CONTABILIZACIÓN</span><h2>Jornada de inventario · ${esc(localDay())}</h2><p>Aquí ves qué falta por contar, qué ya fue reportado y por qué el motor priorizó cada referencia. La captura física sigue siendo exclusiva del auxiliar.</p></div><div class="page-actions"><button class="btn btn-primary" id="plan-refresh">Actualizar</button></div></section>
  <section class="inventory-source-bar-v11109"><div class="inventory-source-main-v11109"><span>↻</span><div><strong>Pareto operativo activo</strong><small>ABC Siesa + costo + rotación + consumo + señales CRM · selección determinística sin repetición anual.</small></div></div><div class="inventory-source-stats-v11109"><span><b>${fmt.number(q.siesaAbcCoveragePct||0,1)}%</b> ABC Siesa</span><span><b>${fmt.number(q.crmMovementEvents365||0)}</b> movimientos</span><span><b>${fmt.number(q.crmDemandOrders365||0)}</b> pedidos señal</span></div></section>
  <section class="inventory-summary-v11109">${metric("Meta hoy",s.targetToday||0,"Referencias objetivo","info")}${metric("Contadas hoy",s.countedToday||0,`${s.submittedToday||0} actualmente en revisión`,s.countedToday?"success":"neutral")}${metric("Pendientes hoy",s.remainingToday||0,"Cola restante de la jornada",s.remainingToday?"warning":"success")}${metric("En revisión",r.pending||0,"Reportes esperando decisión",r.pending?"warning":"neutral")}${metric("Reconteos",s.recountPending||r.recounts||0,"Prioridad operativa",(s.recountPending||r.recounts)?"warning":"neutral")}${metric("Pendientes anuales",s.pendingYear||0,`${s.countedYear||0} contabilizadas en el año`,"neutral")}${metric("Cobertura anual",pct(s.coveragePct),`${s.countedYear||0} de ${s.totalMaterials||0}`,"info",true)}${metric("Exactitud",pct(s.exactnessPct),s.exactnessPct==null?"Aún sin base aprobada":`${s.differenceEvents||0} diferencias registradas`,s.exactnessPct>=95?"success":"neutral",true)}</section>
  ${paretoPanel(bands)}
  <section class="inventory-results-v11109"><header class="inventory-results-head-v11109"><div><span>COLA DE HOY</span><strong>Referencias pendientes por contabilizar</strong><small>${plan.length} referencia(s) aún por capturar</small></div></header><div>${plan.length?plan.map(planRow).join(""):empty("Jornada al día","No quedan referencias programadas por contar para hoy.")}</div></section>
  <section class="card card-pad"><strong>Lectura correcta de los estados</strong><p><b>Pendiente hoy</b> significa que el auxiliar todavía no ha enviado el conteo. <b>En revisión</b> significa que ya contó y el sistema comparó, pero aún no se ha aprobado. <b>Reconteo</b> requiere una nueva captura. <b>Aplicado</b> ya afectó el inventario mediante el flujo de aprobación.</p></section>`;
  root.querySelector("#plan-refresh").onclick=()=>renderInventoryPlan(root).catch(e=>toast(e.message,"error",7000));
}

function paretoPanel(rows){
  return `<section class="inventory-results-v11109"><header class="inventory-results-head-v11109"><div><span>PARETO ADAPTATIVO</span><strong>Distribución completa de criticidad</strong><small>Las bandas más altas reciben mayor frecuencia y prioridad de revisión.</small></div></header><section class="inventory-summary-v11109">${rows.map(row=>metric(`Banda ${row.band}`,row.materials||0,`${row.pending||0} pendientes · score ${fmt.number(row.avgScore||0,1)}`,row.band==="A+"||row.band==="A"?"danger":row.band==="B"?"warning":"neutral")).join("")}</section></section>`;
}

function planRow(item){
  const cable=item.itemType==="CUTTABLE";
  const high=item.paretoBand==="A+"||item.paretoBand==="A";
  return `<article class="inventory-row-v11109"><div class="inventory-material-cell-v11109"><div class="inventory-reference-line-v11109"><strong>${esc(item.reference)}</strong><span class="inventory-stock-state-v11109 ${high?"warning":"available"}">${cable?"METRAJE":"CONTEO"}</span></div><h3>${esc(item.description)}</h3><p>${esc((item.warehouses||[]).join(" · ")||"Sin bodega")}</p></div><div class="inventory-trace-cell-v11109"><small>Pareto / prioridad</small><strong>${esc(item.paretoBand||"—")} · score ${fmt.number(item.businessScore||0,1)}</strong><span>ABC rot. ${esc(item.abcTurns||"—")} · costo ${esc(item.abcCost||"—")}</span></div><div class="inventory-qty-cell-v11109"><small>Lotes / carretos</small><strong>${fmt.number(item.lotCount||item.lots?.length||0)}</strong><span>${cable?"Medición individual":"Conteo por ubicación"}</span></div><div class="inventory-qty-cell-v11109"><small>Último conteo</small><strong>${item.lastCountAt?fmt.day(item.lastCountAt):"Nunca"}</strong><span>${item.lastCountAt?`${fmt.number(item.daysSinceCount||0)} día(s)`:"Pendiente anual"}</span></div><div class="inventory-row-actions-v11109"><span class="inventory-readonly-v11109">Pendiente del auxiliar</span></div></article>`;
}
