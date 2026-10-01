import { guide, loading } from "../../core/ui.js";
import { can } from "../../core/state.js";
import { state } from "./history-state.js";
import { loadHistory, loadBatches } from "./data/history-rpc.js";
import { renderRecords } from "./list/records.js";
import { renderBatches } from "./imports/batch-list.js";
import { renderCoverage } from "./coverage/coverage-view.js";
import { openHistoryDetail } from "./detail/history-detail.js";
import { exportHistory } from "./exports/history-export.js";
import { startImportWizard } from "./imports/import-wizard.js";

export async function renderHistoryCenter(root){
  state.root=root;state.tab="records";state.page=1;
  root.innerHTML=`
    <section class="history-v11150">
      <header class="history-hero-v11150">
        <div class="history-hero-copy-v11150">
          <span class="history-kicker-v11150">Archivo histórico · V11.15.0</span>
          <h2>Centro Histórico de Pedidos</h2>
          <p>Consulta, reconstruye y audita el ciclo completo de pedidos cerrados o cancelados, diferenciando la operación nativa de los registros incorporados por importación.</p>
        </div>
        <div class="history-hero-actions-v11150">
          ${can("imports","canCreate")?'<button class="btn btn-primary" data-history-import>Importar histórico</button>':""}
          <button class="btn btn-ghost" data-history-export="xlsx">Exportar Excel</button>
          <button class="btn btn-ghost" data-history-export="csv">Exportar CSV</button>
          <button class="btn btn-help" data-history-help>Metodología</button>
        </div>
      </header>

      <section class="history-command-v11150">
        <div class="history-search-v11150"><span>⌕</span><input class="control" data-history-search placeholder="Pedido, referencia, cliente, documento o ciudad"></div>
        <label>Origen<select class="control" data-history-source><option value="ALL">Todo el archivo</option><option value="NATIVE">Operación nativa</option><option value="IMPORTED">Importado CSV</option></select></label>
        <label>Estado<select class="control" data-history-status><option value="ALL">Todos</option><option value="CLOSED">Cerrados</option><option value="CANCELLED">Cancelados</option></select></label>
        <label>Desde<input class="control" type="date" data-history-from></label>
        <label>Hasta<input class="control" type="date" data-history-to></label>
        <button class="btn btn-primary" data-history-apply>Aplicar</button>
        <button class="btn btn-ghost" data-history-clear>Limpiar</button>
      </section>

      <nav class="history-tabs-v11150">
        <button class="active" data-history-tab="records"><span>Archivo</span><small>Pedidos y expedientes</small></button>
        <button data-history-tab="batches"><span>Importaciones</span><small>Lotes, errores y trazabilidad</small></button>
        <button data-history-tab="coverage"><span>Cobertura</span><small>Integridad del histórico</small></button>
      </nav>

      <main data-history-content>${loading("Preparando archivo histórico…")}</main>
    </section>`;
  bindShell();
  await Promise.all([loadHistory(),loadBatches()]);
}

export function bindShell(){
  const root=state.root;
  root.querySelector("[data-history-apply]").onclick=()=>{
    state.search=root.querySelector("[data-history-search]").value.trim();
    state.source=root.querySelector("[data-history-source]").value;
    state.status=root.querySelector("[data-history-status]").value;
    state.from=root.querySelector("[data-history-from]").value;
    state.to=root.querySelector("[data-history-to]").value;
    state.page=1;loadHistory();
  };
  root.querySelector("[data-history-search]").addEventListener("keydown",event=>{if(event.key==="Enter")root.querySelector("[data-history-apply]").click()});
  root.querySelector("[data-history-clear]").onclick=()=>{
    state.search="";state.source="ALL";state.status="ALL";state.orderType="ALL";state.route="ALL";state.city="";state.from="";state.to="";state.page=1;
    root.querySelector("[data-history-search]").value="";root.querySelector("[data-history-source]").value="ALL";root.querySelector("[data-history-status]").value="ALL";root.querySelector("[data-history-from]").value="";root.querySelector("[data-history-to]").value="";
    loadHistory();
  };
  root.querySelectorAll("[data-history-tab]").forEach(button=>button.onclick=()=>{
    state.tab=button.dataset.historyTab;
    root.querySelectorAll("[data-history-tab]").forEach(node=>node.classList.toggle("active",node===button));
    renderActive();
  });
  root.querySelector("[data-history-import]")?.addEventListener("click",startImportWizard);
  root.querySelectorAll("[data-history-export]").forEach(button=>button.onclick=()=>exportHistory(button.dataset.historyExport));
  root.querySelector("[data-history-help]").onclick=()=>guide({
    title:"Centro Histórico de Pedidos",
    description:"El archivo histórico combina pedidos finalizados por la operación del CRM y registros importados de sistemas anteriores, sin mezclarlos ni alterar su origen.",
    items:[
      {title:"Operación nativa",detail:"Pedidos que completaron o cancelaron su flujo dentro del CRM."},
      {title:"Importado CSV",detail:"Pedidos de periodos anteriores cargados como registros históricos. Nunca crean tareas operativas."},
      {title:"Expediente",detail:"Cada registro puede mostrar materiales, facturas, entregas, tareas, incidencias, metadatos y trazabilidad disponibles."},
      {title:"Integridad",detail:"Las importaciones rechazan un número de pedido que ya exista como pedido operativo para evitar reclasificaciones accidentales."},
      {title:"Exportación",detail:"Los filtros activos se respetan al exportar hasta 5.000 registros por consulta."}
    ]
  });
}

export function renderActive(){
  const content=state.root?.querySelector("[data-history-content]");if(!content||!state.data)return;
  if(state.tab==="batches")content.innerHTML=renderBatches();
  else if(state.tab==="coverage")content.innerHTML=renderCoverage();
  else content.innerHTML=renderRecords();
  bindActive();
}

export function bindActive(){
  const root=state.root;
  root.querySelectorAll("[data-history-page]").forEach(button=>button.onclick=()=>{state.page=Number(button.dataset.historyPage);loadHistory()});
  root.querySelectorAll("[data-history-open]").forEach(node=>node.onclick=event=>{event.stopPropagation();openHistoryDetail(node.dataset.historyOpen)});
  root.querySelectorAll("[data-history-facet]").forEach(button=>button.onclick=()=>{
    const kind=button.dataset.historyFacet,value=button.dataset.value;
    if(kind==="type")state.orderType=value;
    if(kind==="route")state.route=value;
    if(kind==="city")state.city=value==="ALL"?"":value;
    state.page=1;loadHistory();
  });
  root.querySelectorAll("[data-history-import]").forEach(button=>button.onclick=startImportWizard);
  root.querySelector("[data-history-import-empty]")?.addEventListener("click",startImportWizard);
}
