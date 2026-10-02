import { api } from "../../../services/api.js";
import { wizard, toast } from "../../../core/ui.js";
import { roundToFiveMinutes, isoDate } from "../shared/local-dates.js";
import { assignmentCatalogStep } from "./assignment-catalog-step.js";
import { assignmentAssigneeStep, assignmentScheduleStep, assignmentEvidenceStep, assignmentConfirmationStep } from "./assignment-schedule-step.js";

export function assignmentWizard(data,catalog,reload,prefillDay=null,options={}){
const assignment={data,catalog,reload,prefillDay,options};
prepareAssignmentContext(assignment);
showAssignmentWizard(assignment);
}

export function prepareAssignmentContext(assignment){
assignment.permissions=assignment.data.permissions||{};
assignment.kinds=[];
if(assignment.permissions.logistics)assignment.kinds.push(["ACTIVITY","Actividad de equipo"]);
if(assignment.permissions.deliverables)assignment.kinds.push(["DELIVERABLE","Entregable de gestión"]);
assignment.defaultKind=assignment.kinds[0]?.[0]||"ACTIVITY";
assignment.day=assignment.prefillDay||isoDate(new Date());
assignment.people=assignment.data.people||[];
assignment.initialMode=assignment.options.newCatalog?"NEW":"EXISTING";
assignment.initialStart=assignment.options.startNow?roundToFiveMinutes(new Date()):new Date(`${assignment.day}T08:00:00`);
assignment.initialEnd=new Date(assignment.initialStart.getTime()+60*60000);
}

export function showAssignmentWizard(assignment){
wizard({title:assignment.options.newCatalog?"Crear y asignar nueva actividad":"Asignar trabajo",subtitle:"Usa el catálogo existente o crea una actividad nueva que quedará disponible para futuras asignaciones.",finishLabel:"Publicar asignación",size:"wide",steps:[assignmentCatalogStep(assignment),assignmentAssigneeStep(assignment),assignmentScheduleStep(assignment),assignmentEvidenceStep(assignment),assignmentConfirmationStep(assignment)],onFinish:async({form})=>{
    const mode=form.querySelector('[name="catalogMode"]:checked')?.value||"EXISTING";
    let catalogId=form.catalogId.value||null;
    if(mode==="NEW"){
      const created=await api.workCreateCatalogItem({
        kind:form.kind.value,
        name:form.newCatalogName.value,
        description:form.description.value||null,
        activityGroup:form.newCatalogGroup.value,
        standardMinutes:Number(form.estimatedMinutes.value),
        evidencePolicy:form.evidencePolicy.value,
        acceptanceRequired:form.acceptanceRequired.checked,
        teamAllowed:form.kind.value==="ACTIVITY"
      });
      catalogId=created.item?.id;
      if(!catalogId)throw new Error("No fue posible incorporar la actividad al catálogo.");
      if(created.alreadyExists)toast("Ya existía una actividad con ese nombre; se reutilizó el catálogo existente.");
      else toast("Nueva actividad agregada al catálogo.");
    }
    const payload={kind:form.kind.value,catalogId,title:form.title.value,description:form.description.value||null,profileIds:[...form.querySelectorAll('[name="profileId"]:checked')].map(i=>i.value),plannedStart:form.plannedStart.value?new Date(form.plannedStart.value).toISOString():null,plannedEnd:form.plannedEnd.value?new Date(form.plannedEnd.value).toISOString():null,dueAt:form.dueAt.value?new Date(form.dueAt.value).toISOString():null,estimatedMinutes:Number(form.estimatedMinutes.value),evidencePolicy:form.evidencePolicy.value,acceptanceRequired:form.acceptanceRequired.checked,priority:form.priority.value,force:form.force.checked,recurrence:{frequency:form.frequency.value,until:form.repeatUntil.value||null}};
    const result=await api.workSaveAssignment(payload);
    if(!result.success){const details=[...new Set((result.conflicts||[]).map(x=>x.message).filter(Boolean))].slice(0,2).join(" · ");throw new Error(`Hay ${result.conflicts?.length||1} conflicto(s) de planificación${details?`: ${details}`:""}. Regresa a Revisión y autoriza la excepción solo si realmente corresponde.`)}
    toast(result.createdIds?.length>1?`${result.createdIds.length} actividades programadas.`:"Actividad asignada.");await assignment.reload();
  }});
}
