import { FINAL_STATES, fallbackEnd } from "./timeline-formatters.js";

export function timelineFromAssignment(assignment,execution,canPlanTeam){
  const actualStart=execution?.startedAt||null;
  const actualEnd=execution?.endedAt||null;
  const displayStart=actualStart||assignment.plannedStart||assignment.dueAt||null;
  const displayEnd=actualEnd||assignment.plannedEnd||fallbackEnd(displayStart,execution?.activeSeconds||assignment.estimatedMinutes*60);
  const status=execution?.status||assignment.memberStatus||"PLANNED";
  return {
    ...assignment,
    id:String(assignment.id),
    assignmentId:assignment.id,
    executionId:execution?.id||null,
    sourceType:"ASSIGNMENT",
    source:execution?.source||"PLANNED",
    scheduledStart:assignment.plannedStart||null,
    scheduledEnd:assignment.plannedEnd||null,
    actualStart,
    actualEnd,
    plannedStart:displayStart,
    plannedEnd:displayEnd,
    memberStatus:status,
    activeSeconds:Number(execution?.activeSeconds||0),
    evidenceCount:Number(execution?.evidenceCount||0),
    hasPhoto:Boolean(execution?.hasPhoto),
    previewEvidenceId:execution?.previewEvidenceId||null,
    previewDriveFileId:execution?.previewDriveFileId||null,
    canCancel:Boolean(canPlanTeam&&!execution&&!FINAL_STATES.has(String(status).toUpperCase()))
  };
}
