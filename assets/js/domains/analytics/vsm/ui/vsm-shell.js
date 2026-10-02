import { loading } from "../../../../core/ui.js";

export function renderVsmShell(vsm){
vsm.root.innerHTML=`
    <section class="page-head flow-page-head-v11120">
      <div>
        <span class="flow-kicker-v11120">Control de flujo · VSM</span>
        <h2>Flujo y tiempos de la operación</h2>
        <p>Ve el recorrido completo del pedido, dónde trabaja realmente la operación, dónde espera y qué etapa está frenando el flujo.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-ghost" id="flow-help-v11120">Cómo leerlo</button>
        <button class="btn btn-primary" id="flow-export-v11120" disabled>Exportar análisis</button>
      </div>
    </section>

    <section class="flow-control-v11120" aria-label="Periodo de análisis">
      <div class="flow-presets-v11120" role="group" aria-label="Periodos rápidos">
        <button class="flow-preset-v11120" data-flow-preset="7">7 días</button>
        <button class="flow-preset-v11120 active" data-flow-preset="30">30 días</button>
        <button class="flow-preset-v11120" data-flow-preset="90">90 días</button>
      </div>
      <div class="flow-date-range-v11120">
        <label><span>Desde</span><input class="control" id="flow-from-v11120" type="date" value="${vsm.initialFrom}"></label>
        <span class="flow-date-arrow-v11120" aria-hidden="true">→</span>
        <label><span>Hasta</span><input class="control" id="flow-to-v11120" type="date" value="${vsm.to}"></label>
        <button class="btn btn-primary" id="flow-run-v11120">Actualizar</button>
      </div>
    </section>

    <div id="vsm-result">${loading("Construyendo el mapa real del flujo…")}</div>`;
}
