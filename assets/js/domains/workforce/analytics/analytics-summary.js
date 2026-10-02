import { fmt } from "../../../core/format.js";

export function analyticsSummary(s={}){
  const scheduled=Math.max(0,Number(s.scheduledBusinessSeconds||0));
  const classified=Math.max(0,Number(s.classifiedBusinessSeconds||0));
  const unclassified=Math.max(0,Number(s.unclassifiedBusinessSeconds||0));
  const util=Math.max(0,Math.min(100,Number(s.utilizationPct||0)));
  const onTime=Math.max(0,Math.min(100,Number(s.onTimePct||0)));
  const adherence=Math.max(0,Math.min(100,Number(s.startAdherencePct||0)));
  const completed=Number(s.completedAssignments||0);
  const reviews=Number(s.pendingReviews||0);
  const uncPct=scheduled>0?Math.max(0,Math.min(100,100*unclassified/scheduled)):0;
  return `<section class="work-indicator-metrics-v11363">
    ${indicatorMetric("Jornada clasificada",`${fmt.number(util,1)}%`,`${fmt.hours(classified)} de ${fmt.hours(scheduled)}`,"blue",util,"Tiempo identificado dentro de la jornada laboral")}
    ${indicatorMetric("Sin categoría",fmt.hours(unclassified),`${fmt.number(uncPct,1)}% de la jornada`,"amber",uncPct,"No equivale automáticamente a improductividad")}
    ${indicatorMetric("Cumplimiento",`${fmt.number(onTime,1)}%`,`${fmt.number(completed)} completada${completed===1?"":"s"}`,"green",onTime,"Finalizadas dentro del compromiso")}
    ${indicatorMetric("Inicio según plan",`${fmt.number(adherence,1)}%`,"Ventana de ±5 minutos","violet",adherence,"Adherencia al bloque programado")}
    ${indicatorMetric("Actividad completada",fmt.number(completed),s.people?`${fmt.number(s.people)} persona${Number(s.people)===1?"":"s"} en el ámbito`:"Periodo seleccionado","cyan",Math.min(100,completed*10),"Volumen de asignaciones terminadas")}
    ${indicatorMetric("En revisión",fmt.number(reviews),reviews?"Requieren decisión":"Sin entregables pendientes","rose",reviews?Math.min(100,25+reviews*15):0,"Entregables enviados para aceptación")}
  </section>`;
}

export function indicatorMetric(label,value,detail,tone,progress,help){
  return `<article class="work-indicator-metric-v11363 tone-${tone}">
    <div class="work-indicator-metric-top-v11363"><span>${fmt.escape(label)}</span><i></i></div>
    <strong>${value}</strong>
    <small>${detail}</small>
    <div class="work-indicator-metric-progress-v11363"><span style="--metric-progress:${Math.max(0,Math.min(100,Number(progress||0)))}%"></span></div>
    <p>${fmt.escape(help)}</p>
  </article>`;
}

export function analyticsBalance(s={}){
  const scheduled=Math.max(0,Number(s.scheduledBusinessSeconds||0));
  const classified=Math.max(0,Number(s.classifiedBusinessSeconds||0));
  const unclassified=Math.max(0,Number(s.unclassifiedBusinessSeconds||0));
  const total=Math.max(1,scheduled||classified+unclassified);
  const classifiedPct=Math.max(0,Math.min(100,100*classified/total));
  const unclassifiedPct=Math.max(0,Math.min(100,100*unclassified/total));
  return `<div class="work-indicator-balance-visual-v11363">
    <div class="work-indicator-balance-bar-v11363"><span class="classified" style="--balance-size:${classifiedPct}%"></span><span class="unclassified" style="--balance-size:${unclassifiedPct}%"></span></div>
    <div class="work-indicator-balance-legend-v11363">
      <div><i class="classified"></i><span>Clasificado</span><strong>${fmt.hours(classified)}</strong><small>${fmt.number(classifiedPct,1)}%</small></div>
      <div><i class="unclassified"></i><span>Sin categoría</span><strong>${fmt.hours(unclassified)}</strong><small>${fmt.number(unclassifiedPct,1)}%</small></div>
      <div><i class="scheduled"></i><span>Jornada programada</span><strong>${fmt.hours(scheduled)}</strong><small>base</small></div>
    </div>
  </div>`;
}
