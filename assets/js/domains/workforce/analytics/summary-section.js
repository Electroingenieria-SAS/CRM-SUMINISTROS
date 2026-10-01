import { analyticsSummary, analyticsBalance } from "./analytics-summary.js";

export function analyticsSummarySectionHtml(analytics){return `
      <section class="work-indicator-section-v11383 work-indicator-section-summary-v11383">
        <header class="work-indicator-section-head-v11383">
          <div><span>RESUMEN EJECUTIVO</span><h3>Lectura rápida de la jornada</h3><p>Seis métricas clave para entender cobertura de jornada, cumplimiento, puntualidad y volumen de trabajo.</p></div>
        </header>
        ${analyticsSummary(analytics.summary)}
      </section>
`;}

export function analyticsCapacitySectionHtml(analytics){return `
      <section class="work-indicator-section-v11383">
        <header class="work-indicator-section-head-v11383">
          <div><span>JORNADA Y CAPACIDAD</span><h3>Cómo se utilizó el tiempo disponible</h3><p>Separa el tiempo identificado del tiempo que todavía no tiene categoría operativa, sin asumir improductividad.</p></div>
        </header>
        <section class="work-indicator-panel-v11363 work-indicator-panel-featured-v11383">
          <header><div><span>BALANCE DE JORNADA</span><h3>Distribución del tiempo laboral</h3><p>Jornada programada, tiempo clasificado y tiempo pendiente de categorizar en una sola lectura.</p></div></header>
          <div class="work-indicator-panel-body-v11363">${analyticsBalance(analytics.summary)}</div>
        </section>
      </section>
`;}
