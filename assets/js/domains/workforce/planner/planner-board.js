import { api } from "../../../services/api.js";
import { toast } from "../../../core/ui.js";
import { renderWorkforceCalendarBoard, bindWorkforceCalendar } from "../calendar/index.js";
import { workEvidenceManager } from "../evidence/evidence-preview-store.js";
import { renderPlanner, loadPlannerCatalog } from "./planner-controller.js";
import { assignmentWizard } from "./assignment-wizard.js";
import { cancelAssignmentDialog } from "./planner-assignments.js";
import { workforceState } from "../workforce-state.js";

export function preparePlannerBoard(planner){
planner.calendarHost=planner.content.querySelector("[data-planner-calendar-host]");
planner.bindCalendar=()=>{
    workforceState.plannerCalendarCleanup?.();
    workforceState.plannerCalendarCleanup=bindWorkforceCalendar({
      container:planner.calendarHost,
      items:planner.timeline,
      api,
      evidenceManager:workEvidenceManager,
      canPlanTeam:planner.canPlanTeam,
      notify:toast,
      onPlanDay:async day=>{
        assignmentWizard(planner.data,await loadPlannerCatalog(),()=>renderPlanner(planner.root,planner.content),day);
      },
      onCancel:assignmentId=>{
        cancelAssignmentDialog(assignmentId,()=>renderPlanner(planner.root,planner.content));
      },
      onActiveProfile:()=>{
        toast("La actividad actual todavía no tiene detalle disponible en este rango.","warning");
      }
    });
  };
planner.repaintCalendar=()=>{
    if(!planner.calendarHost)return;
    planner.calendarHost.innerHTML=renderWorkforceCalendarBoard({
      mode:workforceState.plannerMode,
      anchor:workforceState.plannerAnchor,
      data:planner.plannerData,
      calendar:planner.calendar,
      filters:workforceState.plannerFilters
    });
    planner.bindCalendar();
    planner.renderCapacityPanel();
    planner.syncFilterSummary();
  };
planner.capacityHost=planner.content.querySelector("[data-team-capacity-host]");
planner.capacityLabel=planner.content.querySelector("[data-team-capacity-label]");
planner.renderCapacityPanel=()=>{
    if(!planner.capacityHost)return;
    planner.capacityHost.innerHTML=planner.capacityMarkupFor(workforceState.plannerFilters.profileId);
    if(planner.capacityLabel)planner.capacityLabel.textContent=planner.selectedWorker()?.name||"Selecciona un trabajador en Filtros";
  };
planner.syncFilterSummary=()=>{
    const count=planner.activeFilterCount();
    const countNode=planner.content.querySelector("[data-plan-filter-count]");
    const summaryNode=planner.content.querySelector("[data-plan-filter-summary]");
    if(countNode){
      countNode.hidden=!count;
      countNode.textContent=String(count);
    }
    if(summaryNode)summaryNode.textContent=count?`${count} activos · ${planner.filterWorkerName()}`:"Sin filtros activos";
  };
}
