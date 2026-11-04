// Toda cuenta operativa activa puede autoprogramar sus propias actividades.
export function requiresManagerApproval(_roles=[]){
  return false;
}
export function buildActivitySchedulePayload({catalogId,plannedStart,plannedEnd,openEnded=false,estimatedMinutes=60,priority="MEDIUM",reason=""}={}){
  if(!catalogId)throw new Error("Selecciona una actividad.");
  if(!plannedStart)throw new Error("Indica la fecha y hora de inicio.");
  const start=new Date(plannedStart);
  if(Number.isNaN(start.getTime()))throw new Error("La fecha de inicio no es válida.");
  let end=null;
  if(!openEnded){
    if(!plannedEnd)throw new Error("Indica una hora final o marca Sin hora final estimada.");
    end=new Date(plannedEnd);
    if(Number.isNaN(end.getTime()))throw new Error("La fecha final no es válida.");
    if(end<=start)throw new Error("La hora final debe ser posterior al inicio.");
  }
  const minutes=Math.max(1,Math.min(1440,Number(estimatedMinutes)||60));
  return {
    catalogId,
    plannedStart:start.toISOString(),
    plannedEnd:end?.toISOString()||null,
    openEnded:Boolean(openEnded),
    estimatedMinutes:minutes,
    priority:String(priority||"MEDIUM").toUpperCase(),
    reason:String(reason||"").trim(),
    startMode:"SCHEDULED"
  };
}
