import {inventoryCountReports,inventoryExpressReports,inventoryCountReview} from "../services/inventory.js";
import {api} from "../services/api.js";
import {fmt} from "../core/format.js";
import {empty,modal,toast} from "../core/ui.js";
import {inventoryEnterpriseRow,inventoryKpi,inventoryListHeader,inventoryToolbar,bindListFilter} from "./inventory-ui-v11240.js";

const esc=v=>fmt.escape(v??"");
const statusLabel=s=>({SUBMITTED:"Pendiente de revisión",APPLIED:"Aprobado y aplicado",RECOUNT_REQUIRED:"Reconteo solicitado",REJECTED:"Rechazado",CANCELLED:"Cerrado"})[s]||s||"—";
const statusTone=s=>s==="APPLIED"?"linked":"standalone";
const modeLabel=m=>({METERAGE:"Metraje de cable",EXPRESS:"Conteo exprés",CYCLIC:"Conteo programado"})[m]||m||"Conteo";
const money=v=>fmt.money(Number(v||0));

export async function renderInventoryReview(root,{status="SUBMITTED",scope="ALL"}={}){
  const express=scope==="EXPRESS";
  const data=express?await inventoryExpressReports(status,1,100):await inventoryCountReports(status,1,100);
  if(!data.access?.controller){root.innerHTML=empty("Acceso restringido","Esta vista corresponde al control y revisión del inventario.");return}
  const rows=data.items||[],canApprove=Boolean(data.access?.canApprove),modes=[...new Set(rows.map(x=>x.mode).filter(Boolean))];
  root.innerHTML=`<section class="page-head inventory-page-head-v11109"><div><span class="inventory-kicker-v11109">${express?"CONTEO EXPRÉS · SUPER ADMIN":"CONTROL DE CONTEOS"}</span><h2>${express?"Conteos no programados":"Revisión y aprobación"}</h2><p>${express?"Bandeja exclusiva para revisar capturas exprés. La comparación y el impacto permanecen del lado de Control.":"Revisa lo contado, la diferencia y el impacto antes de aplicar cualquier cambio al inventario."}</p></div><div class="page-actions"><button class="btn btn-primary" id="review-refresh">Actualizar</button></div></section>
  <section class="inventory-stock-tabs-v11109" role="group">${[["SUBMITTED","Pendientes"],["RECOUNT_REQUIRED","Reconteos"],["APPLIED","Aplicados"],["REJECTED","Rechazados"]].map(([value,label])=>`<button type="button" data-review-status="${value}" class="${status===value?"active":""}">${label}</button>`).join("")}</section>
  <section class="inventory-summary-v11109">${inventoryKpi(statusLabel(status),data.pagination?.totalItems||0,express?"Conteos exprés":"Reportes de la bandeja",{tone:status==="SUBMITTED"?"warning":status==="APPLIED"?"success":"neutral"})}${inventoryKpi("Con decisión",rows.filter(x=>x.reviewDecision).length,"Trazabilidad registrada",{tone:"info"})}${inventoryKpi("Con diferencias",rows.filter(x=>Number(x.differenceLots||0)>0).length,"Requieren lectura detallada",{tone:"warning"})}${inventoryKpi("Impacto potencial",money(rows.reduce((a,x)=>a+Number(x.estimatedValueImpact||0),0)),"Suma de la bandeja",{raw:true})}</section>
  <section class="inventory-results-v11109">${inventoryListHeader({eyebrow:express?"REPORTES EXPRÉS":"REPORTES",title:statusLabel(status),detail:canApprove?"Revisar, recontar o aprobar":"Consulta y auditoría"})}<div class="card-pad">${inventoryToolbar({title:"Bandeja de control",detail:"Busca por referencia, reporte o responsable",searchId:"review-q",filters:[{id:"review-mode",allLabel:"Todos los tipos",options:modes.map(x=>({value:x,label:modeLabel(x)}))},{id:"review-diff",allLabel:"Todas las diferencias",options:[{value:"YES",label:"Con diferencia"},{value:"NO",label:"Sin diferencia"}]}]})}<small id="review-visible-count"></small></div><div id="review-list"></div></section>`;
  const bindActions=host=>host.querySelectorAll("[data-review-open]").forEach(btn=>btn.onclick=()=>openReport(rows.find(r=>r.id===btn.dataset.reviewOpen),canApprove,()=>renderInventoryReview(root,{status,scope})));
  bindListFilter(root,{rows,render:reportRow,searchId:"review-q",hostId:"review-list",countId:"review-visible-count",filters:[{id:"review-mode",key:"mode",get:x=>x.mode},{id:"review-diff",key:"diff",get:x=>Number(x.differenceLots||0)>0?"YES":"NO"}],onRendered:bindActions});
  root.querySelector("#review-refresh").onclick=()=>renderInventoryReview(root,{status,scope}).catch(e=>toast(e.message,"error",7000));
  root.querySelectorAll("[data-review-status]").forEach(btn=>btn.onclick=()=>renderInventoryReview(root,{status:btn.dataset.reviewStatus,scope}).catch(e=>toast(e.message,"error",7000)));
}

