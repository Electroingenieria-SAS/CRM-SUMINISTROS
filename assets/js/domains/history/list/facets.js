import { fmt } from "../../../core/format.js";
import { safe, n, label } from "../shared/history-values.js";

export function kpi(labelText,value,detail,tone=""){
  return `<article class="history-kpi-v11150 ${tone}"><small>${safe(labelText)}</small><strong>${safe(value)}</strong><span>${safe(detail)}</span></article>`;
}

export function pctOf(value,total){return total?`${fmt.number(n(value)/n(total)*100,1)}% del archivo`:"Sin registros"}

export function facetButtons(kind,rows=[],selected="ALL",limit=6){
  const all=`<button class="${!selected||selected==="ALL"?"active":""}" data-history-facet="${kind}" data-value="ALL">Todos</button>`;
  return all+(rows||[]).slice(0,limit).map(row=>`<button class="${String(selected)===String(row.label)?"active":""}" data-history-facet="${kind}" data-value="${safe(row.label)}">${safe(label(row.label))}<b>${fmt.number(row.value)}</b></button>`).join("");
}
