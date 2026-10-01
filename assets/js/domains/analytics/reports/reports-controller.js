import { loading, guide } from "../../../core/ui.js";
import { TABS } from "./catalog/datasets.js";
import { state, reportsMount } from "./reports-state.js";
import { localIso, shiftIso, startOfYear } from "./shared/report-dates.js";
import { safe } from "./shared/report-values.js";
import { loadDashboard, loadViews } from "./data/load-dashboard.js";
import { renderActive } from "./ui/active-view.js";
import { loadExplorer } from "./explorer/load-analysis.js";
import { exportWorkbook, exportJson } from "./exports/report-export.js";

export async function renderReports(root){
  reportsMount.rootNode=root;
  const today=localIso();
  state.to=today;
  state.from=shiftIso(today,-29);
  state.tab="executive";
  state.data=null;
  state.explorer.result=null;

  root.innerHTML=`
    <section class="bi-v11140">
      <header class="bi-head-v11140">
        <div>
          <span class="bi-kicker-v11140">Intelligence Center · V11.14.0</span>
          <h2>Analítica y reportes</h2>
          <p>Centro de inteligencia operacional para analizar pedidos, tiempos, facturación, logística, inventario, personas, incidencias y calidad del dato desde una única capa de medición.</p>
        </div>
        <div class="bi-head-actions-v11140">
          <button class="btn btn-ghost" data-bi-export="xlsx">Excel completo</button>
          <button class="btn btn-ghost" data-bi-export="json">JSON</button>
          <button class="btn btn-ghost" data-bi-print>Imprimir / PDF</button>
          <button class="btn btn-help" data-bi-help>Metodología</button>
        </div>
      </header>
      <section class="bi-filterbar-v11140">
        <label>Desde<input class="control" type="date" data-bi-from value="${state.from}"></label>
        <label>Hasta<input class="control" type="date" data-bi-to value="${state.to}"></label>
        <div class="bi-presets-v11140">
          <button class="btn btn-ghost" data-bi-preset="7">7 días</button>
          <button class="btn btn-ghost" data-bi-preset="30">30 días</button>
          <button class="btn btn-ghost" data-bi-preset="90">90 días</button>
          <button class="btn btn-ghost" data-bi-preset="ytd">Año actual</button>
        </div>
        <button class="btn btn-primary" data-bi-refresh>Actualizar análisis</button>
        <span class="bi-toolbar-spacer-v11140"></span>
        <span class="bi-export-status-v11140">Comparación automática contra periodo anterior equivalente</span>
      </section>
      <nav class="bi-tabs-v11140">
        ${TABS.map(([id,label])=>`<button class="bi-tab-v11140 ${id===state.tab?"active":""}" data-bi-tab="${id}">${safe(label)}</button>`).join("")}
      </nav>
      <main class="bi-content-v11140" data-bi-content>
        <div class="bi-skeleton-v11140">${loading("Construyendo el centro de inteligencia…")}</div>
      </main>
    </section>`;

  bindShell();
  await Promise.all([loadDashboard(),loadViews()]);
}

export function bindShell(){
  reportsMount.rootNode.querySelectorAll("[data-bi-tab]").forEach(button=>button.addEventListener("click",()=>{
    state.tab=button.dataset.biTab;
    reportsMount.rootNode.querySelectorAll("[data-bi-tab]").forEach(node=>node.classList.toggle("active",node===button));
    renderActive();
  }));

  reportsMount.rootNode.querySelector("[data-bi-refresh]")?.addEventListener("click",async()=>{
    state.from=reportsMount.rootNode.querySelector("[data-bi-from]").value;
    state.to=reportsMount.rootNode.querySelector("[data-bi-to]").value;
    state.explorer.result=null;
    await loadDashboard();
    if(state.tab==="explorer")await loadExplorer();
  });

  reportsMount.rootNode.querySelectorAll("[data-bi-preset]").forEach(button=>button.addEventListener("click",async()=>{
    const preset=button.dataset.biPreset;
    state.to=localIso();
    state.from=preset==="ytd"?startOfYear(state.to):shiftIso(state.to,-Number(preset)+1);
    reportsMount.rootNode.querySelector("[data-bi-from]").value=state.from;
    reportsMount.rootNode.querySelector("[data-bi-to]").value=state.to;
    state.explorer.result=null;
    await loadDashboard();
  }));

  reportsMount.rootNode.querySelectorAll("[data-bi-export]").forEach(button=>button.addEventListener("click",()=>{
    if(button.dataset.biExport==="xlsx")exportWorkbook();
    else exportJson();
  }));
  reportsMount.rootNode.querySelector("[data-bi-print]")?.addEventListener("click",()=>window.print());
  reportsMount.rootNode.querySelector("[data-bi-help]")?.addEventListener("click",()=>guide({
    title:"Cómo leer Analítica y reportes",
    description:"El módulo utiliza una capa semántica controlada sobre los datos operativos del CRM.",
    items:[
      {title:"Periodo comparable",detail:"Cada KPI se compara con un periodo anterior de igual duración."},
      {title:"Datos curados",detail:"El explorador solo expone dimensiones y métricas aprobadas; no ejecuta SQL escrito desde el navegador."},
      {title:"Detalle exportable",detail:"Los datasets admiten exportación detallada hasta 5.000 filas por consulta."},
      {title:"Calidad primero",detail:"Los indicadores de completitud y sesiones abiertas ayudan a interpretar correctamente los resultados."},
      {title:"Vistas guardadas",detail:"Puedes conservar configuraciones del Explorador BI y compartirlas dentro de la organización."}
    ]
  }));
}
