import { fmt } from "../../../core/format.js";
import { icon } from "../../../core/icons.js";
import { workforceState } from "../workforce-state.js";

export function analyticsHeroHtml(analytics){return `
    <section class="work-indicators-v11363">
      <section class="work-indicator-hero-v11363">
        <div class="work-indicator-hero-copy-v11363">
          <span class="work-indicator-kicker-v11363">INDICADORES DE JORNADA</span>
          <h2>Pulso operativo</h2>
          <p>Capacidad, cumplimiento, tiempos y distribución del trabajo en una lectura visual y verificable.</p>
          <div class="work-indicator-context-v11363">
            <span><b>Periodo</b>${fmt.escape(workforceState.analyticsRange.from)} → ${fmt.escape(workforceState.analyticsRange.to)}</span>
            <span><b>Vista</b>${fmt.escape(analytics.scopeName)}</span>
            <span class="tone-${analytics.utilizationTone}"><b>Clasificación</b>${fmt.number(analytics.utilization,1)}%</span>
          </div>
        </div>

        <div class="work-indicator-hero-side-v11363">
          <div class="work-indicator-ring-v11363" style="--indicator-value:${analytics.utilization}">
            <div><strong>${fmt.number(analytics.utilization,1)}%</strong><span>jornada<br>clasificada</span></div>
          </div>
          <details class="work-indicator-filter-v11363">
            <summary>${icon("search")}<span><strong>Ajustar análisis</strong><small>Periodo y persona</small></span><b>⌄</b></summary>
            <div class="work-indicator-filter-panel-v11363">
              <label><span>Desde</span><input class="control" type="date" data-analytics-from value="${workforceState.analyticsRange.from}"></label>
              <label><span>Hasta</span><input class="control" type="date" data-analytics-to value="${workforceState.analyticsRange.to}"></label>
              ${analytics.canManage?`<label class="wide"><span>Persona / equipo</span><select class="control" data-analytics-profile><option value="">Mi ámbito completo</option>${analytics.people.map(person=>`<option value="${fmt.escape(person.id)}" ${analytics.selected===person.id?"selected":""}>${fmt.escape(person.name)}</option>`).join("")}</select></label>`:""}
              <button type="button" class="btn btn-primary wide" data-analytics-apply>Aplicar filtros</button>
            </div>
          </details>
        </div>
      </section>
`;}
