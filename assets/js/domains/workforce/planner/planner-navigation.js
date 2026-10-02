import { nextBusinessAnchor } from "./index.js";
import { renderPlanner } from "./planner-controller.js";
import { isoDate, addDays, addMonths } from "../shared/local-dates.js";
import { workforceState } from "../workforce-state.js";

export function bindPlannerNavigation(planner){
planner.move=direction=>{
    if(workforceState.plannerMode==="day")workforceState.plannerAnchor=nextBusinessAnchor(workforceState.plannerAnchor,direction,planner.calendar);
    else if(workforceState.plannerMode==="week")workforceState.plannerAnchor=addDays(workforceState.plannerAnchor,direction*7);
    else workforceState.plannerAnchor=addMonths(workforceState.plannerAnchor,direction);
    return renderPlanner(planner.root,planner.content);
  };
planner.content.querySelector("[data-plan-prev]").onclick=()=>planner.move(-1);
planner.content.querySelector("[data-plan-next]").onclick=()=>planner.move(1);
planner.content.querySelector("[data-plan-today]").onclick=()=>{
    workforceState.plannerAnchor=new Date();
    if(workforceState.plannerMode==="day"){
      const today=isoDate(workforceState.plannerAnchor);
      const visible=planner.calendar.workingWeekdays.includes(((workforceState.plannerAnchor.getDay()+6)%7)+1)&&!planner.calendar.holidayMap.has(today);
      if(!visible)workforceState.plannerAnchor=nextBusinessAnchor(workforceState.plannerAnchor,1,planner.calendar);
    }
    renderPlanner(planner.root,planner.content);
  };
planner.content.querySelectorAll("[data-plan-mode]").forEach(button=>button.onclick=()=>{
    workforceState.plannerMode=button.dataset.planMode;
    if(workforceState.plannerMode==="month")workforceState.plannerAnchor=new Date(workforceState.plannerAnchor.getFullYear(),workforceState.plannerAnchor.getMonth(),1);
    if(workforceState.plannerMode==="day"){
      const iso=isoDate(workforceState.plannerAnchor);
      const visible=planner.calendar.workingWeekdays.includes(((workforceState.plannerAnchor.getDay()+6)%7)+1)&&!planner.calendar.holidayMap.has(iso);
      if(!visible)workforceState.plannerAnchor=nextBusinessAnchor(workforceState.plannerAnchor,1,planner.calendar);
    }
    renderPlanner(planner.root,planner.content);
  });
}
