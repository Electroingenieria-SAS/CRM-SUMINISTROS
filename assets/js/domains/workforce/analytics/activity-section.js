import { fmt } from "../../../core/format.js";
import { GROUP_LABELS } from "../shared/activity-labels.js";
import { barList, causeList } from "./analytics-groups.js";
import { activityStandardsHtml } from "./activity-standards.js";

export function analyticsActivitySectionHtml(analytics){return `
      <section class="work-indicator-section-v11383">
        <header class="work-indicator-section-head-v11383">
          <div><span>ACTIVIDAD Y CAUSAS</span><h3>Qué se hizo y qué explica las desviaciones</h3><p>Compara la composición del trabajo adicional con las causas registradas durante el periodo.</p></div>
        </header>
        <section class="work-indicator-layout-v11363 work-indicator-layout-paired-v11383">
          <section class="work-indicator-panel-v11363">
            <header><div><span>DISTRIBUCIÓN</span><h3>Trabajo adicional por familia</h3><p>Participación del tiempo activo por tipo de actividad registrada.</p></div></header>
            <div class="work-indicator-panel-body-v11363">${barList(analytics.data.activityGroups||[],x=>GROUP_LABELS[x.group]||fmt.label(x.group),x=>x.activeSeconds)}</div>
          </section>

          <section class="work-indicator-panel-v11363">
            <header><div><span>DESVIACIONES</span><h3>Causas documentadas</h3><p>Pareto visual de las razones registradas cuando hubo diferencias frente al plan.</p></div></header>
            <div class="work-indicator-panel-body-v11363">${causeList(analytics.data.deviationCauses||[])}</div>
          </section>
        </section>
      </section>
`;}

export function analyticsStandardsSectionHtml(analytics){return `
      <section class="work-indicator-section-v11383">
        <header class="work-indicator-section-head-v11383">
          <div><span>REFERENCIAS DE TIEMPO</span><h3>Duraciones reales aprendidas por actividad</h3><p>Mediana y percentil 80 construidos con ejecuciones reales para apoyar planeación y capacidad.</p></div>
        </header>
        <section class="work-indicator-panel-v11363 work-indicator-panel-featured-v11383">
          <header><div><span>TIEMPOS APRENDIDOS</span><h3>Mediana y P80 por actividad</h3><p>Referencias operativas basadas en muestras históricas, sin convertirlas en una calificación individual.</p></div></header>
          <div class="work-indicator-panel-body-v11363">${activityStandardsHtml(analytics.data.topActivities||[])}</div>
        </section>
      </section>

      `;}
