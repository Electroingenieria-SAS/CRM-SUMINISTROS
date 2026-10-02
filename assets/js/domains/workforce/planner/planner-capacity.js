import { teamCapacityHtml } from "./index.js";
import { workforceState } from "../workforce-state.js";

export function preparePlannerCapacity(planner){
planner.activeFilterCount=()=>[
    workforceState.plannerFilters.profileId!=="ALL",
    workforceState.plannerFilters.fromTime!=="07:00",
    workforceState.plannerFilters.toTime!=="17:30",
    workforceState.plannerMode!=="day"&&workforceState.plannerFilters.weekday!=="ALL"
  ].filter(Boolean).length;
planner.selectedWorker=()=>workforceState.plannerFilters.profileId==="ALL"
    ? null
    : (planner.data.people||[]).find(person=>String(person.id)===String(workforceState.plannerFilters.profileId))||null;
planner.capacityMarkupFor=profileId=>{
    const person=String(profileId||"ALL")==="ALL"
      ? null
      : (planner.data.people||[]).find(row=>String(row.id)===String(profileId));

    if(!person){
      return `<div class="work-capacity-empty-v11362">
        <span class="work-capacity-empty-icon-v11362">◎</span>
        <div><strong>Selecciona un trabajador</strong><p>Usa el filtro de trabajador para consultar su capacidad planificada sin mostrar toda la lista.</p></div>
      </div>`;
    }

    const assignments=planner.timeline.filter(row=>String(row.profileId)===String(person.id));
    return `<div class="work-capacity-focus-v11362">${teamCapacityHtml([person],assignments,planner.range,planner.calendar)}</div>`;
  };
planner.filterWorkerName=()=>planner.selectedWorker()?.name||"Todos";
}
