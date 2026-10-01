import { navigate } from "../../../core/router.js";
import { paco } from "../paco-state.js";
import { allowed } from "../context/profile-context.js";
import { message, add, typing, replaceTyping, setBusy, setFace } from "../ui/messages.js";
import { isOpen, setOpen } from "../ui/panel.js";
import { cancelFlowMessage, restartPaco } from "./conversation-flow.js";
import { testVoice } from "../voice/speech.js";
import { beginActivityFlow, categoryActivities, selectActivity, startActivity } from "./activity-selection.js";
import { deliverDigest } from "../alerts/digest.js";
import { loadSnapshot } from "../context/snapshot.js";
import { delayedMessage, unassignedOrdersMessage, shippedMessage, noveltyMessage, operationMessage, diagnoseOrderById } from "../answers/orders.js";
import { idleMessage, teamActivityMessage, longWorkMessage, recentWorkMessage } from "../answers/workforce.js";
import { capabilitiesMessage } from "../answers/capabilities.js";

export async function handleAction(button){
  const action=button.dataset.pacoAction,value=button.dataset.value;
  if(action==="navigate"){if(allowed(button.dataset.module)){navigate(button.dataset.module);setOpen(false)}return}
  if(action==="open-order"){window.dispatchEvent(new CustomEvent("erp:open-order",{detail:button.dataset.orderId}));setOpen(false);return}
  if(action==="focus-input"){const input=paco.root?.querySelector("[data-paco-input]");input?.focus();return}
  if(action==="cancel-flow"){add(cancelFlowMessage());return}
  if(action==="restart"){restartPaco();return}
  if(action==="test-voice"){testVoice();return}
  if(action==="summary-now"){
    setBusy(true);
    typing();
    try{
      const snapshot=await loadSnapshot();
      paco.previous=snapshot;
      paco.messages=paco.messages.filter(item=>item.type!=="typing");
      deliverDigest(snapshot,{automatic:false,force:true});
      setFace("talking");
    }finally{
      setBusy(false);
      setTimeout(()=>isOpen()&&setFace("listening"),700);
    }
    return;
  }
  if(action==="activity-begin"){add(await beginActivityFlow());return}
  if(action==="activity-category"){add(await categoryActivities(value));return}
  if(action==="activity-select"){add(await selectActivity(value));return}
  if(action==="activity-start"){setBusy(true);typing();try{replaceTyping(await startActivity(value))}catch(error){replaceTyping(message({text:"No pude iniciar esa actividad.",alert:{title:"Actividad",text:error.message||"Error",tone:"warning"}}))}finally{setBusy(false)}return}
  if(action==="delayed"){add(await delayedMessage());return}
  if(action==="unassigned"){add(await unassignedOrdersMessage());return}
  if(action==="idle"){add(await idleMessage());return}
  if(action==="team"){add(await teamActivityMessage());return}
  if(action==="long-work"){add(await longWorkMessage());return}
  if(action==="recent-work"){add(await recentWorkMessage());return}
  if(action==="shipped"){add(await shippedMessage());return}
  if(action==="novelties"){add(await noveltyMessage());return}
  if(action==="capabilities"){add(capabilitiesMessage());return}
  if(action==="operation"){add(await operationMessage());return}
  if(action==="diagnose-order-id"){setBusy(true);typing();try{replaceTyping(await diagnoseOrderById(button.dataset.orderId))}catch(error){replaceTyping(message({text:error.message}))}finally{setBusy(false)}return}
  throw new Error(`Acción de PACO no reconocida: ${action||"(vacía)"}`);
}

export function actionFailure(error){
  console.error("[PACO ACTION]",error);
  add(message({
    text:"No pude completar esa acción. Ya puedes corregir la consulta o reiniciar PACO sin cerrar el chat.",
    alert:{title:"La acción no se completó",text:error?.message||"Error inesperado",tone:"warning"},
    actions:[
      {label:"Reintentar consulta",action:"focus-input",kind:"primary",icon:"⌕"},
      {label:"Cancelar consulta",action:"cancel-flow",icon:"×"},
      {label:"Reiniciar PACO",action:"restart",icon:"↻"}
    ]
  }));
}

export async function runAction(button){
  try{await handleAction(button)}
  catch(error){actionFailure(error)}
}
