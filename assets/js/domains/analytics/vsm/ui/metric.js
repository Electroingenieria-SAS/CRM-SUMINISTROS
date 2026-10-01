import { fmt } from "../../../../core/format.js";

export function metric(label,value,detail,tone){
  return `<article class="flow-metric-v11120 ${tone}"><span>${fmt.escape(label)}</span><strong>${fmt.escape(String(value))}</strong><small>${fmt.escape(detail)}</small></article>`;
}

export function coverageLabel(level){
  return level==="good"?"Muestra sólida":level==="medium"?"Muestra moderada":"Muestra inicial";
}
