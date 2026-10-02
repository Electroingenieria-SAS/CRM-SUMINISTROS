

export function activeTask(data){
  return (data.tasks||[]).find(task=>["QUEUED","ASSIGNED","IN_PROGRESS","WAITING","BLOCKED"].includes(task.status))||null;
}

export function actionCodes(data){return new Set((data.actions?.actions||[]).map(action=>action.code))}

export function latestValidation(data,step){
  return [...(data.financialValidations||[])].reverse().find(row=>row.validation_type===step)||null;
}

export function statusLabel(task,closed=false){
  if(closed)return {label:"Cerrado",tone:"done",detail:"La gestión terminó y el pedido está listo para liberarse."};
  const value=task?.status;
  if(value==="IN_PROGRESS")return {label:"En gestión",tone:"working",detail:"La responsable está revisando el pedido."};
  if(value==="WAITING")return {label:"En espera",tone:"waiting",detail:"La gestión quedó pendiente de información o respuesta."};
  if(value==="BLOCKED")return {label:"Con novedad",tone:"blocked",detail:"Existe una situación que debe resolverse."};
  return {label:"Pendiente",tone:"pending",detail:"La gestión aún no ha comenzado."};
}
