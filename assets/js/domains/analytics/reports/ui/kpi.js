import { fmt } from "../../../../core/format.js";
import { safe, num } from "../shared/report-values.js";

export function kpi(label,value,detail,current=null,previous=null,tone=""){
  return `<article class="bi-kpi-v11140 ${tone}">
    <small>${safe(label)}</small>
    <strong>${safe(value)}</strong>
    <div class="bi-kpi-foot-v11140"><span>${safe(detail)}</span>${current!==null&&previous!==null?delta(current,previous):""}</div>
  </article>`;
}

export function delta(current,previous,invert=false){
  const cur=num(current),prev=num(previous);
  if(prev===0&&cur===0)return `<span class="bi-delta-v11140 flat">0%</span>`;
  if(prev===0)return `<span class="bi-delta-v11140 up">Nuevo</span>`;
  const change=(cur-prev)/Math.abs(prev)*100;
  const good=invert?change<0:change>0;
  const cls=Math.abs(change)<0.05?"flat":good?"up":"down";
  return `<span class="bi-delta-v11140 ${cls}">${change>0?"+":""}${fmt.number(change,1)}%</span>`;
}
