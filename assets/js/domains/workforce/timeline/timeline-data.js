import { timelineFromAssignment } from "./assignment-row.js";
import { timelineFromExecution } from "./execution-row.js";
import { timelineFromOperational } from "./operational-row.js";
import { dateValue } from "./timeline-formatters.js";

export function composePlannerTimeline(raw={}){
  const assignments=Array.isArray(raw.assignments)?raw.assignments:[];
  const executions=Array.isArray(raw.executions)?raw.executions:[];
  const operationalExecutions=Array.isArray(raw.operationalExecutions)?raw.operationalExecutions:[];
  const canPlanTeam=Boolean(raw.permissions?.canPlanTeam);
  const byAssignment=new Map();

  for(const execution of executions){
    if(!execution?.assignmentId)continue;
    const key=timelineAssignmentKey(execution.assignmentId,execution.profileId);
    const previous=byAssignment.get(key);
    if(!previous||dateValue(execution.startedAt)>dateValue(previous.startedAt))byAssignment.set(key,execution);
  }

  const matched=new Set();
  const timeline=assignments.map(assignment=>{
    const key=timelineAssignmentKey(assignment.id,assignment.profileId);
    const execution=byAssignment.get(key)||null;
    if(execution)matched.add(execution.id);
    return timelineFromAssignment(assignment,execution,canPlanTeam);
  });

  for(const execution of executions){
    if(matched.has(execution.id))continue;
    timeline.push(timelineFromExecution(execution));
  }

  for(const execution of operationalExecutions){
    timeline.push(timelineFromOperational(execution));
  }

  timeline.sort((a,b)=>dateValue(a.plannedStart||a.dueAt)-dateValue(b.plannedStart||b.dueAt)||String(a.title||"").localeCompare(String(b.title||""),"es"));
  return timeline;
}

export function timelineDetailRequest(item={}){
  return {
    assignmentId:item.assignmentId||null,
    executionId:item.executionId||null,
    profileId:item.profileId||null
  };
}

export function timelineAssignmentKey(assignmentId,profileId){
  return `${String(assignmentId||"")}:${String(profileId||"")}`;
}
