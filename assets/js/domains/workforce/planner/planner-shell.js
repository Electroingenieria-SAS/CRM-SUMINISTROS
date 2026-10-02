import { fmt } from "../../../core/format.js";
import { plannerTitleForMode } from "./index.js";
import { renderWorkforceCalendarBoard } from "../calendar/index.js";
import { plannerFiltersHtml } from "./planner-filter-panel.js";
import { workforceState } from "../workforce-state.js";

export function renderPlannerShell(planner){
planner.content.innerHTML=plannerToolbarHtml(planner)+plannerFiltersHtml(planner)+plannerCalendarContentHtml(planner);
}

export function plannerToolbarHtml(planner){return `
    <section class="work-planner-toolbar card">
      <div class="work-planner-nav">
        <button class="icon-btn" data-plan-prev aria-label="Anterior">‹</button>
        <button class="btn btn-ghost" data-plan-today>Hoy</button>
        <button class="icon-btn" data-plan-next aria-label="Siguiente">›</button>
        <div><strong>${fmt.escape(plannerTitleForMode(workforceState.plannerMode,workforceState.plannerAnchor))}</strong><span>${planner.subtitle}</span></div>
      </div>
      <div class="work-planner-actions">
        <div class="segment-control work-planner-mode">
          <button class="${workforceState.plannerMode==="day"?"active":""}" data-plan-mode="day">Día</button>
          <button class="${workforceState.plannerMode==="week"?"active":""}" data-plan-mode="week">Semana</button>
          <button class="${workforceState.plannerMode==="month"?"active":""}" data-plan-mode="month">Mes</button>
        </div>`;}

export function plannerCalendarContentHtml(planner){return `
        ${planner.canPlanTeam?'<button class="btn btn-create" data-plan-new-custom>Nueva actividad</button><button class="btn btn-primary" data-plan-new>Asignar del catálogo</button>':'<span class="work-timeline-scope-v11350">Mi cronograma</span>'}
      </div>
    </section>



    <section class="work-planner-context-strip">
      <span><b>Horario</b> 07:00–12:00 · 13:40–17:30</span>
      <span><b>Calendario</b> ${planner.canViewTeam?"equipo visible según permisos":"solo tus actividades"}</span>
      <span><b>Interacción</b> toca o pasa el mouse para resumen · doble clic para detalle</span>
    </section>

    <div data-planner-calendar-host>${renderWorkforceCalendarBoard({mode:workforceState.plannerMode,anchor:workforceState.plannerAnchor,data:planner.plannerData,calendar:planner.calendar,filters:workforceState.plannerFilters})}</div>

    ${planner.canViewTeam?`<details class="work-team-capacity-v11362 card">
      <summary class="work-team-capacity-summary-v11362">
        <span class="work-team-capacity-icon-v11362">◔</span>
        <div>
          <strong>Capacidad del equipo</strong>
          <small data-team-capacity-label>${planner.selectedWorker()?fmt.escape(planner.selectedWorker().name):"Selecciona un trabajador en Filtros"}</small>
        </div>
        <span class="work-team-capacity-chevron-v11362">⌄</span>
      </summary>
      <div class="work-team-capacity-body-v11362" data-team-capacity-host>
        ${planner.capacityMarkupFor(workforceState.plannerFilters.profileId)}
      </div>
    </details>`:""}`;}
