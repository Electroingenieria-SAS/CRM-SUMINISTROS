export const TRAFFIC_THRESHOLDS=Object.freeze({
  warningSeconds:45*60,
  reviewSeconds:60*60
});

export function timeTrafficLight(activeSeconds=0){
  const seconds=Math.max(0,Number(activeSeconds)||0);
  if(seconds>TRAFFIC_THRESHOLDS.reviewSeconds)return {tone:"red",label:"Revisión requerida",review:true};
  if(seconds>=TRAFFIC_THRESHOLDS.warningSeconds)return {tone:"yellow",label:"Atención al tiempo",review:false};
  return {tone:"green",label:"Tiempo normal",review:false};
}

export function finalEvidenceType(policy){
  return String(policy||"").toUpperCase()==="BEFORE_AFTER"?"AFTER_PHOTO":"FINAL_PHOTO";
}

export function trafficHelp(activeSeconds=0){
  const traffic=timeTrafficLight(activeSeconds);
  if(traffic.tone==="red")return "Superó 1 hora. Al finalizar quedará pendiente de revisión.";
  if(traffic.tone==="yellow")return "Se acerca a 1 hora. Continúa si la actividad lo requiere.";
  return "El tiempo se registra automáticamente. No necesitas estimarlo.";
}

export function elapsedActiveSeconds(active){
  const base=Math.max(0,Number(active?.metrics?.activeSeconds??active?.metrics?.elapsedSeconds??0)||0);
  if(!active||active.status==="PAUSED"||!active.startedAt)return base;
  const elapsed=Math.max(0,Math.floor((Date.now()-new Date(active.startedAt).getTime())/1000));
  const paused=Math.max(0,Number(active?.metrics?.pausedSeconds||0));
  return Math.max(base,elapsed-paused);
}
