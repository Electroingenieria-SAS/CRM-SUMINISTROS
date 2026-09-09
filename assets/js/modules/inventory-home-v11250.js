import {inventoryCountCenter} from "../services/inventory.js";
import {fmt} from "../core/format.js";
import {state} from "../core/state.js";
import {empty,toast} from "../core/ui.js";
import {inventoryKpi} from "./inventory-ui-v11240.js";

const esc=v=>fmt.escape(v??"");
const localDay=()=>new Intl.DateTimeFormat("en-CA",{timeZone:state.organization?.timezone||"America/Bogota",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());

export async function renderInventoryHome(root,{onNavigate}={}){
  const data=await inventoryCountCenter(localDay());
  const a=data.access||{},op=data.operator||{},progress=op.progress||{},control=data.control||{},summary=control.summary||{},reports=control.reports||{};
  if(!a.operator&&!a.controller){root.innerHTML=empty("Inventario restringido","Tu perfil no tiene funciones activas de Inventario.");return}
  const actions=[];
  if(a.operator){
    actions.push(card("CAPTURA","Registrar conteo","Busca, escanea, cuenta o mide una referencia. El sistema detecta si es programada, exprés o metraje.","capture","Abrir captura"));
    actions.push(card("CONTEO EXPRÉS","Conteo no programado","Busca una referencia que no esté en la jornada y regístrala sin consultar saldos. Si ya está programada, se usa el plan para evitar duplicidad.","capture","Iniciar exprés"));
    actions.push(card("JORNADA","Mi jornada","Trabaja la cola diaria en orden, con reconteos priorizados y sin ver saldos esperados.","count","Ver jornada"));
    actions.push(card("IDENTIFICACIÓN","Etiquetas y stickers","Imprime o exporta QR + CODE128 por lote/carreto, sin cantidades impresas.","labels","Gestionar etiquetas"));
  }
  if(a.controller){
    actions.push(card("PLANIFICACIÓN","Plan de conteos","Consulta pendientes del día, Pareto, prioridad, lotes y cobertura anual.","plan","Ver plan"));
    actions.push(card("CONTROL","Revisión y aprobación","Compara sistema vs. conteo, revisa impacto y decide aprobar, recontar o rechazar.","review","Ir a revisión"));
    actions.push(card("TRAZABILIDAD","Historial de conteos","Consulta todos los reportes y decisiones; exporta el histórico para auditoría.","history","Abrir historial"));
    actions.push(card("EXISTENCIAS","Stock y ubicaciones","Consulta físico, disponible, reservas, bloqueos, lotes y sincronización Siesa.","stock","Consultar stock"));
    actions.push(card("KARDEX","Movimientos","Busca una referencia y revisa entradas, salidas, ajustes y trazabilidad por fecha/ubicación.","ledger","Ver movimientos"));
    actions.push(card("ANÁLISIS","Inteligencia","Pareto, criticidad, brechas Siesa/CRM, exactitud, cobertura y referencias estrella.","control","Abrir inteligencia"));
  }
  root.innerHTML=`<section class="page-head inventory-page-head-v11109"><div><span class="inventory-kicker-v11109">CENTRO DE INVENTARIO</span><h2>Inventario operativo y contable</h2><p>Un solo lugar para contar, medir cable, identificar, revisar, aprobar, consultar existencias y auditar movimientos.</p></div><button class="btn btn-primary" id="inv-home-refresh">Actualizar</button></section>
  <section class="inventory-summary-v11109">${a.operator?inventoryKpi("Por contar",progress.remaining||0,"Jornada personal",{tone:progress.remaining?"warning":"success"}):""}${a.operator?inventoryKpi("En revisión",progress.waitingReview||0,"Reportes enviados",{tone:"info"}):""}${a.controller?inventoryKpi("Pendientes hoy",summary.remainingToday||0,`Meta ${summary.targetToday||0}`,{tone:summary.remainingToday?"warning":"success"}):""}${a.controller?inventoryKpi("Revisión",reports.pending||0,"Esperando decisión",{tone:reports.pending?"warning":"success"}):""}${a.controller?inventoryKpi("Reconteos",reports.recounts||summary.recountPending||0,"Prioridad",{tone:(reports.recounts||summary.recountPending)?"warning":"neutral"}):""}${a.controller?inventoryKpi("Cobertura",`${fmt.number(summary.coveragePct||0,1)}%`,`${fmt.number(summary.countedYear||0)} de ${fmt.number(summary.totalMaterials||0)}`,{tone:"info",raw:true}):""}</section>
  <section class="v115-goods-hero"><div class="v115-goods-copy"><span>FLUJO CANÓNICO</span><h3>Contar → comparar → revisar → aplicar</h3><p>La captura nunca ajusta existencias por sí sola. El auxiliar registra lo físico; el sistema compara; Control decide y la aprobación genera el movimiento contable.</p></div><div class="v115-goods-actions"><button class="btn btn-primary" data-home-go="${a.operator?"capture":"review"}">${a.operator?"Registrar conteo":"Revisar pendientes"}</button><small>${esc(localDay())}</small></div></section>
  <section class="v115-process-switch">${actions.join("")}</section>`;
  root.querySelectorAll("[data-home-go]").forEach(btn=>btn.onclick=()=>onNavigate?.(btn.dataset.homeGo));
  root.querySelector("#inv-home-refresh").onclick=()=>renderInventoryHome(root,{onNavigate}).catch(e=>toast(e.message,"error",7000));
}

function card(kicker,title,detail,view,cta){
  return `<button class="v115-process-card" type="button" data-home-go="${esc(view)}"><span class="v115-process-icon">${icon(view)}</span><div><small>${esc(kicker)}</small><strong>${esc(title)}</strong><p>${esc(detail)}</p></div><em>${esc(cta)}</em></button>`;
}
function icon(view){return ({capture:"+",count:"✓",labels:"▣",plan:"≡",review:"◎",history:"↺",stock:"▦",ledger:"⇄",control:"◫"})[view]||"•"}
