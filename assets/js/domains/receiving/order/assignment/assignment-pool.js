import { api } from "../../../../services/api.js";
import { fmt } from "../../../../core/format.js";
import { toast } from "../../../../core/ui.js";
import { renderWorkbench } from "../reception-controller.js";
import { assignmentStage } from "../stages/assignment.js";
import { confirmReception } from "../actions/confirm-reception.js";
import { persistDraft } from "../draft/reception-draft.js";
import { bindCorrectionPdf } from "../pdf/correction-upload.js";
import { receptionLotReviewCards, bindReceptionLotReviewCards, assertReceptionLotReview } from "./lot-review.js";
import { loadReceptionOriginPlans, receptionOriginCards, bindReceptionOriginCards, assertReceptionOriginCards } from "./lot-selection.js";

export async function loadAssignmentStage(host,data,draft,callbacks){
  const mount=host.querySelector("[data-assignment-content]");
  if(!mount)return;
  try{
    const [pickingRaw,cutRaw,originPlans]=await Promise.all([api.assignmentPool("ALISTAMIENTO"),api.assignmentPool("CORTE"),loadReceptionOriginPlans(draft.lines)]);
    const pickingPool=(pickingRaw||[]).filter(person=>(person.roles||[]).includes("aux_logistica"));
    const cutPool=(cutRaw||[]).filter(person=>(person.roles||[]).includes("auxiliar_corte"));
    const logisticIds=new Set(pickingPool.map(person=>person.id));
    const polyvalentPool=cutPool.filter(person=>logisticIds.has(person.id));
    mount.closest(".reception-stage-card").outerHTML=assignmentStage(data,draft,pickingPool,cutPool,polyvalentPool,receptionOriginCards(draft.lines,originPlans),receptionLotReviewCards(draft.lines));
    bindAssignmentControls(host,data,draft,callbacks,pickingPool,cutPool,polyvalentPool,originPlans);
  }catch(error){mount.innerHTML=`<div class="reception-file-warning"><strong>No fue posible cargar los auxiliares.</strong><p>${fmt.escape(error.message)}</p></div>`}
}

export function bindAssignmentControls(host,data,draft,callbacks,pickingPool,cutPool,polyvalentPool,originPlans=[]){
  bindCorrectionPdf(host,data,draft,callbacks);
  bindReceptionLotReviewCards(host,data,draft,persistDraft);
  bindReceptionOriginCards(host,data,draft,originPlans,persistDraft);
  const picking=host.querySelector("[data-picking-profile]");
  const cut=host.querySelector("[data-cut-profile]");
  const helper=host.querySelector("[data-cut-pickup-profile]");
  picking?.addEventListener("change",()=>{draft.pickingProfileId=picking.value;persistDraft(data.order.id,draft)});
  cut?.addEventListener("change",()=>{draft.cutProfileId=cut.value;persistDraft(data.order.id,draft)});
  helper?.addEventListener("change",()=>{draft.cutPickupProfileId=helper.value;persistDraft(data.order.id,draft)});
  host.querySelector("[data-back-lines]")?.addEventListener("click",()=>{draft.stage=draft.mode==="PDF"?"EDIT":"REVIEW";persistDraft(data.order.id,draft);renderWorkbench(host,data,draft,callbacks)});
  host.querySelector("[data-confirm-reception]")?.addEventListener("click",()=>{
    const hasCuts=draft.lines.some(line=>line.requiresCut);
    const needsGeneral=draft.lines.some(line=>!line.requiresCut);
    draft.pickingProfileId=needsGeneral?(picking?.value||""):"";
    draft.cutProfileId=cut?.value||"";
    draft.cutPickupProfileId=helper?.value||"";
    if(needsGeneral&&!draft.pickingProfileId)return toast("Selecciona el auxiliar de alistamiento general.","error");
    if(needsGeneral&&!pickingPool.some(person=>person.id===draft.pickingProfileId))return toast("El auxiliar de alistamiento general seleccionado ya no está disponible.","error");
    if(hasCuts&&!draft.cutProfileId)return toast("Selecciona el auxiliar de corte.","error");
    if(hasCuts&&!cutPool.some(person=>person.id===draft.cutProfileId))return toast("El auxiliar de corte seleccionado ya no está disponible.","error");
    if(hasCuts&&!draft.cutPickupProfileId)return toast("Selecciona el auxiliar polivalente de alistamiento de Corte.","error");
    if(hasCuts&&!polyvalentPool.some(person=>person.id===draft.cutPickupProfileId))return toast("El auxiliar de alistamiento de Corte debe tener los roles de Corte y Logística.","error");
    if(hasCuts&&draft.cutPickupProfileId===draft.cutProfileId)return toast("La persona que corta no puede ser simultáneamente su propio ayudante.","error");
    if(hasCuts&&draft.cutPickupProfileId===draft.pickingProfileId)return toast("El alistamiento general y la recogida desde Corte deben tener responsables distintos.","error");
    try{assertReceptionLotReview(draft);assertReceptionOriginCards(host,draft,originPlans)}catch(error){return toast(error.message,"error",7000)}
    persistDraft(data.order.id,draft);
    confirmReception(host,data,draft,callbacks);
  });
}
