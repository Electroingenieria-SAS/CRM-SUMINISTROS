import { api } from "../../../../services/api.js";
import { fmt } from "../../../../core/format.js";
import { toast } from "../../../../core/ui.js";
import { activeTask, actionSet, latestDelivery, deliveryEvidence, guideFile } from "../shared/shipping-status.js";
import { profileFor, destination } from "../routes/shipping-routes.js";
import { storeShippingFile } from "../files/shipping-file.js";
import { shell, bindFooter } from "../ui/shipping-shell.js";
import { workflowHeader } from "../ui/workflow-header.js";
import { workspace } from "../ui/workspace.js";
import { disableCoreActions } from "../dispatch/dispatch-stage.js";
import { guideSummary } from "../ui/delivery-summary.js";

export function renderClosure(host,data,{reload,refreshLists}){
  const delivery=latestDelivery(data),place=destination(delivery,data.order),task=activeTask(data),evidence=deliveryEvidence(data,task?.id),profile=profileFor(data.order);
  const taskHtml=`<div class="shipping-core-task-head-v11107"><div><span class="shipping-core-task-kicker-v11107">PASO 3</span><h4>Adjunta la evidencia final</h4><p>${fmt.escape(profile.closureTitle)}. La evidencia finaliza el proceso automáticamente cuando la carga y el registro terminan correctamente.</p></div><span class="shipping-core-step-badge-v11107">Paso 3 de 3</span></div>
    ${delivery?guideSummary(delivery,guideFile(data)):""}
    ${evidence?`<div class="shipping-core-destination-v11107" data-auto-close-status><small>Evidencia</small><strong>Registrada</strong><p>Finalizando el pedido automáticamente…</p></div>`:`<input type="file" accept="image/*" capture="environment" data-closure-photo hidden><div class="shipping-core-destination-v11107"><small>Evidencia requerida</small><strong>Foto final del despacho o entrega</strong><p>Usa la cámara o selecciona una imagen existente. Después de subirla no habrá otro paso manual.</p></div><button type="button" class="btn btn-success shipping-core-primary-v11107" data-attach-closure-photo>Adjuntar evidencia y finalizar</button>`}`;
  shell(host,data,`${workflowHeader(data,"CLOSURE",delivery)}${workspace(data,"CLOSURE",taskHtml,place)}`,{nextDisabled:Boolean(evidence)});

  const input=host.querySelector("[data-closure-photo]");
  const attach=host.querySelector("[data-attach-closure-photo]");
  const choose=()=>input?.click();
  attach?.addEventListener("click",choose);
  bindFooter(host,data,{refreshLists,onNext:choose});

  if(input)input.addEventListener("change",async()=>{
    const file=input.files?.[0];
    if(!file)return;
    if(!file.type?.startsWith("image/")){toast("Debes seleccionar una imagen.","error",6500);input.value="";return}
    disableCoreActions(host,true);
    if(attach){attach.disabled=true;attach.textContent="Procesando evidencia…"}
    try{
      const current=await ensureClosureInProgress(data);
      const closureTask=activeTask(current);
      if(!closureTask?.id)throw new Error("No se encontró la tarea activa de cierre.");
      const uploaded=await storeShippingFile(current,file,"DELIVERY_EVIDENCE",closureTask.id);
      if(!uploaded?.file?.id)throw new Error("Google Drive no devolvió el archivo cargado.");
      await api.registerShippingEvidence(current.order.id,{fileId:uploaded.file.id,taskId:closureTask.id});
      await api.finalizeShipping(current.order.id,{});
      toast("Evidencia registrada. Pedido finalizado correctamente.","success",6500);host.replaceChildren();refreshLists?.();
    }catch(error){disableCoreActions(host,false);if(attach){attach.disabled=false;attach.textContent="Adjuntar evidencia y finalizar"}input.value="";toast(error.message||"No fue posible finalizar el pedido.","error",8000)}
  });

  if(evidence)queueMicrotask(async()=>{
    try{const current=await ensureClosureInProgress(data);await api.finalizeShipping(current.order.id,{});toast("Pedido finalizado correctamente.","success",5500);host.replaceChildren();refreshLists?.();}
    catch(error){const status=host.querySelector("[data-auto-close-status]");if(status)status.innerHTML=`<small>Evidencia registrada</small><strong>Pendiente de cierre</strong><p>${fmt.escape(error.message||"No fue posible cerrar automáticamente.")}</p><button type="button" class="btn btn-success shipping-core-primary-v11107" data-retry-auto-close>Reintentar cierre</button>`;host.querySelector("[data-retry-auto-close]")?.addEventListener("click",()=>renderClosure(host,data,{reload,refreshLists}))}
  });
}

export async function ensureClosureInProgress(data){
  let current=await api.getOrder(data.order.id);
  if(current?.order?.current_step_code!=="CLOSURE")throw new Error("El pedido ya no está en la etapa de cierre.");
  let task=activeTask(current);
  if(!task)throw new Error("No existe una tarea activa de cierre para este pedido.");
  if(task.status==="IN_PROGRESS")return current;
  let available=actionSet(current);
  if(available.has("CLAIM")){await api.executeAction(current.order.id,"CLAIM",{detail:"Cierre de despacho asignado automáticamente al anexar la evidencia"},current.order.version);current=await api.getOrder(current.order.id);task=activeTask(current);available=actionSet(current)}
  if(task?.status==="WAITING"||task?.status==="BLOCKED"){
    if(available.has("RESUME")){await api.executeAction(current.order.id,"RESUME",{detail:"Cierre de despacho retomado para anexar la evidencia"},current.order.version);current=await api.getOrder(current.order.id)}
  }else if(task?.status!=="IN_PROGRESS"&&available.has("START")){await api.executeAction(current.order.id,"START",{detail:"Cierre de despacho iniciado para anexar la evidencia"},current.order.version);current=await api.getOrder(current.order.id)}
  task=activeTask(current);
  if(task?.status!=="IN_PROGRESS")throw new Error("No fue posible iniciar automáticamente la etapa de cierre.");
  return current;
}
