

export const ACTIVE_TASK_STATUSES=new Set(["QUEUED","ASSIGNED","IN_PROGRESS","WAITING","BLOCKED"]);

export function activeTask(data){return (data.tasks||[]).find(task=>ACTIVE_TASK_STATUSES.has(String(task.status||"").toUpperCase()))||null}

export function actionSet(data){return new Set((data.actions?.actions||[]).map(action=>action.code))}

export function latestDelivery(data){return [...(data.deliveries||[])].sort((a,b)=>new Date(b.updated_at||b.created_at)-new Date(a.updated_at||a.created_at))[0]||null}

export function deliveryEvidence(data,taskId){return (data.files||[]).filter(file=>file.file_category==="DELIVERY_EVIDENCE"&&(!taskId||file.task_id===taskId)).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))[0]||null}

export function guideFile(data){return (data.files||[]).filter(file=>file.file_category==="SHIPPING_GUIDE").sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))[0]||null}
