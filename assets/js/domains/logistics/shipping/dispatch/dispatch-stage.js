import { api } from "../../../../services/api.js";
import { fmt } from "../../../../core/format.js";
import { toast } from "../../../../core/ui.js";
import { activeTask, actionSet, latestDelivery, guideFile } from "../shared/shipping-status.js";
import { canOperateTask } from "../permissions/shipping-permissions.js";
import { profileFor, destination } from "../routes/shipping-routes.js";
import { shell, bindFooter } from "../ui/shipping-shell.js";
import { workflowHeader } from "../ui/workflow-header.js";
import { workspace, destinationCard } from "../ui/workspace.js";
import { openGuideDialog } from "../guide/guide-dialog.js";
import { guideSummary } from "../ui/delivery-summary.js";

export function renderDispatch(host,data,{reload,refreshLists}){
  const task=activeTask(data),delivery=latestDelivery(data),place=destination(delivery,data.order),profile=profileFor(data.order);
  const started=task?.status==="IN_PROGRESS";
  const guideReady=Boolean(delivery?.tracking_number);

  if(started&&!canOperateTask(task)){
    shell(host,data,`${workflowHeader(data,"GUIDE",delivery)}${workspace(data,"GUIDE",`<div class="shipping-core-task-head-v11107"><div><span class="shipping-core-task-kicker-v11107">EN GESTIÓN</span><h4>Pedido tomado por otro responsable</h4><p>Solo el responsable actual o Jefatura puede registrar la guía y avanzar el despacho.</p></div></div>`,place)}`,{showFooter:false});
    return;
  }

  if(!started){
    const taskHtml=`<div class="shipping-core-task-head-v11107"><div><span class="shipping-core-task-kicker-v11107">PASO 1</span><h4>${fmt.escape(profile.takeTitle)}</h4><p>${fmt.escape(profile.takeCopy)}</p></div><span class="shipping-core-step-badge-v11107">Paso 1 de 3</span></div>${destinationCard(place,profile.destination)}<button type="button" class="btn btn-primary shipping-core-primary-v11107" data-take-shipping>${fmt.escape(profile.takeCta)}</button>`;
    shell(host,data,`${workflowHeader(data,"TAKE")}${workspace(data,"TAKE",taskHtml,place)}`);
    const take=async()=>{
      disableCoreActions(host,true);
      try{
        let current=data,available=actionSet(current);
        if(available.has("CLAIM")){await api.executeAction(current.order.id,"CLAIM",{detail:"Pedido tomado para despacho"},current.order.version);current=await api.getOrder(current.order.id);available=actionSet(current)}
        if(available.has("START"))await api.executeAction(current.order.id,"START",{detail:"Gestión de despacho iniciada"},current.order.version);
        else if(available.has("RESUME"))await api.executeAction(current.order.id,"RESUME",{detail:"Gestión de despacho retomada"},current.order.version);
        toast("Pedido tomado. Continúa con la guía o soporte.","success",5000);refreshLists?.();await reload?.();
      }catch(error){disableCoreActions(host,false);throw error}
    };
    host.querySelector("[data-take-shipping]")?.addEventListener("click",()=>take().catch(error=>toast(error.message,"error",7000)));
    bindFooter(host,data,{refreshLists,onNext:take});
    return;
  }

  const taskHtml=`<div class="shipping-core-task-head-v11107"><div><span class="shipping-core-task-kicker-v11107">PASO 2</span><h4>${fmt.escape(profile.guideTitle)}</h4><p>${fmt.escape(guideReady?"Los datos del transporte ya están registrados. Revísalos o continúa al cierre.":profile.guideCopy)}</p></div><span class="shipping-core-step-badge-v11107">Paso 2 de 3</span></div>
    ${guideReady?guideSummary(delivery,guideFile(data)):`<div class="shipping-core-destination-v11107"><small>Documento de transporte</small><strong>Pendiente de registrar</strong><p>El lector acepta PDF, imagen o CSV. Todo dato detectado puede corregirse manualmente.</p></div>`}
    <button type="button" class="btn ${guideReady?"btn-ghost":"btn-primary"} shipping-core-primary-v11107" data-add-guide>${guideReady?"Revisar o editar guía":"Cargar archivo o registrar manualmente"}</button>`;
  shell(host,data,`${workflowHeader(data,"GUIDE",delivery)}${workspace(data,"GUIDE",taskHtml,place)}`);

  const openGuide=()=>openGuideDialog(data,delivery,{reload,refreshLists});
  host.querySelector("[data-add-guide]")?.addEventListener("click",openGuide);

  const continueGuide=async()=>{
    if(!guideReady){openGuide();return;}
    disableCoreActions(host,true);
    try{
      await api.sendShippingToClosure(data.order.id,{detail:"Pedido despachado y enviado a cierre",expectedVersion:data.order.version});
      toast("Despacho registrado. Continúa con el cierre.","success",5500);refreshLists?.();await reload?.();
    }catch(error){disableCoreActions(host,false);throw error}
  };
  bindFooter(host,data,{refreshLists,onNext:continueGuide});
}

export function disableCoreActions(host,disabled){host.querySelectorAll("[data-take-shipping],[data-add-guide],[data-attach-closure-photo],[data-shipping-next-core]").forEach(button=>button.disabled=disabled)}