function reportRow(r){
  const conflict=Boolean(r.comparison?.commitmentConflict),express=r.planType==="EXPRESS"||r.mode==="EXPRESS";
  return inventoryEnterpriseRow({
    eyebrow:express?"EXPRÉS":modeLabel(r.mode).toUpperCase(),
    reference:r.reference,
    description:r.description,
    subline:`${r.reportCode||"Reporte"} · ${r.submittedBy||"Responsable"} · ${fmt.date(r.submittedAt)}`,
    meta:[
      {label:"Lotes",value:fmt.number((r.observations||[]).length),detail:`${fmt.number(r.differenceLots||0)} con diferencia`},
      {label:"Impacto",value:money(r.estimatedValueImpact||0),detail:conflict?"Conflicto detectado":"Costo Siesa"},
      {label:"Diferencia abs.",value:fmt.number(r.absoluteDifference||0,3),detail:r.unit||""},
      {label:"Origen",value:r.planType==="RECOUNT"?"Reconteo":express?"No programado":"Programado",detail:r.mode==="METERAGE"?"Cable / metraje":"Conteo físico"}
    ],
    statusLabel:statusLabel(r.status),statusDetail:r.reviewNote||"Abrir para comparar",statusTone:statusTone(r.status),
    actions:`<button class="btn btn-primary" data-review-open="${esc(r.id)}">Revisar detalle</button>`
  });
}

async function openReport(report,canApprove,reload){
  if(!report)return;let lots=[];try{lots=await api.inventoryLots(report.itemId,null)}catch(e){console.warn("[INVENTORY REVIEW LOTS]",e)}
  const lotMap=new Map((lots||[]).map(l=>[l.id,l])),snapMap=new Map((report.systemSnapshot||[]).map(x=>[x.lotId,x])),rows=report.comparison?.rows||[],conflict=Boolean(report.comparison?.commitmentConflict),express=report.planType==="EXPRESS"||report.mode==="EXPRESS";
  const view=modal({title:`${express?"Conteo exprés":"Revisión"} · ${report.reportCode}`,size:"wide",confirmLabel:"Cerrar",body:`<section class="inventory-count-v11109"><header><span>${esc(express?"CONTEO EXPRÉS":modeLabel(report.mode))}</span><strong>${esc(report.reference)} · ${esc(report.description)}</strong><p>Reportado por ${esc(report.submittedBy||"—")} · ${fmt.date(report.submittedAt)}</p></header><section class="inventory-summary-v11109">${inventoryKpi("Lotes",(report.observations||[]).length,"Cobertura del reporte")}${inventoryKpi("Exactos",report.exactLots||0,"Sin diferencia",{tone:"success"})}${inventoryKpi("Con diferencia",report.differenceLots||0,"Requieren decisión",{tone:report.differenceLots?"warning":"success"})}${inventoryKpi("Impacto estimado",money(report.estimatedValueImpact||0),"Costo Siesa",{raw:true,tone:report.estimatedValueImpact?"warning":"neutral"})}</section>${conflict?'<div class="module-error card-pad"><strong>Conflicto con cantidades comprometidas</strong><p>El sistema bloqueará la aplicación y solicitará reconteo.</p></div>':""}<section class="v115-goods-list">${rows.map(row=>comparisonRow(row,lotMap.get(row.lotId),snapMap.get(row.lotId),report.unit)).join("")}</section>${report.reviewNote?`<div class="v116-origin-note"><strong>Decisión registrada</strong><span>${esc(report.reviewNote)}</span></div>`:""}${canApprove&&report.status==="SUBMITTED"?`<div class="field"><label>Motivo de la decisión</label><textarea class="control" data-review-reason rows="3" maxlength="300" placeholder="Explica brevemente la validación realizada"></textarea></div><section class="page-actions"><button class="btn btn-ghost" data-decision="RECOUNT">Solicitar reconteo</button><button class="btn btn-danger" data-decision="REJECT">Rechazar</button><button class="btn btn-primary" data-decision="APPROVE">Aprobar y aplicar</button></section>`:""}</section>`});
  view.root.querySelectorAll("[data-decision]").forEach(btn=>btn.onclick=async()=>{const reason=view.root.querySelector("[data-review-reason]")?.value?.trim()||"";if(!reason)return toast("Registra el motivo de la decisión.","warning",5000);btn.disabled=true;try{const result=await inventoryCountReview(report.id,btn.dataset.decision,reason);toast(result.message||"Decisión registrada.",result.status==="APPLIED"?"success":"warning",8000);document.querySelector("#modal-root")?.replaceChildren();await reload()}catch(e){toast(e.message,"error",8000)}finally{btn.disabled=false}});
}

function comparisonRow(row,lot,snap,unit){
  const delta=Number(row.delta||0),identity=[lot?.lotNumber||lot?.serialNumber,lot?.variantLabel].filter(Boolean).join(" · ")||"Lote",location=[lot?.warehouseCode,lot?.location,lot?.locationName].filter(Boolean).join(" · ")||row.lotId;
  return inventoryEnterpriseRow({eyebrow:"LOTE / UBICACIÓN",reference:identity,description:location,meta:[{label:"Sistema",value:`${fmt.number(row.systemPhysical||0,3)} ${unit||""}`},{label:"Contado",value:`${fmt.number(row.countedPhysical||0,3)} ${unit||""}`},{label:"Reservado",value:fmt.number(snap?.reserved||0,3)},{label:"Bloqueado",value:fmt.number(snap?.blocked||0,3)}],statusLabel:Math.abs(delta)<=0.0000001?"Exacto":`${delta>0?"+":""}${fmt.number(delta,3)} ${unit||""}`,statusDetail:`Impacto ${money(row.estimatedImpact||0)}`,statusTone:Math.abs(delta)<=0.0000001?"linked":"standalone"});
}
