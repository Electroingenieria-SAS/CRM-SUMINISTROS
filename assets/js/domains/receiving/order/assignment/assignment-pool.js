import { api } from "../../../../services/api.js";
import { fmt } from "../../../../core/format.js";
import { toast } from "../../../../core/ui.js";
import { renderWorkbench } from "../reception-controller.js";
import { assignmentStage } from "../stages/assignment.js";
import { confirmReception } from "../actions/confirm-reception.js";
import { persistDraft } from "../draft/reception-draft.js";

export async function loadAssignmentStage(host,data,draft,callbacks){
  const mount=host.querySelector("[data-assignment-content]");
  if(!mount)return;
  try{
    const [pickingRaw,cutRaw]=await Promise.all([api.assignmentPool("ALISTAMIENTO"),api.assignmentPool("CORTE")]);
    const pickingPool=(pickingRaw||[]).filter(person=>(person.roles||[]).includes("aux_logistica"));
    const cutPool=(cutRaw||[]).filter(person=>(person.roles||[]).includes("auxiliar_corte"));
    mount.closest(".reception-stage-card").outerHTML=assignmentStage(data,draft,pickingPool,cutPool);
    bindAssignmentControls(host,data,draft,callbacks,pickingPool,cutPool);
  }catch(error){mount.innerHTML=`<div class="reception-file-warning"><strong>No fue posible cargar los auxiliares.</strong><p>${fmt.escape(error.message)}</p></div>`}
}

export function bindAssignmentControls(host,data,draft,callbacks,pickingPool,cutPool){
  const picking=host.querySelector("[data-picking-profile]");
  const cut=host.querySelector("[data-cut-profile]");
  picking?.addEventListener("change",()=>{draft.pickingProfileId=picking.value;persistDraft(data.order.id,draft)});
  cut?.addEventListener("change",()=>{draft.cutProfileId=cut.value;persistDraft(data.order.id,draft)});
  host.querySelector("[data-back-lines]")?.addEventListener("click",()=>{draft.stage=draft.mode==="PDF"?"EDIT":"REVIEW";persistDraft(data.order.id,draft);renderWorkbench(host,data,draft,callbacks)});
  host.querySelector("[data-confirm-reception]")?.addEventListener("click",()=>{
    const hasCuts=draft.lines.some(line=>line.requiresCut);
    draft.pickingProfileId=picking?.value||"";
    draft.cutProfileId=cut?.value||"";
    if(!draft.pickingProfileId)return toast("Selecciona el auxiliar de alistamiento.","error");
    if(!pickingPool.some(person=>person.id===draft.pickingProfileId))return toast("El auxiliar de alistamiento seleccionado ya no está disponible.","error");
    if(hasCuts&&!draft.cutProfileId)return toast("Selecciona el auxiliar de corte.","error");
    if(hasCuts&&!cutPool.some(person=>person.id===draft.cutProfileId))return toast("El auxiliar de corte seleccionado ya no está disponible.","error");
    persistDraft(data.order.id,draft);
    confirmReception(host,data,draft,callbacks);
  });
}
