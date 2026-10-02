import { renderValueStream } from "../charts/value-stream.js";
import { renderCurrentFlowTable, renderTimeComposition } from "../charts/current-flow.js";

export function flowMapHtml(flowView){return `
    <section class="flow-panel-v11120 flow-map-panel-v11120">
      <header class="flow-panel-head-v11120">
        <div>
          <span class="flow-section-kicker-v11120">Estado actual + comportamiento histórico</span>
          <h3>Mapa de extremo a extremo</h3>
          <p>Cada bloque representa una etapa real del pedido. Selecciona una etapa para ubicarla en las tablas de control.</p>
        </div>
        <div class="flow-legend-v11120" aria-label="Leyenda">
          <span><i class="touch"></i>Toque</span>
          <span><i class="wait"></i>Espera</span>
          <span><i class="risk"></i>Presión SLA</span>
        </div>
      </header>
      ${renderValueStream(flowView.steps)}
    </section>
`;}

export function flowCapacityHtml(flowView){return `
    <section class="flow-grid-v11120 flow-grid-primary-v11120">
      <article class="flow-panel-v11120">
        <header class="flow-panel-head-v11120 compact">
          <div><span class="flow-section-kicker-v11120">Capacidad y acumulación</span><h3>Control del flujo actual</h3><p>WIP, estados detenidos, vencimientos y antigüedad por etapa.</p></div>
        </header>
        ${renderCurrentFlowTable(flowView.steps)}
      </article>

      <article class="flow-panel-v11120">
        <header class="flow-panel-head-v11120 compact">
          <div><span class="flow-section-kicker-v11120">Trabajo vs. espera</span><h3>Composición del tiempo</h3><p>La barra separa tiempo de toque y tiempo laboral sin trabajo efectivo.</p></div>
        </header>
        ${renderTimeComposition(flowView.steps)}
      </article>
    </section>
`;}
