import { api } from "../../../services/api.js";
import { state } from "../../../core/state.js";
import { fmt } from "../../../core/format.js";
import { modal, toast } from "../../../core/ui.js";
import { roundToFiveMinutes, localDateTimeInput } from "../shared/local-dates.js";
import { requiresManagerApproval, buildActivitySchedulePayload } from "./scheduling-policy.js";

export function openActivitySchedule(browser,item){
  const roles=state.profile?.roles||[];
  const approvalRequired=requiresManagerApproval(roles);
  const start=roundToFiveMinutes(new Date());
  const minutes=Math.max(1,Number(item.medianMinutes||item.standardMinutes||60));
  const end=new Date(start.getTime()+minutes*60000);
  const view=modal({
    title:`Programar · ${item.name}`,
    confirmLabel:approvalRequired?"Enviar para aprobación":"Agregar a mi agenda",
    cancelLabel:"Cancelar",
    size:"wide",
    body:`<section class="work-schedule-dialog-intro"><span>PROGRAMACIÓN DE ACTIVIDAD</span><strong>${fmt.escape(item.name)}</strong><p>Guardar no inicia el cronómetro. La actividad comenzará únicamente cuando pulses Iniciar desde tu agenda.</p></section>
      <div class="form-grid work-schedule-dialog-grid">
        <div class="field"><label>Fecha y hora de inicio *</label><input class="control" type="datetime-local" name="plannedStart" value="${localDateTimeInput(start)}" required></div>
        <div class="field" data-estimated-end><label>Hora final estimada *</label><input class="control" type="datetime-local" name="plannedEnd" value="${localDateTimeInput(end)}" required></div>
        <label class="work-open-ended full"><input type="checkbox" name="openEnded" data-open-ended><span><strong>Sin hora final estimada</strong><small>La actividad se cerrará manualmente y el CRM conservará la hora real de finalización.</small></span></label>
        <div class="field"><label>Prioridad</label><select class="control" name="priority"><option value="MEDIUM">Media</option><option value="HIGH">Alta</option><option value="URGENT">Urgente</option><option value="LOW">Baja</option></select></div>
        <div class="field"><label>Duración de referencia (min)</label><input class="control" type="number" name="estimatedMinutes" min="1" max="1440" value="${minutes}" required></div>
        <div class="field full"><label>${approvalRequired?"Justificación para aprobación *":"Nota de planeación"}</label><textarea class="control" name="reason" rows="3" ${approvalRequired?'required minlength="10"':""} placeholder="Describe brevemente el objetivo de la actividad"></textarea></div>
      </div>
      ${approvalRequired?'<div class="work-approval-notice"><strong>Requiere aprobación</strong><p>Como auxiliar, podrás iniciar esta actividad cuando un jefe, líder o coordinador logístico la autorice.</p></div>':""}`,
    onConfirm:async dialog=>{
      const payload=buildActivitySchedulePayload({
        catalogId:item.id,
        plannedStart:dialog.querySelector('[name="plannedStart"]').value,
        plannedEnd:dialog.querySelector('[name="plannedEnd"]').value,
        openEnded:dialog.querySelector('[name="openEnded"]').checked,
        estimatedMinutes:dialog.querySelector('[name="estimatedMinutes"]').value,
        priority:dialog.querySelector('[name="priority"]').value,
        reason:dialog.querySelector('[name="reason"]').value
      });
      if(approvalRequired){
        if(payload.reason.length<10)throw new Error("La justificación debe tener al menos 10 caracteres.");
        await api.workProposeAssignment(payload);
        toast("Actividad enviada para aprobación. Todavía no puede iniciarse.","success",6500);
      }else{
        const result=await api.workSchedule({...payload,title:item.name,description:item.description||null,profileIds:[state.profile.id],evidencePolicy:item.evidencePolicy||"NONE",force:false});
        if(result?.success===false)throw new Error(result.message||"No fue posible programar la actividad.");
        toast("Actividad agregada a tu agenda. Iníciala manualmente cuando corresponda.","success",6500);
      }
      await browser.onScheduled?.();
    }
  });
  const dialog=view.root.querySelector(".modal");
  const openEnded=dialog.querySelector('[name="openEnded"]');
  const endInput=dialog.querySelector('[name="plannedEnd"]');
  const endField=dialog.querySelector("[data-estimated-end]");
  openEnded.addEventListener("change",()=>{
    endInput.disabled=openEnded.checked;
    endInput.required=!openEnded.checked;
    endField.classList.toggle("disabled",openEnded.checked);
  });
}
