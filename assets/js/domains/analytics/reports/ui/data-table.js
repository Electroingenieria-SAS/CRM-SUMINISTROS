import { safe, metricValue } from "../shared/report-values.js";

export function genericTable(rows,columns,metric){
  return `<div class="bi-table-wrap-v11140"><table class="bi-table-v11140"><thead><tr>${columns.map(([,label])=>`<th>${safe(label)}</th>`).join("")}</tr></thead><tbody>${rows.map(row=>`<tr>${columns.map(([key])=>`<td>${key==="value"?safe(metricValue(metric,row[key])):safe(row[key])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
