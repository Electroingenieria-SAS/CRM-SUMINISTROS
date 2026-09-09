import {inventoryCountCenter} from "../services/inventory.js";
import {fmt} from "../core/format.js";
import {state} from "../core/state.js";
import {empty,toast} from "../core/ui.js";
import {inventoryEnterpriseRow,inventoryKpi,inventoryListHeader,inventoryParetoCards} from "./inventory-ui-v11240.js";

const esc=v=>fmt.escape(v??"");
const pct=v=>v==null?"Sin base":`${fmt.number(v,1)}%`;
const localDay=()=>new Intl.DateTimeFormat("en-CA",{timeZone:state.organization?.timezone||"America/Bogota",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());

export async function renderInventoryControl(root){
  const data=await inventoryCountCenter(localDay());if(!data.access?.controller){root.innerHTML=empty("Acceso restringido","Esta vista corresponde a perfiles de control.");return}
  const c=data.control||{},s=c.summary||{},e=c.executive||{},r=c.reports||{},q=c.dataQuality||{},v=e?.vsm?.summary||{};
  root.innerHTML=`<section class="page-head inventory-page-head-v11109"><div><span class="inventory-kicker-v11109">INTELIGENCIA DE INVENTARIO</span><h2>Control, exactitud y valor</h2><p>Lectura ejecutiva del inventario: cobertura, Pareto, brechas Siesa/CRM, valor y presión operativa.</p></div><button class="btn btn-primary" id="control-refresh">Actualizar</button></section>
  <section class="inventory-summary-v11109">${inventoryKpi("Valor inventario",fmt.money(e?.inventoryValue||0),"Costo Siesa",{raw:true})}${inventoryKpi("Pendientes hoy",s.remainingToday||0,`Meta ${s.targetToday||0} · ${s.countedToday||0} contadas`,{tone:s.remainingToday?"warning":"success"})}${inventoryKpi("En revisión",r.pending||0,fmt.money(r.pendingValueImpact||0)+" impacto potencial",{tone:r.pending?"warning":"success"})}${inventoryKpi("Cobertura",pct(s.coveragePct),`${s.countedYear||0} de ${s.totalMaterials||0}`,{tone:"info",raw:true})}${inventoryKpi("Exactitud",pct(s.exactnessPct),s.exactnessPct==null?"Sin base aprobada":`${s.differenceEvents||0} diferencias`,{tone:s.exactnessPct>=95?"success":"neutral",raw:true})}</section>
  <section class="inventory-results-v11109">${inventoryListHeader({eyebrow:"PARETO ADAPTATIVO",title:"Distribución de criticidad",detail:"Priorización para programación y revisión"})}${inventoryParetoCards(c.bands||[])}</section>
  ${ranking("REFERENCIAS CRÍTICAS","Mayor prioridad económica y operativa",e?.stars||[],false)}
  ${ranking("CONCILIACIÓN","Mayores brechas Siesa vs operación CRM",e?.stockGaps||[],true)}
  <section class="v115-detail-grid"><article><small>Reconteos</small><strong>${fmt.number(s.recountPending||r.recounts||0)}</strong><span>Solicitudes abiertas</span></article><article><small>Brechas</small><strong>${fmt.number(e?.gapMaterials||0)}</strong><span>Siesa vs operación</span></article><article><small>WIP</small><strong>${fmt.number(v.currentWip||0)}</strong><span>${fmt.number(v.currentWaitingBlocked||0)} esperando / bloqueados</span></article></section>
  <section class="card card-pad"><strong>Madurez del motor</strong><p>Base Siesa <b>${esc(q.baselineConfidence||"—")}</b> · aprendizaje CRM <b>${esc(q.adaptiveLearningStage||"—")}</b>. Las aprobaciones de conteo alimentan cobertura y exactitud sin contaminar las señales de salida real.</p></section>`;
  root.querySelector("#control-refresh").onclick=()=>renderInventoryControl(root).catch(e=>toast(e.message,"error",7000));
}

function ranking(kicker,title,rows,gap){
  return `<section class="inventory-results-v11109">${inventoryListHeader({eyebrow:kicker,title,detail:gap?"Diferencia entre fotografía Siesa y operación CRM":"Prioridad combinada de costo, rotación y actividad",count:rows.length})}<section class="v115-goods-list">${rows.length?rows.slice(0,20).map(row=>inventoryEnterpriseRow({eyebrow:gap?"CONCILIACIÓN":`PARETO ${row.paretoBand||"—"}`,reference:row.reference,description:row.description,subline:(row.warehouses||[]).join(" · ")||"Sin bodega",meta:gap?[{label:"Físico Siesa",value:`${fmt.number(row.sourcePhysical||0,3)} ${row.unit||""}`},{label:"Operativo CRM",value:`${fmt.number(row.operationalPhysical||0,3)} ${row.unit||""}`},{label:"Brecha",value:`${Number(row.stockGap)>0?"+":""}${fmt.number(row.stockGap||0,3)} ${row.unit||""}`},{label:"Valor",value:fmt.money(row.inventoryValue||0)}]:[{label:"Score",value:fmt.number(row.businessScore||0,1),detail:`Banda ${row.paretoBand||"—"}`},{label:"ABC rot.",value:row.abcTurns||"—"},{label:"ABC costo",value:row.abcCost||"—"},{label:"Valor",value:fmt.money(row.inventoryValue||0)}],statusLabel:gap?"Conciliar":"Prioridad alta",statusDetail:gap?"Revisar origen de brecha":"Programación prioritaria",statusTone:gap?"standalone":"linked"})).join(""):empty("Sin registros","No hay datos para esta lectura.")}</section></section>`;
}
