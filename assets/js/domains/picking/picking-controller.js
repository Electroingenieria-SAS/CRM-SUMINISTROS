import { fmt } from "../../core/format.js";
import { toast } from "../../core/ui.js";
import { renderCutPickup } from "./pickup/cut-pickup-stage.js";
import { renderVerification } from "./verification/verification-controller.js";
import { renderPartialResume } from "./partial/partial-resume.js";
import { shell, bindClose } from "./ui/picking-shell.js";
import { beginPicking } from "./actions/start-picking.js";
import { pendingCutPickups, activeTask, actionCodes, rounds, hasPartialPending, assigneeName } from "./shared/picking-status.js";
import { enhancePickingExperience } from "./ui/picking-focus.js";

export function isPickingFlow(data){
  return data?.order?.current_step_code==="ALISTAMIENTO"||hasPartialPending(data);
}

export function renderPickingFlow(host,data,{reload,refreshLists}={}){
  if(data.order.current_step_code!=="ALISTAMIENTO"){
    renderPartialResume(host,data,{reload,refreshLists});
    enhancePickingExperience(host);
    return;
  }

  const task=activeTask(data);
  if(!task){
    host.innerHTML=shell(data,`<section class="picking-empty"><strong>No existe una tarea activa de Alistamiento.</strong><p>Solicita revisión del flujo antes de continuar.</p></section>`);
    bindClose(host);
    enhancePickingExperience(host);
    return;
  }

  const actions=actionCodes(data);
  if(task.status!=="IN_PROGRESS"){
    const resumed=rounds(data).length>0;
    const hasPickup=pendingCutPickups(data).length>0;
    const label=hasPickup?"Tomar pedido para recoger cortes":resumed?"Retomar pedido":"Tomar pedido";
    const canStart=actions.has("CLAIM")||actions.has("START")||actions.has("RESUME");
    host.innerHTML=shell(data,`
      <section class="picking-take-card ${hasPickup?"cut-pickup-take":""}">
        <span class="picking-step-tag">${hasPickup?"Cortes listos":resumed?`Ronda ${rounds(data).length+1}`:"Paso 1"}</span>
        <h4>${label}</h4>
        <p>${hasPickup?`Hay ${pendingCutPickups(data).length} referencia(s) terminada(s) por recoger antes de verificar el resto de la mercancía.`:resumed?"Solo se verificarán las referencias que quedaron pendientes en la salida anterior.":"Al tomarlo quedará asignado a tu usuario y podrás verificar la mercancía línea por línea."}</p>
        <button type="button" class="btn btn-primary picking-take-button" data-picking-take ${canStart?"":"disabled"}>${label}</button>
        ${canStart?"":`<div class="picking-warning">Responsable actual: <strong>${fmt.escape(assigneeName(data))}</strong></div>`}
      </section>`);
    bindClose(host);
    host.querySelector("[data-picking-take]")?.addEventListener("click",async event=>{
      const button=event.currentTarget;
      button.disabled=true;
      try{
        await beginPicking(data);
        refreshLists?.();
        await reload?.();
      }catch(error){
        toast(error.message,"error",7000);
        button.disabled=false;
      }
    });
    enhancePickingExperience(host);
    return;
  }

  if(!actions.has("COMPLETE")){
    host.innerHTML=shell(data,`<section class="picking-empty"><strong>Pedido en gestión</strong><p>Este pedido está bloqueado para evitar verificaciones simultáneas.</p><div class="picking-warning">Responsable: <strong>${fmt.escape(assigneeName(data))}</strong></div></section>`);
    bindClose(host);
    enhancePickingExperience(host);
    return;
  }

  if(pendingCutPickups(data).length){
    renderCutPickup(host,data,{reload,refreshLists});
    enhancePickingExperience(host);
    return;
  }

  renderVerification(host,data,{reload,refreshLists})
    .then(()=>enhancePickingExperience(host))
    .catch(error=>{toast(error.message,"error",7500);host.replaceChildren();});
}
