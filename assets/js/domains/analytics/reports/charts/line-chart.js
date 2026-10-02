import { fmt } from "../../../../core/format.js";
import { safe, num, empty } from "../shared/report-values.js";

export function lineChart(rows,key1,key2){
  if(!rows.length)return empty("No hay serie temporal.");
  const width=Math.max(720,rows.length*32),height=245,pad={left:42,right:20,top:18,bottom:36};
  const values=rows.flatMap(row=>[num(row[key1]),key2?num(row[key2]):0]);
  const max=Math.max(1,...values);
  const x=index=>pad.left+(rows.length===1?0:index*(width-pad.left-pad.right)/(rows.length-1));
  const y=value=>pad.top+(max-num(value))*(height-pad.top-pad.bottom)/max;
  const path=key=>rows.map((row,index)=>`${index?"L":"M"}${x(index).toFixed(1)},${y(row[key]).toFixed(1)}`).join(" ");
  const labelStep=Math.max(1,Math.ceil(rows.length/9));
  return `<div class="bi-chart-scroll-v11140"><svg class="bi-line-v11140" viewBox="0 0 ${width} ${height}" role="img" aria-label="Serie temporal">
    <g class="grid">${[0,.25,.5,.75,1].map(factor=>`<line x1="${pad.left}" y1="${y(max*factor)}" x2="${width-pad.right}" y2="${y(max*factor)}"></line><text x="${pad.left-7}" y="${y(max*factor)+3}" text-anchor="end">${fmt.number(max*factor,0)}</text>`).join("")}</g>
    <path class="primary" d="${path(key1)}"></path>
    ${key2?`<path class="secondary" d="${path(key2)}"></path>`:""}
    <g class="labels">${rows.map((row,index)=>index%labelStep===0?`<text x="${x(index)}" y="${height-11}" text-anchor="middle">${safe(String(row.periodStart||"").slice(5))}</text>`:"").join("")}</g>
  </svg></div>`;
}

export function explorerLine(rows){
  return lineChart(rows.map(row=>({periodStart:row.label,value:num(row.value)})),"value",null);
}
