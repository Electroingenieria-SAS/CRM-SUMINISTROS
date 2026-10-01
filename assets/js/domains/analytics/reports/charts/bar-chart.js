import { fmt } from "../../../../core/format.js";
import { safe, num, metricValue, pretty, empty } from "../shared/report-values.js";

export function barPanel(title,rows=[],subtitle=""){
  return `<article class="bi-panel-v11140"><header><div><h3>${safe(title)}</h3><p>${safe(subtitle)}</p></div><span>${fmt.number(rows?.length||0)}</span></header>${bars(rows||[],"count")}</article>`;
}

export function bars(rows=[],metric="count"){
  if(!rows.length)return empty("Sin datos para este criterio.");
  const max=Math.max(1,...rows.map(row=>num(row.value)));
  return `<div class="bi-bar-list-v11140">${rows.map((row,index)=>`<div class="bi-bar-row-v11140">
    <div class="label"><strong>${index+1}. ${safe(pretty(row.label))}</strong><small>${row.records!==undefined?`${fmt.number(row.records)} registro(s)`:""}</small></div>
    <span class="bi-bar-track-v11140"><i style="width:${Math.max(2,num(row.value)/max*100)}%"></i></span>
    <b>${safe(metricValue(metric,row.value))}</b>
  </div>`).join("")}</div>`;
}
