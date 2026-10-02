import { fmt } from "../../../../core/format.js";
import { num } from "../shared/flow-values.js";
import { renderFlowTrend } from "../charts/daily-trend.js";

export function flowDailyHtml(flowView){return `
    <section class="flow-panel-v11120">
      <header class="flow-panel-head-v11120">
        <div>
          <span class="flow-section-kicker-v11120">Demanda, salida y acumulación</span>
          <h3>Comportamiento diario del sistema</h3>
          <p>Compara pedidos creados y cerrados con el WIP estimado al final de cada día.</p>
        </div>
        <div class="flow-balance-v11120">
          <span>Entraron <strong>${fmt.number(flowView.throughput.reduce((sum,row)=>sum+num(row.created),0))}</strong></span>
          <span>Salieron <strong>${fmt.number(flowView.throughput.reduce((sum,row)=>sum+num(row.closed),0))}</strong></span>
        </div>
      </header>
      ${renderFlowTrend(flowView.throughput)}
    </section>
`;}
