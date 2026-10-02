import { api } from "../../../services/api.js";
import { normalizePlannerCalendar, plannerRangeForMode } from "./index.js";
import { composePlannerTimeline } from "../timeline/index.js";
import { preparePlannerCapacity } from "./planner-capacity.js";
import { renderPlannerShell } from "./planner-shell.js";
import { preparePlannerBoard } from "./planner-board.js";
import { bindPlannerNavigation } from "./planner-navigation.js";
import { bindPlannerFilters } from "./planner-filters.js";
import { bindPlannerAssignments } from "./planner-assignments.js";
import { workforceState } from "../workforce-state.js";

export async function renderPlanner(root,content){
const planner={root,content};
await loadPlannerContext(planner);
preparePlannerCapacity(planner);
renderPlannerShell(planner);
preparePlannerBoard(planner);
bindPlannerNavigation(planner);
bindPlannerFilters(planner);
bindPlannerAssignments(planner);
}

export async function resolvePlannerCalendar(data){
  if(data?.calendar){
    workforceState.plannerCalendarCache=normalizePlannerCalendar(data.calendar);
    return workforceState.plannerCalendarCache;
  }
  if(workforceState.plannerCalendarCache)return workforceState.plannerCalendarCache;
  workforceState.plannerCalendarCache=normalizePlannerCalendar(await api.calendar());
  return workforceState.plannerCalendarCache;
}

export async function loadPlannerCatalog(){
  if(workforceState.plannerCatalogCache)return workforceState.plannerCatalogCache;
  workforceState.plannerCatalogCache=await api.workCatalog();
  return workforceState.plannerCatalogCache;
}

export async function loadPlannerContext(planner){
planner.range=plannerRangeForMode(workforceState.plannerMode,workforceState.plannerAnchor);
planner.data=await api.workPlanner(planner.range.from,planner.range.to);
planner.timeline=composePlannerTimeline(planner.data);
planner.plannerData={...planner.data,assignments:planner.timeline};
planner.calendar=await resolvePlannerCalendar(planner.data);
planner.canViewTeam=Boolean(planner.data.permissions?.canViewTeam);
planner.canPlanTeam=Boolean(planner.data.permissions?.canPlanTeam);
planner.subtitle={
    day:"Jornada laboral por horas",
    week:"Semana laboral · lunes a viernes",
    month:"Mes laboral · sin fines de semana"
  }[workforceState.plannerMode]||"Cronograma laboral";
}
