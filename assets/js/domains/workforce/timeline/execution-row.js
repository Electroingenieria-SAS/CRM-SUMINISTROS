import { fallbackEnd } from "./timeline-formatters.js";

export function timelineFromExecution(execution){
  const displayStart=execution.startedAt||null;
  return {
    id:`execution:${execution.id}`,
    assignmentId:execution.assignmentId||null,
    executionId:execution.id,
    sourceType:"EXECUTION",
    source:execution.source||"MANUAL",
    title:execution.title||execution.catalogName||"Actividad",
    kind:execution.kind||"ACTIVITY",
    priority:"MEDIUM",
    catalogId:execution.catalogId||null,
    catalogName:execution.catalogName||"Actividad",
    profileId:execution.profileId,
    profileName:execution.profileName,
    scheduledStart:null,
    scheduledEnd:null,
    actualStart:execution.startedAt||null,
    actualEnd:execution.endedAt||null,
    plannedStart:displayStart,
    plannedEnd:execution.endedAt||fallbackEnd(displayStart,execution.activeSeconds),
    dueAt:null,
    estimatedMinutes:Math.max(1,Math.round(Number(execution.activeSeconds||0)/60)),
    memberStatus:execution.status||"COMPLETED",
    activeSeconds:Number(execution.activeSeconds||0),
    evidenceCount:Number(execution.evidenceCount||0),
    hasPhoto:Boolean(execution.hasPhoto),
    previewEvidenceId:execution.previewEvidenceId||null,
    previewDriveFileId:execution.previewDriveFileId||null,
    canCancel:false
  };
}
