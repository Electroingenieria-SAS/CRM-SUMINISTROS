import { DIGEST_INTERVAL_MS, DIGEST_ORDER_LIMIT } from "../paco-config.js";
import { paco } from "../paco-state.js";
import { saveLastDigest } from "./digest-storage.js";
import { isManager } from "../context/profile-context.js";
import { orderNumber, orderAge, activeOrder, stageBreakdown, businessClockLabel } from "../context/order-context.js";
import { message, add } from "../ui/messages.js";
import { speak } from "../voice/speech.js";
import { showProactive } from "./proactive.js";
import { idleAuxiliaries, delayedOrders, longActivities, unassignedOrders } from "./signals.js";

export function activeOrdersForDigest(snapshot){
  return (snapshot?.orders||[])
    .filter(activeOrder)
    .slice()
    .sort((a,b)=>{
      const bd=Number(Boolean(b.slaExceeded||b.sla_exceeded)),ad=Number(Boolean(a.slaExceeded||a.sla_exceeded));
      return (bd-ad)||orderAge(b)-orderAge(a);
    });
}

export function digestVoiceText(snapshot){
  const active=activeOrdersForDigest(snapshot);
  const delayed=delayedOrders(snapshot);
  const unassigned=unassignedOrders(snapshot);
  const idle=isManager()?idleAuxiliaries(snapshot):[];
  const top=delayed.slice(0,3).map(row=>orderNumber(row)).join(", ");
  return [
    `Resumen de operación. Hay ${active.length} pedidos visibles`,
    `${delayed.length} demorados`,
    `${unassigned.length} sin responsable`,
    isManager()?`${idle.length} auxiliares con más de 20 minutos sin actividad`:"",
    top?`Los más demorados son ${top}`:"No hay pedidos con demora crítica"
  ].filter(Boolean).join(". ")+".";
}

export function buildOperationalDigest(snapshot,{automatic=false}={}){
  const active=activeOrdersForDigest(snapshot);
  const delayed=delayedOrders(snapshot);
  const unassigned=unassignedOrders(snapshot);
  const idle=isManager()?idleAuxiliaries(snapshot):[];
  const long=isManager()?longActivities(snapshot):[];
  const stages=stageBreakdown(snapshot);
  const stageText=stages.length?stages.slice(0,6).map(([label,count])=>`${label}: ${count}`).join(" · "):"Sin pedidos activos";
  const rows=active.slice(0,DIGEST_ORDER_LIMIT);
  return message({
    type:automatic?"proactive":"normal",
    text:`${automatic?"Resumen automático":"Resumen operativo"} · ${businessClockLabel()}. Así está la operación en este momento.`,
    alert:automatic?{title:"Parte de operación · cada 30 min",text:"",tone:delayed.length?"warning":"info"}:null,
    card:[
      ["Pedidos visibles",String(active.length)],
      ["Pedidos demorados",String(delayed.length)],
      ["Sin responsable",String(unassigned.length)],
      ...(isManager()?[["Sin actividad >20 min",String(idle.length)],["Actividades >90 min",String(long.length)]]:[]),
      ["Distribución por etapa",stageText]
    ],
    orderRows:rows,
    actions:[
      {label:"Pedidos demorados",sub:delayed.length?`${delayed.length} requieren revisión`:"Sin demoras críticas",action:"delayed",icon:"!"},
      {label:"Sin responsable",sub:unassigned.length?`${unassigned.length} en cola`:"Todos tienen responsable",action:"unassigned",icon:"◎"},
      ...(isManager()?[{label:"Estado del equipo",sub:idle.length?`${idle.length} auxiliares disponibles`:"Sin inactividad >20 min",action:"team",icon:"◷"}]:[]),
      {label:"Abrir todos los pedidos",action:"navigate",module:"orders",icon:"→"}
    ]
  });
}

export function digestDue(){
  return isManager()&&(!paco.lastDigestAt||Date.now()-paco.lastDigestAt>=DIGEST_INTERVAL_MS);
}

export function deliverDigest(snapshot,{automatic=true,force=false}={}){
  if(!isManager()&&!force)return;
  const digest=buildOperationalDigest(snapshot,{automatic});
  if(automatic){
    paco.lastDigestAt=Date.now();
    saveLastDigest();
    showProactive({
      title:"Resumen de operación · 30 min",
      text:digest.text,
      tone:delayedOrders(snapshot).length?"warning":"info",
      voice:true,
      voiceText:digestVoiceText(snapshot),
      card:digest.card,
      orderRows:digest.orderRows,
      actions:digest.actions
    });
  }else{
    add(digest);
    speak(digestVoiceText(snapshot));
  }
}
