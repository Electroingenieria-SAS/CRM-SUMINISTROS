import { state } from "../../../core/state.js";
import { fmt } from "../../../core/format.js";
import { MONITOR_MS, SHIPPING_STEPS } from "../paco-config.js";
import { paco } from "../paco-state.js";
import { readLastDigest } from "./digest-storage.js";
import { isManager, profileId, timeLabel, duration } from "../context/profile-context.js";
import { orderNumber, orderStep, orderStatus, orderAge, orderAssignee, stepName } from "../context/order-context.js";
import { showProactive, alertAllowed } from "./proactive.js";
import { snapshotExecutions, idleAuxiliaries, delayedOrders, longActivities } from "./signals.js";
import { digestDue, deliverDigest } from "./digest.js";
import { loadSnapshot, executionMap, orderMap } from "../context/snapshot.js";

export function monitorTransitions(previous,current){
  if(!previous)return;
  const prevExec=executionMap(previous);
  for(const execution of snapshotExecutions(current)){
    const before=prevExec.get(String(execution.id));
    if(before&&!before.endedAt&&execution.endedAt){
      const mine=String(execution.profileId)===String(profileId());
      const text=`${execution.profileName||"Un auxiliar"} terminó “${execution.title||"una actividad"}” a las ${timeLabel(execution.endedAt)}.`;
      if(mine||isManager())showProactive({title:"Actividad terminada",text,tone:"success",voice:true,actions:[{label:"Ver jornada",action:"navigate",module:"workforce"}]});
    }
  }

  const prevOrders=orderMap(previous);
  for(const row of current.orders){
    const id=String(row.id||row.orderId||"");if(!id)continue;
    const before=prevOrders.get(id);if(!before)continue;
    const oldStep=orderStep(before),newStep=orderStep(row),oldStatus=orderStatus(before),newStatus=orderStatus(row);
    if((oldStep!==newStep||oldStatus!==newStatus)&&SHIPPING_STEPS.has(newStep)){
      showProactive({title:"Movimiento de pedido",text:`${orderNumber(row)} pasó a ${newStep==="CLOSED"?"cerrado":"Despachos y entregas"}.`,tone:"success",voice:true,actions:[{label:"Abrir pedido",action:"open-order",orderId:id,module:"orders"}]});
    }
    const newlyBlocked=!/BLOCK|WAIT|HOLD/.test(oldStatus)&&/BLOCK|WAIT|HOLD/.test(newStatus);
    if(newlyBlocked)showProactive({title:"Novedad operativa",text:`${orderNumber(row)} quedó en estado ${newStatus}. Conviene revisarlo.`,tone:"warning",voice:true,actions:[{label:"Revisar pedido",action:"open-order",orderId:id,module:"orders"}]});
  }
}

export function monitorThresholds(snapshot,initial=false){
  const delayed=delayedOrders(snapshot);
  delayed.slice(0,initial?2:5).forEach(row=>{
    const key=`order-delay:${row.id||row.orderId}`;
    if(!alertAllowed(key))return;
    const text=`${orderNumber(row)} lleva ${duration(orderAge(row))} en ${stepName(row)}${orderAssignee(row)?` con ${orderAssignee(row)}`:" sin responsable"}.`;
    showProactive({title:"Pedido demorado",text,tone:"warning",voice:!initial,actions:[{label:"Diagnosticar",action:"diagnose-order-id",orderId:row.id||row.orderId}]});
  });

  if(isManager()){
    idleAuxiliaries(snapshot).slice(0,initial?2:6).forEach(person=>{
      const key=`idle:${person.id}`;
      if(!alertAllowed(key))return;
      showProactive({
        title:"20 min sin actividad",
        text:`${person.name} lleva ${duration(person.idleSeconds)} sin actividad registrada. Está disponible para nueva asignación.`,
        tone:"info",
        voice:!initial,
        actions:[{label:"Ver estado del equipo",action:"team",icon:"◷"},{label:"Abrir Jornada",action:"navigate",module:"workforce"}]
      });
    });

    longActivities(snapshot).slice(0,3).forEach(person=>{
      const key=`long-work:${person.id}`;
      if(!alertAllowed(key))return;
      showProactive({title:"Actividad prolongada",text:`${person.name} lleva ${duration(person.activeSeconds)} en “${person.activeTitle}”.`,tone:"warning",voice:!initial,actions:[{label:"Ver cronograma",action:"navigate",module:"workforce"}]});
    });

    (snapshot.freightAlerts||[]).slice(0,initial?2:6).forEach(row=>{
      const anomaly=String(row.anomalyLevel||"").toUpperCase();
      const risk=String(row.deliveryRisk||"").toUpperCase();
      const key=`freight:${row.orderId||row.orderNumber}:${anomaly}:${risk}`;
      if(!alertAllowed(key))return;
      const actual=Number(row.actualCost||0),predicted=Number(row.predictedMid||0),deviation=Number(row.deviationPct||0);
      const isCost=["HIGH","CRITICAL"].includes(anomaly);
      const title=isCost?(anomaly==="CRITICAL"?"Flete crítico":"Flete fuera de rango"):"Entrega en riesgo";
      const text=isCost
        ? `${row.orderNumber||"Un pedido"} registró ${actual?new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(actual):"un costo"} de flete${predicted?`, frente a ${new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(predicted)} esperados`:""}${deviation?` (${fmt.number(deviation,1)}% de desviación)`:""}.`
        : `${row.orderNumber||"Un pedido"} presenta riesgo frente a la fecha solicitada${row.estimatedArrivalP80?`. El P80 de llegada apunta a ${fmt.date(row.estimatedArrivalP80)}`:""}.`;
      showProactive({title,text,tone:"warning",voice:!initial,actions:[{label:"Abrir pedido",action:"open-order",orderId:row.orderId,module:"orders"},{label:"Ver inteligencia logística",action:"navigate",module:"dashboard"}]});
    });
  }
}

export async function refreshMonitor(force=false){
  if(paco.monitorBusy||!state.profile)return;
  paco.monitorBusy=true;
  const status=paco.root?.querySelector("[data-paco-monitor-status]");
  if(status&&force)status.textContent="Actualizando…";
  try{
    const snapshot=await loadSnapshot();
    const initial=!paco.previous;
    monitorTransitions(paco.previous,snapshot);
    monitorThresholds(snapshot,initial);
    paco.previous=snapshot;
    if(digestDue())deliverDigest(snapshot,{automatic:true});
    if(status)status.textContent=`Actualizado ${timeLabel(new Date())} · resumen cada 30 min`;
  }catch(error){
    if(status)status.textContent="Monitoreo con datos parciales";
    console.warn("[PACO MONITOR]",error);
  }finally{paco.monitorBusy=false}
}

export function startMonitor(){
  clearInterval(paco.monitorTimer);
  paco.lastDigestAt=readLastDigest();
  setTimeout(()=>refreshMonitor(false),3500);
  paco.monitorTimer=setInterval(()=>refreshMonitor(false),MONITOR_MS);
}
