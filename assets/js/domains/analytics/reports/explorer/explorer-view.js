import { DATASETS } from "../catalog/datasets.js";
import { state } from "../reports-state.js";
import { safe, empty } from "../shared/report-values.js";
import { bars } from "../charts/bar-chart.js";
import { explorerLine } from "../charts/line-chart.js";
import { genericTable } from "../ui/data-table.js";

export function renderExplorer(){
  const explorer=state.explorer,meta=DATASETS[explorer.dataset];
  return `<section class="bi-explorer-v11140">
    <aside class="bi-panel-v11140 bi-builder-v11140">
      <header><div><h3>Constructor de análisis</h3><p>Selecciona dataset, dimensión y métrica.</p></div></header>
      <label>Dataset<select class="control" data-exp-dataset>${Object.entries(DATASETS).map(([key,value])=>`<option value="${key}" ${key===explorer.dataset?"selected":""}>${safe(value.label)}</option>`).join("")}</select></label>
      <label>Dimensión<select class="control" data-exp-dimension>${Object.entries(meta.dimensions).map(([key,value])=>`<option value="${key}" ${key===explorer.dimension?"selected":""}>${safe(value)}</option>`).join("")}</select></label>
      <label>Métrica<select class="control" data-exp-metric>${Object.entries(meta.metrics).map(([key,value])=>`<option value="${key}" ${key===explorer.metric?"selected":""}>${safe(value)}</option>`).join("")}</select></label>
      <label>Máximo de categorías<select class="control" data-exp-limit>${[10,20,50,100].map(value=>`<option value="${value}" ${value===explorer.limit?"selected":""}>${value}</option>`).join("")}</select></label>
      <div class="bi-chart-switch-v11140">
        <button data-exp-chart="bar" class="${explorer.chart==="bar"?"active":""}">Barras</button>
        <button data-exp-chart="line" class="${explorer.chart==="line"?"active":""}">Línea</button>
        <button data-exp-chart="table" class="${explorer.chart==="table"?"active":""}">Tabla</button>
      </div>
      <div class="bi-builder-actions-v11140"><button class="btn btn-primary" data-exp-run>Analizar</button><button class="btn btn-ghost" data-exp-save>Guardar vista</button></div>
      <div class="bi-builder-actions-v11140"><button class="btn btn-ghost" data-exp-detail="xlsx">Detalle XLSX</button><button class="btn btn-ghost" data-exp-detail="csv">Detalle CSV</button></div>
      <div class="bi-data-note-v11140">El detalle se obtiene desde el servidor con un máximo de 5.000 filas por consulta. No se exponen tablas ni SQL arbitrario.</div>
    </aside>
    <article class="bi-panel-v11140 bi-explorer-result-v11140">
      <header><div><h3>${safe(meta.label)} · ${safe(meta.metrics[explorer.metric])}</h3><p>Agrupado por ${safe(meta.dimensions[explorer.dimension])} · ${state.from} → ${state.to}</p></div><span class="bi-chip-v11140">${explorer.result?.rows?.length||0} categorías</span></header>
      <div data-exp-result>${explorer.result?renderExplorerResult():empty("Configura el análisis y pulsa Analizar.")}</div>
    </article>
  </section>`;
}

export function renderExplorerResult(){
  const explorer=state.explorer,rows=explorer.result?.rows||[];
  if(!rows.length)return empty("No hay registros para esta combinación.");
  if(explorer.chart==="table")return genericTable(rows,[["label","Categoría"],["value",DATASETS[explorer.dataset].metrics[explorer.metric]],["records","Registros"]],explorer.metric);
  if(explorer.chart==="line")return explorerLine(rows);
  return bars(rows,explorer.metric);
}
