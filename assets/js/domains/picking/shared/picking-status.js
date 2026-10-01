import { ACTIVE_STATUSES } from "../picking-state.js";

export function pendingCutPickups(data){return (data.cutRequirements||[]).filter(item=>String(item.process_status||"").toUpperCase()==="READY"&&String(item.collection_status||"PENDING").toUpperCase()==="PENDING")}

export function hasCutHistory(data){return (data.cutRequirements||[]).length>0}

export function activeTask(data){return [...(data.tasks||[])].reverse().find(task=>ACTIVE_STATUSES.has(task.status))||null}

export function actionCodes(data){return new Set((data.actions?.actions||[]).map(action=>action.code))}

export function rounds(data){return data.pickingRounds||[]}

export function pendingItems(data){return (data.items||[]).filter(item=>!["FULFILLED","CANCELLED"].includes(String(item.item_status||"PENDING").toUpperCase()))}

export function hasPartialPending(data){return data?.order?.metadata?.fulfillment?.status==="PARTIAL"&&pendingItems(data).length>0}

export function assigneeName(data){const task=activeTask(data);return task?.assigned_name||data.order.current_assignee_name||data.order.metadata?.receptionAssignment?.pickingProfileName||"Auxiliar asignado"}
