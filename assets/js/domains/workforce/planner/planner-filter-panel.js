import { fmt } from "../../../core/format.js";
import { isoDate } from "../shared/local-dates.js";
import { workforceState } from "../workforce-state.js";

export function plannerFiltersHtml(planner){return `
      <details class="work-calendar-filterbox-v11362" data-plan-filter-box>
      <summary class="work-calendar-filter-trigger-v11362">
      <span class="work-calendar-filter-trigger-icon-v11362">⌁</span>
      <span>
      <strong>Filtros</strong>
      <small data-plan-filter-summary>${planner.activeFilterCount()?`${planner.activeFilterCount()} activos · ${fmt.escape(planner.filterWorkerName())}`:"Sin filtros activos"}</small>
      </span>
      <b data-plan-filter-count ${planner.activeFilterCount()?"":"hidden"}>${planner.activeFilterCount()}</b>
      </summary>

      <div class="work-calendar-filter-panel-v11362">
      <div class="work-calendar-filter-field-v11361 work-calendar-filter-worker-v11362">
      <label>Trabajador</label>
      <select data-plan-filter-worker>
      <option value="ALL" ${workforceState.plannerFilters.profileId==="ALL"?"selected":""}>Todos los trabajadores</option>
      ${(planner.data.people||[]).map(person=>{
      const count=planner.timeline.filter(item=>item.profileId===person.id).length;
      return `<option value="${fmt.escape(person.id)}" ${workforceState.plannerFilters.profileId===person.id?"selected":""}>${fmt.escape(person.name)} · ${count} actividad${count===1?"":"es"}</option>`;
      }).join("")}
      </select>
      </div>

      <div class="work-calendar-filter-field-v11361">
      <label>Desde</label>
      <input type="time" value="${fmt.escape(workforceState.plannerFilters.fromTime)}" min="07:00" max="17:30" step="300" data-plan-filter-from>
      </div>

      <div class="work-calendar-filter-field-v11361">
      <label>Hasta</label>
      <input type="time" value="${fmt.escape(workforceState.plannerFilters.toTime)}" min="07:00" max="17:30" step="300" data-plan-filter-to>
      </div>

      ${workforceState.plannerMode==="day"?`
      <div class="work-calendar-filter-field-v11361 work-calendar-filter-scope-v11363">
      <label>Fecha</label>
      <input type="date" value="${isoDate(workforceState.plannerAnchor)}" data-plan-filter-date>
      </div>`:`
      <div class="work-calendar-filter-field-v11361 work-calendar-filter-scope-v11363">
      <label>Día</label>
      <select data-plan-filter-weekday>
      <option value="ALL" ${workforceState.plannerFilters.weekday==="ALL"?"selected":""}>Todos los días</option>
      <option value="1" ${workforceState.plannerFilters.weekday==="1"?"selected":""}>Lunes</option>
      <option value="2" ${workforceState.plannerFilters.weekday==="2"?"selected":""}>Martes</option>
      <option value="3" ${workforceState.plannerFilters.weekday==="3"?"selected":""}>Miércoles</option>
      <option value="4" ${workforceState.plannerFilters.weekday==="4"?"selected":""}>Jueves</option>
      <option value="5" ${workforceState.plannerFilters.weekday==="5"?"selected":""}>Viernes</option>
      </select>
      </div>`}

      <div class="work-calendar-filter-actions-v11362">
      <button type="button" class="work-calendar-filter-reset-v11361" data-plan-filter-reset>Restablecer</button>
      <button type="button" class="work-calendar-filter-close-v11362" data-plan-filter-close>Cerrar</button>
      </div>
      </div>
      </details>`;}
