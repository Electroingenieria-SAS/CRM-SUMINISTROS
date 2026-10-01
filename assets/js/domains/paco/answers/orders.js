import { api } from "../../../services/api.js";
import { ORDER_WARN_SECONDS, SHIPPING_STEPS, STEP_MODULE } from "../paco-config.js";
import { paco } from "../paco-state.js";
import { moduleLabel, isManager, duration } from "../context/profile-context.js";
import { orderNumber, orderStep, orderStatus, orderAge, itemArray } from "../context/order-context.js";
import { message } from "../ui/messages.js";
import { choiceControls } from "../actions/conversation-flow.js";
import { delayedOrders, unassignedOrders } from "../alerts/signals.js";
import { buildOperationalDigest } from "../alerts/digest.js";
import { loadSnapshot } from "../context/snapshot.js";

export async function delayedMessage(){
  const snapshot=paco.previous||await loadSnapshot();
  const rows=delayedOrders(snapshot).slice(0,6);
  if(!rows.length)return message({text:"No veo pedidos visibles con demora significativa o SLA excedido en este momento."});
  return message({
    text:`Encontré ${rows.length} pedido${rows.length===1?"":"s"} que necesitan atención.`,
    actions:rows.map(row=>({label:`${orderNumber(row)} · ${duration(orderAge(row))}`,sub:row.stepName||row.currentStepName||orderStep(row)||"En proceso",icon:"!",action:"diagnose-order-id",orderId:row.id||row.orderId}))
  });
}

export async function unassignedOrdersMessage(){
  const snapshot=paco.previous||await loadSnapshot();
  const rows=unassignedOrders(snapshot).slice(0,8);
  if(!rows.length)return message({text:"No veo pedidos activos visibles sin responsable en este momento."});
  return message({
    text:`Hay ${rows.length} pedido${rows.length===1?"":"s"} activo${rows.length===1?"":"s"} sin responsable visible.`,
    actions:rows.map(row=>({label:`${orderNumber(row)} · ${duration(orderAge(row))}`,sub:row.stepName||row.currentStepName||orderStep(row)||"En cola",icon:"!",action:"diagnose-order-id",orderId:row.id||row.orderId}))
  });
}

export async function shippedMessage(){
  const data=await api.listOrders({page:1,pageSize:80,includeHistory:true,assignment:isManager()?"ALL":"MINE"}).catch(()=>({items:[]}));
  const rows=itemArray(data).filter(row=>SHIPPING_STEPS.has(orderStep(row))||["CLOSED","DELIVERED","SHIPPED"].includes(orderStatus(row))).slice(0,8);
  if(!rows.length)return message({text:"No encontré despachos recientes visibles para tu sesión."});
  return message({text:"Estos son los pedidos más recientes en despacho, entrega o cierre.",actions:rows.map(row=>({label:orderNumber(row),sub:row.stepName||row.currentStepName||orderStep(row)||orderStatus(row),icon:"→",action:"open-order",orderId:row.id||row.orderId,module:"orders"}))});
}

export async function noveltyMessage(){
  try{
    const data=await api.exceptionCenter(null,"OPEN",1,20);
    const rows=itemArray(data);
    if(!rows.length)return message({text:"No veo novedades abiertas en tu ámbito de permisos."});
    return message({text:`Hay ${rows.length} novedad${rows.length===1?"":"es"} abierta${rows.length===1?"":"s"} visibles.`,card:rows.slice(0,8).map(row=>[row.title||row.subtype||row.kind||"Novedad",row.status||row.state||"Abierta"]),actions:[{label:"Abrir Excepciones",action:"navigate",module:"approvals",icon:"!"}]});
  }catch{return message({text:"No tengo permiso para leer el Centro de Excepciones con esta sesión.",actions:[{label:"Abrir módulo disponible",action:"navigate",module:"approvals"}]})}
}

export async function operationMessage(){
  const snapshot=paco.previous||await loadSnapshot();
  paco.previous=snapshot;
  return buildOperationalDigest(snapshot,{automatic:false});
}

export async function diagnoseOrder(term){
  if(!term)return message({text:"Dime el número del pedido y te digo dónde va, quién lo tiene y qué puede estarlo demorando.",actions:[{label:"Escribir número",action:"focus-input",icon:"⌕"}]});
  const result=await api.listOrders({search:term,page:1,pageSize:8,includeHistory:true,assignment:"ALL"});
  const rows=itemArray(result);
  if(!rows.length)return message({text:`No encontré un pedido visible con “${term}”.`});
  if(rows.length>1)return message({text:"Encontré varias coincidencias. Elige el pedido.",actions:[...rows.slice(0,6).map(row=>({label:orderNumber(row),sub:row.clientName||row.client_name||"Cliente",action:"diagnose-order-id",orderId:row.id||row.orderId,icon:"⌕"})),...choiceControls()]});
  return diagnoseOrderById(rows[0].id||rows[0].orderId);
}

export async function diagnoseOrderById(id){
  const [detailResult,issuesResult]=await Promise.allSettled([api.getOrder(id),api.orderIssues(id)]);
  const detail=detailResult.status==="fulfilled"?(detailResult.value?.order||detailResult.value||{}):{};
  const issues=issuesResult.status==="fulfilled"?itemArray(issuesResult.value):[];
  const openIssues=issues.filter(row=>!["RESOLVED","CLOSED","CANCELLED"].includes(String(row.status||"").toUpperCase()));
  const step=detail.currentStep||detail.current_step_code||"";
  const moduleId=STEP_MODULE[String(step).toUpperCase()]||"orders";
  const age=Number(detail.ageBusinessSeconds||detail.age_business_seconds||0);
  return message({
    text:`${orderNumber(detail)} está en ${detail.stepName||detail.currentStepName||step||"proceso"} con estado ${detail.status||"activo"}.`,
    card:[["Responsable",detail.assigneeName||detail.assignedToName||"En cola / sin asignar"],["Tiempo en etapa",age?duration(age):"—"],["Novedades abiertas",String(openIssues.length)]],
    alert:age>=ORDER_WARN_SECONDS||detail.slaExceeded||detail.sla_exceeded?{title:"Atención",text:"Este pedido lleva un tiempo considerable en su etapa actual.",tone:"warning"}:null,
    actions:[{label:"Abrir pedido",action:"open-order",orderId:id,module:"orders",icon:"→"},...(moduleId!=="orders"?[{label:`Ir a ${moduleLabel(moduleId)}`,action:"navigate",module:moduleId,icon:"↗"}]:[])]
  });
}
