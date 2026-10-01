import { api } from "../../../services/api.js";
import { modal, toast } from "../../../core/ui.js";
import { renderPlanner, loadPlannerCatalog } from "./planner-controller.js";
import { assignmentWizard } from "./assignment-wizard.js";

export function cancelAssignmentDialog(id,reload){modal({title:"Cancelar asignación",confirmLabel:"Cancelar actividad",body:`<div class="field"><label>Motivo</label><textarea class="control" name="note" rows="3" placeholder="Explica por qué deja de realizarse"></textarea></div>`,onConfirm:async dialog=>{await api.workCancelAssignment(id,dialog.querySelector('[name="note"]').value||null);toast("Asignación cancelada.");await reload()}})}

export function bindPlannerAssignments(planner){
if(planner.canPlanTeam){
    planner.content.querySelector("[data-plan-new]").onclick=async()=>assignmentWizard(planner.data,await loadPlannerCatalog(),()=>renderPlanner(planner.root,planner.content),null,{newCatalog:false});
    planner.content.querySelector("[data-plan-new-custom]").onclick=async()=>assignmentWizard(planner.data,await loadPlannerCatalog(),()=>renderPlanner(planner.root,planner.content),null,{newCatalog:true,startNow:true});
  }
planner.bindCalendar();
}
