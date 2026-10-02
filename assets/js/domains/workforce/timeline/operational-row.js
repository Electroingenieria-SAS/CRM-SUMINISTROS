import { fmt } from "../../../core/format.js";
import { fallbackEnd } from "./timeline-formatters.js";

export function timelineFromOperational(execution){
  const displayStart=execution.startedAt||null;
  return {
    id:String(execution.id||`order-process:${execution.taskSessionId||execution.cutExecutionId||Date.now()}`),
    assignmentId:null,
    executionId:null,
    taskSessionId:execution.taskSessionId||null,
    cutExecutionId:execution.cutExecutionId||null,
    orderTaskId:execution.orderTaskId||null,
    orderId:execution.orderId||null,
    orderNumber:execution.orderNumber||null,
    stepCode:execution.stepCode||null,
    stepName:execution.stepName||null,
    sourceType:"ORDER_PROCESS",
    source:execution.source||"ORDER_TASK",
    title:execution.title||`Pedido ${execution.orderNumber||"—"} · ${execution.stepName||fmt.step(execution.stepCode||"Proceso")}`,
    description:execution.description||null,
    kind:"ORDER_PROCESS",
    priority:"MEDIUM",
    catalogId:null,
    catalogName:execution.stepName||fmt.step(execution.stepCode||"Proceso de pedido"),
    profileId:execution.profileId,
    profileName:execution.profileName,
    scheduledStart:null,
    scheduledEnd:null,
    actualStart:displayStart,
    actualEnd:execution.endedAt||null,
    plannedStart:displayStart,
    plannedEnd:execution.endedAt||fallbackEnd(displayStart,execution.activeSeconds),
    dueAt:null,
    estimatedMinutes:Math.max(1,Math.round(Number(execution.activeSeconds||0)/60)),
    memberStatus:execution.status||"COMPLETED",
    processStatus:execution.processStatus||execution.status||null,
    orderStatus:execution.orderStatus||null,
    currentStep:execution.currentStep||execution.stepCode||null,
    activeSeconds:Number(execution.activeSeconds||0),
    evidenceCount:0,
    hasPhoto:false,
    previewEvidenceId:null,
    previewDriveFileId:null,
    canCancel:false
  };
}
