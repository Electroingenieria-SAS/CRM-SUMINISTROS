import { toast } from "../../../core/ui.js";
import { renderPlanner } from "./planner-controller.js";
import { workforceState } from "../workforce-state.js";

export function bindPlannerFilters(planner){
planner.workerFilter=planner.content.querySelector("[data-plan-filter-worker]");
if(planner.workerFilter)planner.workerFilter.onchange=()=>{
    workforceState.plannerFilters.profileId=planner.workerFilter.value||"ALL";
    planner.repaintCalendar();
  };
planner.fromFilter=planner.content.querySelector("[data-plan-filter-from]");
planner.toFilter=planner.content.querySelector("[data-plan-filter-to]");
planner.applyTimeFilters=()=>{
    const from=planner.fromFilter?.value||"07:00";
    const to=planner.toFilter?.value||"17:30";
    if(from>=to){
      toast("La hora inicial debe ser anterior a la hora final.","warning");
      if(planner.fromFilter)planner.fromFilter.value=workforceState.plannerFilters.fromTime;
      if(planner.toFilter)planner.toFilter.value=workforceState.plannerFilters.toTime;
      return;
    }
    workforceState.plannerFilters.fromTime=from;
    workforceState.plannerFilters.toTime=to;
    planner.repaintCalendar();
  };
if(planner.fromFilter)planner.fromFilter.onchange=planner.applyTimeFilters;
if(planner.toFilter)planner.toFilter.onchange=planner.applyTimeFilters;
planner.weekdayFilter=planner.content.querySelector("[data-plan-filter-weekday]");
if(planner.weekdayFilter)planner.weekdayFilter.onchange=()=>{
    workforceState.plannerFilters.weekday=planner.weekdayFilter.value||"ALL";
    planner.repaintCalendar();
  };
planner.dateFilter=planner.content.querySelector("[data-plan-filter-date]");
if(planner.dateFilter)planner.dateFilter.onchange=()=>{
    const [year,month,day]=String(planner.dateFilter.value||"").split("-").map(Number);
    if(!year||!month||!day)return;
    workforceState.plannerAnchor=new Date(year,month-1,day);
    renderPlanner(planner.root,planner.content);
  };
planner.resetFilters=planner.content.querySelector("[data-plan-filter-reset]");
if(planner.resetFilters)planner.resetFilters.onclick=()=>{
    workforceState.plannerFilters={profileId:"ALL",weekday:"ALL",fromTime:"07:00",toTime:"17:30"};
    if(planner.workerFilter)planner.workerFilter.value="ALL";
    if(planner.fromFilter)planner.fromFilter.value="07:00";
    if(planner.toFilter)planner.toFilter.value="17:30";
    if(planner.weekdayFilter)planner.weekdayFilter.value="ALL";
    planner.repaintCalendar();
  };
planner.filterBox=planner.content.querySelector("[data-plan-filter-box]");
planner.filterClose=planner.content.querySelector("[data-plan-filter-close]");
if(planner.filterClose)planner.filterClose.onclick=()=>{if(planner.filterBox)planner.filterBox.open=false;};
}
