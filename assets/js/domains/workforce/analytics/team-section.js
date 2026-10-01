import { fmt } from "../../../core/format.js";
import { icon } from "../../../core/icons.js";
import { teamNowHtml, pendingReviewsHtml } from "./team-now.js";

export function analyticsTeamSectionHtml(analytics){return `
      <section class="work-indicator-section-v11383">
        <header class="work-indicator-section-head-v11383">
          <div><span>OPERACIÓN ACTUAL</span><h3>Quién está ejecutando actividades ahora</h3><p>Vista separada del estado actual del equipo para no mezclar información en tiempo real con el histórico del periodo.</p></div>
        </header>
        <section class="work-indicator-panel-v11363 work-indicator-panel-featured-v11383">
          <header><div><span>EN ESTE MOMENTO</span><h3>Equipo activo</h3><p>Actividades adicionales que están corriendo o pausadas en este momento.</p></div></header>
          <div class="work-indicator-panel-body-v11363">${teamNowHtml(analytics.data.teamNow||[])}</div>
        </section>
      </section>

      `;}

export function analyticsReviewsSectionHtml(analytics){return `${analytics.data.pendingReviews?.length?`<section class="work-indicator-section-v11383"><header class="work-indicator-section-head-v11383"><div><span>REVISIÓN</span><h3>Entregables que requieren decisión</h3><p>Elementos enviados para aceptación o devolución con trazabilidad de evidencia.</p></div></header><section class="work-indicator-panel-v11363 work-review-card-v11363"><header><div><span>PENDIENTES</span><h3>Entregables pendientes</h3><p>Aceptar confirma el resultado; devolver exige una nota para corrección.</p></div><b>${fmt.number(analytics.data.pendingReviews.length)}</b></header><div class="work-indicator-panel-body-v11363">${pendingReviewsHtml(analytics.data.pendingReviews)}</div></section></section>`:""}`;}

export function analyticsMethodSectionHtml(analytics){return `
      <details class="work-indicator-method-v11363">
        <summary>${icon("audit")}<div><strong>Cómo leer estos indicadores</strong><small>Metodología y límites de interpretación</small></div><b>⌄</b></summary>
        <div><p><strong>Utilización, puntualidad y duración describen procesos y capacidad.</strong> No constituyen por sí solos una calificación de desempeño.</p><p>El CRM conserva tiempo no clasificado como <b>“sin categoría”</b>; no lo interpreta automáticamente como improductividad. Las referencias de tiempo se construyen con ejecuciones históricas.</p></div>
      </details>
    </section>`;}
