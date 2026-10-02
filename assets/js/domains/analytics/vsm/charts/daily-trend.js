import { fmt } from "../../../../core/format.js";
import { num, shortDay } from "../shared/flow-values.js";

export function renderFlowTrend(rows){
  if(!rows.length)return `<div class="flow-empty-v11120">No hay movimiento diario en el periodo.</div>`;
  const width=960,height=250,pad={left:42,right:20,top:18,bottom:36};
  const innerW=width-pad.left-pad.right,innerH=height-pad.top-pad.bottom;
  const maxValue=Math.max(1,...rows.flatMap(row=>[num(row.created),num(row.closed),num(row.wipAtEnd)]));
  const group=innerW/rows.length;
  const barW=Math.max(2,Math.min(10,group*.23));
  const y=value=>pad.top+innerH-(num(value)/maxValue*innerH);
  const wipPoints=rows.map((row,index)=>`${pad.left+group*(index+.5)},${y(row.wipAtEnd)}`).join(" ");
  const tickEvery=Math.max(1,Math.ceil(rows.length/7));
  const bars=rows.map((row,index)=>{
    const center=pad.left+group*(index+.5);
    const createdH=innerH-(y(row.created)-pad.top);
    const closedH=innerH-(y(row.closed)-pad.top);
    return `<rect class="created" x="${center-barW-1}" y="${y(row.created)}" width="${barW}" height="${createdH}" rx="2"></rect><rect class="closed" x="${center+1}" y="${y(row.closed)}" width="${barW}" height="${closedH}" rx="2"></rect>`;
  }).join("");
  const labels=rows.map((row,index)=>index%tickEvery===0||index===rows.length-1?`<text x="${pad.left+group*(index+.5)}" y="${height-10}" text-anchor="middle">${fmt.escape(shortDay(row.day))}</text>`:"").join("");
  const grid=[0,.25,.5,.75,1].map(ratio=>{
    const value=maxValue*ratio,cy=pad.top+innerH*(1-ratio);
    return `<line x1="${pad.left}" y1="${cy}" x2="${width-pad.right}" y2="${cy}"></line><text x="${pad.left-7}" y="${cy+4}" text-anchor="end">${fmt.number(value,0)}</text>`;
  }).join("");

  return `<div class="flow-trend-v11120">
    <div class="flow-chart-legend-v11120"><span><i class="created"></i>Creados</span><span><i class="closed"></i>Cerrados</span><span><i class="wip"></i>WIP al cierre del día</span></div>
    <div class="flow-chart-scroll-v11120"><svg class="flow-chart-v11120" viewBox="0 0 ${width} ${height}" role="img" aria-label="Tendencia diaria de creados, cerrados y WIP">
      <g class="grid">${grid}</g><g class="bars">${bars}</g><polyline class="wip-line" points="${wipPoints}"></polyline><g class="labels">${labels}</g>
    </svg></div>
    <details class="flow-daily-details-v11120"><summary>Ver cifras diarias</summary>
      <div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Creados</th><th>Cerrados</th><th>Balance</th><th>WIP fin de día</th></tr></thead><tbody>
      ${rows.map(row=>{const balance=num(row.closed)-num(row.created);return `<tr><td>${fmt.day(row.day)}</td><td>${fmt.number(row.created)}</td><td>${fmt.number(row.closed)}</td><td class="${balance>=0?"success":"warning"}">${balance>0?"+":""}${fmt.number(balance)}</td><td>${fmt.number(row.wipAtEnd)}</td></tr>`}).join("")}
      </tbody></table></div>
    </details>
  </div>`;
}
