import {api} from "../services/api.js";
import {getSupabase} from "../services/supabase.js";
import {parseCsv,normalizeHistoryRow,chunk} from "../services/csv.js";
import {toast,wizard,guide,empty,loading} from "../core/ui.js";
import {operationProgress} from "../core/progress.js";
import {fmt} from "../core/format.js";
import {summaryItem} from "../core/guided.js";
import {can} from "../core/state.js";

/* CRM Suministros · Centro Histórico V11.15.0 */
const state={
  tab:"records",
  search:"",
  source:"ALL",
  status:"ALL",
  orderType:"ALL",
  route:"ALL",
  city:"",
  from:"",
  to:"",
  page:1,
  pageSize:50,
  data:null,
  batches:[],
  root:null
};

async function rpc(name,params={}){
  const {data,error}=await getSupabase().rpc(name,params);
  if(error)throw error;
  return data;
}
function safe(value){return fmt.escape(String(value??"—"))}
function n(value){return Number(value||0)}
function money(value){return new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(n(value))}
function date(value){return value?new Intl.DateTimeFormat("es-CO",{dateStyle:"medium",timeZone:"America/Bogota"}).format(new Date(value)):"—"}
function dateTime(value){return value?new Intl.DateTimeFormat("es-CO",{dateStyle:"medium",timeStyle:"short",timeZone:"America/Bogota"}).format(new Date(value)):"—"}
function duration(seconds){
  const s=n(seconds);if(!s)return "—";
  const d=Math.floor(s/86400),h=Math.floor((s%86400)/3600),m=Math.floor((s%3600)/60);
  return d?`${d} d ${h} h`:h?`${h} h ${m} min`:`${m} min`;
}
function label(value){return fmt.label?.(value)||String(value??"—").replaceAll("_"," ")}
function sourceLabel(value){return value==="IMPORTED"?"Importado CSV":"Operación nativa"}
function sourceClass(value){return value==="IMPORTED"?"imported":"native"}
function statusClass(value){return value==="CANCELLED"?"cancelled":"closed"}
function filtersPayload(extra={}){
  return {
    search:state.search||null,source:state.source,status:state.status,orderType:state.orderType,route:state.route,city:state.city||null,
    from:state.from||null,to:state.to||null,page:state.page,pageSize:state.pageSize,...extra
  };
}

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

function bindShell(){
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

async function loadHistory(){
  const content=state.root.querySelector("[data-history-content]");
  if(state.tab==="records")content.innerHTML=loading("Consultando archivo histórico…");
  try{
    state.data=await rpc("erp_x_history_center",{p_payload:filtersPayload()});
    renderActive();
  }catch(error){
    content.innerHTML=`<section class="history-panel-v11150"><h3>No fue posible consultar el histórico</h3><p>${safe(error.message)}</p></section>`;
  }
}
async function loadBatches(){
  try{state.batches=await rpc("erp_x_history_batches",{p_limit:100})||[];if(state.tab==="batches")renderActive()}catch{state.batches=[]}
}

function renderActive(){
  const content=state.root?.querySelector("[data-history-content]");if(!content||!state.data)return;
  if(state.tab==="batches")content.innerHTML=renderBatches();
  else if(state.tab==="coverage")content.innerHTML=renderCoverage();
  else content.innerHTML=renderRecords();
  bindActive();
}

function renderRecords(){
  const d=state.data,s=d.summary||{},rows=d.rows||[];
  const pages=Math.max(1,Math.ceil(n(s.total)/n(d.pageSize||state.pageSize)));
  return `<section class="history-section-v11150">
    <div class="history-kpis-v11150">
      ${kpi("Registros históricos",fmt.number(s.total),`${fmt.number(s.native)} nativos · ${fmt.number(s.imported)} importados`)}
      ${kpi("Clientes únicos",fmt.number(s.uniqueClients),"Según documento disponible")}
      ${kpi("Con entrega confirmada",fmt.number(s.withDelivery),pctOf(s.withDelivery,s.total),"good")}
      ${kpi("Con factura registrada",fmt.number(s.withInvoice),`${money(s.invoiceAmount)} acumulado`,"money")}
      ${kpi("Ciclo promedio",duration(s.avgCycleSeconds),"Creación → cierre", "time")}
    </div>

    <section class="history-facets-v11150">
      <div class="history-facet-group-v11150"><span>Tipo</span>${facetButtons("type",d.facets?.types,state.orderType)}</div>
      <div class="history-facet-group-v11150"><span>Ruta</span>${facetButtons("route",d.facets?.routes,state.route)}</div>
      <div class="history-facet-group-v11150"><span>Ciudad</span>${facetButtons("city",d.facets?.cities,state.city,8)}</div>
    </section>

    <section class="history-panel-v11150 history-ledger-v11150">
      <header><div><h3>Archivo consolidado</h3><p>Registro histórico consultable y trazable. Pulsa cualquier fila para abrir su expediente.</p></div><div class="history-range-v11150">${fmt.number(s.total)} registros · pág. ${state.page}/${pages}</div></header>
      ${rows.length?historyTable(rows):emptyHistory()}
      <footer class="history-pagination-v11150">
        <span>Mostrando ${fmt.number(rows.length)} de ${fmt.number(s.total)}</span>
        <div><button class="btn btn-ghost" data-history-page="${Math.max(1,state.page-1)}" ${state.page<=1?"disabled":""}>Anterior</button><button class="btn btn-ghost" data-history-page="${Math.min(pages,state.page+1)}" ${state.page>=pages?"disabled":""}>Siguiente</button></div>
      </footer>
    </section>
  </section>`;
}

function kpi(labelText,value,detail,tone=""){
  return `<article class="history-kpi-v11150 ${tone}"><small>${safe(labelText)}</small><strong>${safe(value)}</strong><span>${safe(detail)}</span></article>`;
}
function pctOf(value,total){return total?`${fmt.number(n(value)/n(total)*100,1)}% del archivo`:"Sin registros"}
function facetButtons(kind,rows=[],selected="ALL",limit=6){
  const all=`<button class="${!selected||selected==="ALL"?"active":""}" data-history-facet="${kind}" data-value="ALL">Todos</button>`;
  return all+(rows||[]).slice(0,limit).map(row=>`<button class="${String(selected)===String(row.label)?"active":""}" data-history-facet="${kind}" data-value="${safe(row.label)}">${safe(label(row.label))}<b>${fmt.number(row.value)}</b></button>`).join("");
}
function historyTable(rows){
  return `<div class="history-table-wrap-v11150"><table class="history-table-v11150">
    <thead><tr><th>Origen</th><th>Pedido / cliente</th><th>Tipo y ruta</th><th>Estado</th><th>Valor</th><th>Expediente</th><th>Fecha histórica</th><th></th></tr></thead>
    <tbody>${rows.map(row=>`<tr data-history-open="${safe(row.id)}">
      <td><span class="history-source-v11150 ${sourceClass(row.source)}">${sourceLabel(row.source)}</span>${row.importFileName?`<small>${safe(row.importFileName)}</small>`:""}</td>
      <td><strong>${safe(row.orderNumber)}</strong><span>${safe(row.clientName)}</span><small>${safe(row.clientDocument||row.clientCity||"")}</small></td>
      <td><strong>${safe(label(row.orderType))}</strong><span>${safe(fmt.route?.(row.route)||label(row.route))}</span></td>
      <td><span class="history-status-v11150 ${statusClass(row.status)}">${safe(label(row.status))}</span></td>
      <td><strong>${money(row.invoiceAmount)}</strong><small>${fmt.number(row.itemLines)} línea(s)</small></td>
      <td><span>${fmt.number(row.taskCount)} tareas</span><small>${row.deliveredAt?`Entregado ${date(row.deliveredAt)}`:"Sin entrega registrada"}</small></td>
      <td><strong>${date(row.closedAt||row.cancelledAt||row.updatedAt)}</strong><small>Creado ${date(row.createdAt)}</small></td>
      <td><button class="history-open-btn-v11150" data-history-open="${safe(row.id)}" aria-label="Abrir expediente">→</button></td>
    </tr>`).join("")}</tbody>
  </table></div>`;
}
function emptyHistory(){
  return `<div class="history-empty-v11150"><div class="history-empty-icon-v11150">▦</div><h3>No hay registros con estos filtros</h3><p>El archivo puede estar vacío o los criterios actuales no encontrar coincidencias.</p>${can("imports","canCreate")?'<button class="btn btn-primary" data-history-import-empty>Importar histórico</button>':""}</div>`;
}

function renderBatches(){
  const rows=state.batches||[];
  return `<section class="history-section-v11150">
    <div class="history-subhead-v11150"><div><span class="history-eyebrow-v11150">Gobierno de importaciones</span><h3>Lotes históricos</h3><p>Cada carga conserva archivo, responsable, resultado y muestra de rechazos.</p></div>${can("imports","canCreate")?'<button class="btn btn-primary" data-history-import>Importar nuevo archivo</button>':""}</div>
    ${rows.length?`<div class="history-batches-v11150">${rows.map(batchCard).join("")}</div>`:`<div class="history-empty-v11150"><div class="history-empty-icon-v11150">⇩</div><h3>Todavía no hay importaciones</h3><p>Los lotes CSV que se procesen aparecerán aquí con su trazabilidad completa.</p></div>`}
  </section>`;
}
function batchCard(batch){
  const total=Math.max(1,n(batch.totalRows)),ok=n(batch.insertedRows),bad=n(batch.rejectedRows);
  return `<article class="history-batch-v11150">
    <header><div><span class="history-batch-status-v11150 ${String(batch.status).toLowerCase()}">${safe(label(batch.status))}</span><h4>${safe(batch.fileName)}</h4><p>${safe(batch.importedBy||"Usuario no disponible")} · ${dateTime(batch.createdAt)}</p></div><strong>${fmt.number(total)} filas</strong></header>
    <div class="history-batch-meter-v11150"><i style="width:${Math.min(100,ok/total*100)}%"></i></div>
    <div class="history-batch-stats-v11150"><span><b>${fmt.number(ok)}</b> incorporadas</span><span><b>${fmt.number(bad)}</b> rechazadas</span><span><b>${batch.completedAt?dateTime(batch.completedAt):"—"}</b> finalización</span></div>
    ${batch.errors?.length?`<details><summary>Ver muestra de errores (${batch.errors.length})</summary><div class="history-errors-v11150">${batch.errors.map(e=>`<div><b>Fila ${fmt.number(e.rowNumber)}</b><span>${safe(e.message)}</span><small>${safe(e.code)}</small></div>`).join("")}</div></details>`:""}
  </article>`;
}

function renderCoverage(){
  const s=state.data.summary||{},f=state.data.facets||{};
  const deliveryPct=s.total?n(s.withDelivery)/n(s.total)*100:0,invoicePct=s.total?n(s.withInvoice)/n(s.total)*100:0,importedPct=s.total?n(s.imported)/n(s.total)*100:0;
  return `<section class="history-section-v11150">
    <div class="history-coverage-grid-v11150">
      <article class="history-panel-v11150"><header><div><h3>Integridad documental</h3><p>Qué tan completo está el archivo para consultas posteriores.</p></div></header>
        ${coverageRow("Con entrega confirmada",deliveryPct,`${fmt.number(s.withDelivery)} de ${fmt.number(s.total)}`)}
        ${coverageRow("Con factura registrada",invoicePct,`${fmt.number(s.withInvoice)} de ${fmt.number(s.total)}`)}
        ${coverageRow("Procedencia importada",importedPct,`${fmt.number(s.imported)} importados`)}
      </article>
      <article class="history-panel-v11150"><header><div><h3>Ventana temporal</h3><p>Alcance cronológico del archivo disponible.</p></div></header>
        <div class="history-window-v11150"><span>Registro más antiguo<strong>${date(s.oldest)}</strong></span><i></i><span>Registro más reciente<strong>${date(s.newest)}</strong></span></div>
        <div class="history-years-v11150">${(f.years||[]).map(row=>`<div><strong>${safe(row.label)}</strong><span>${fmt.number(row.value)} registros</span></div>`).join("")||'<p class="muted">Sin series anuales todavía.</p>'}</div>
      </article>
    </div>
    <div class="history-coverage-grid-v11150">
      ${distributionPanel("Estados",f.status)}${distributionPanel("Tipos de pedido",f.types)}
    </div>
    <div class="history-integrity-note-v11150"><strong>Regla de integridad V11.15.0</strong><p>Una importación nunca puede transformar un pedido operativo existente en histórico. Si el número ya existe como pedido nativo, esa fila se rechaza y queda registrada en el lote de errores.</p></div>
  </section>`;
}
function coverageRow(title,value,detail){return `<div class="history-coverage-row-v11150"><div><strong>${safe(title)}</strong><span>${safe(detail)}</span></div><div class="history-coverage-track-v11150"><i style="width:${Math.max(0,Math.min(100,value))}%"></i></div><b>${fmt.number(value,1)}%</b></div>`}
function distributionPanel(title,rows=[]){const max=Math.max(1,...(rows||[]).map(r=>n(r.value)));return `<article class="history-panel-v11150"><header><div><h3>${safe(title)}</h3><p>Distribución del archivo filtrado.</p></div></header><div class="history-distribution-v11150">${(rows||[]).map(row=>`<div><span>${safe(label(row.label))}</span><i><b style="width:${n(row.value)/max*100}%"></b></i><strong>${fmt.number(row.value)}</strong></div>`).join("")||'<p class="muted">Sin datos.</p>'}</div></article>`}

function bindActive(){
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

async function openHistoryDetail(id){
  const host=document.createElement("div");host.className="history-modal-backdrop-v11150";host.innerHTML=`<section class="history-modal-v11150">${loading("Reconstruyendo expediente histórico…")}</section>`;document.body.append(host);
  host.addEventListener("click",event=>{if(event.target===host)host.remove()});
  try{
    const data=await rpc("erp_x_history_detail",{p_order_id:id});
    host.querySelector(".history-modal-v11150").innerHTML=detailHtml(data);
    host.querySelector("[data-history-close]").onclick=()=>host.remove();
    host.querySelectorAll("[data-detail-tab]").forEach(button=>button.onclick=()=>{
      const key=button.dataset.detailTab;
      host.querySelectorAll("[data-detail-tab]").forEach(n=>n.classList.toggle("active",n===button));
      host.querySelectorAll("[data-detail-panel]").forEach(n=>n.hidden=n.dataset.detailPanel!==key);
    });
  }catch(error){host.querySelector(".history-modal-v11150").innerHTML=`<button class="history-modal-close-v11150" data-history-close>×</button><h3>No fue posible abrir el expediente</h3><p>${safe(error.message)}</p>`;host.querySelector("[data-history-close]").onclick=()=>host.remove()}
}
function detailHtml(data){
  const o=data.order||{},items=data.items||[],invoices=data.invoices||[],deliveries=data.deliveries||[],tasks=data.tasks||[],issues=data.issues||[],audit=data.audit||[],batch=data.batch;
  return `<button class="history-modal-close-v11150" data-history-close aria-label="Cerrar">×</button>
    <header class="history-detail-head-v11150"><div><span class="history-source-v11150 ${sourceClass(o.history_source)}">${sourceLabel(o.history_source)}</span><h2>${safe(o.order_number)}</h2><p>${safe(o.client_name)} · ${safe(o.client_document||o.client_city||"")}</p></div><div><span class="history-status-v11150 ${statusClass(o.status)}">${safe(label(o.status))}</span><strong>${date(o.closed_at||o.cancelled_at||o.updated_at)}</strong></div></header>
    <div class="history-detail-summary-v11150">
      ${detailStat("Tipo",label(o.order_type_code))}${detailStat("Ruta",fmt.route?.(o.delivery_route_code)||label(o.delivery_route_code))}${detailStat("Condición",label(o.payment_condition_code))}${detailStat("Prioridad",label(o.priority))}${detailStat("Asesor",o.seller_name||"—")}${detailStat("Referencia externa",o.external_reference||"—")}
    </div>
    <nav class="history-detail-tabs-v11150">
      <button class="active" data-detail-tab="overview">Resumen</button><button data-detail-tab="items">Materiales <b>${items.length}</b></button><button data-detail-tab="financial">Facturación <b>${invoices.length}</b></button><button data-detail-tab="delivery">Entregas <b>${deliveries.length}</b></button><button data-detail-tab="flow">Flujo <b>${tasks.length}</b></button><button data-detail-tab="trace">Trazabilidad <b>${audit.length}</b></button>
    </nav>
    <div class="history-detail-panels-v11150">
      <section data-detail-panel="overview">${overviewPanel(o,batch,issues)}</section>
      <section data-detail-panel="items" hidden>${itemsPanel(items)}</section>
      <section data-detail-panel="financial" hidden>${invoicePanel(invoices)}</section>
      <section data-detail-panel="delivery" hidden>${deliveryPanel(deliveries)}</section>
      <section data-detail-panel="flow" hidden>${tasksPanel(tasks)}</section>
      <section data-detail-panel="trace" hidden>${auditPanel(audit)}</section>
    </div>`;
}
function detailStat(title,value){return `<div><small>${safe(title)}</small><strong>${safe(value)}</strong></div>`}
function overviewPanel(o,batch,issues){
  const meta=o.metadata||{};
  return `<div class="history-detail-grid-v11150">
    <article><h3>Identificación</h3>${kv("Pedido",o.order_number)}${kv("Cliente",o.client_name)}${kv("Documento",o.client_document)}${kv("Ciudad",o.client_city)}${kv("Dirección",o.client_address)}${kv("Teléfono",o.client_phone)}</article>
    <article><h3>Ciclo histórico</h3>${kv("Creado",dateTime(o.created_at))}${kv("Actualizado",dateTime(o.updated_at))}${kv("Cerrado",dateTime(o.closed_at))}${kv("Cancelado",dateTime(o.cancelled_at))}${kv("Origen",sourceLabel(o.history_source))}${kv("Sistema fuente",o.source)}</article>
    ${batch?`<article><h3>Lote de importación</h3>${kv("Archivo",batch.file_name)}${kv("Estado",label(batch.status))}${kv("Responsable",batch.imported_by)}${kv("Procesado",dateTime(batch.completed_at||batch.created_at))}${kv("Insertadas",batch.inserted_rows)}${kv("Rechazadas",batch.rejected_rows)}</article>`:`<article><h3>Registro nativo</h3><p>Este pedido proviene del flujo operativo del CRM y conserva su expediente funcional original.</p></article>`}
    <article><h3>Incidencias</h3>${issues.length?issues.map(i=>`<div class="history-issue-v11150"><strong>${safe(i.title||label(i.issue_type))}</strong><span>${safe(label(i.status))}${i.blocking?" · Bloqueante":""}</span><p>${safe(i.detail||i.resolution||"")}</p></div>`).join(""):"<p>Sin incidencias registradas.</p>"}</article>
  </div><details class="history-raw-v11150"><summary>Metadatos históricos</summary><pre>${safe(JSON.stringify(meta,null,2))}</pre></details>`;
}
function kv(key,value){return `<div class="history-kv-v11150"><span>${safe(key)}</span><strong>${safe(value??"—")}</strong></div>`}
function itemsPanel(items){if(!items.length)return empty("Sin materiales registrados","");return table(["Línea","Referencia","Descripción","Cantidad","Unidad","Estado"],items.map(i=>[i.line_number,i.reference||i.sku,i.description,i.quantity,i.unit,label(i.item_status)]))}
function invoicePanel(rows){if(!rows.length)return empty("Sin facturas registradas","");return table(["Factura","Fecha","Valor","Estado","Peso","Cantidad"],rows.map(i=>[i.invoice_number,date(i.invoice_date),money(i.amount),label(i.status),i.package_weight_kg?`${i.package_weight_kg} kg`:"—",i.package_quantity||"—"]))}
function deliveryPanel(rows){if(!rows.length)return empty("Sin entregas registradas","");return table(["Ruta","Estado","Transportadora","Guía","Despacho","Entrega","Costo"],rows.map(d=>[fmt.route?.(d.route_code)||label(d.route_code),label(d.status),d.carrier||"—",d.tracking_number||"—",dateTime(d.dispatched_at),dateTime(d.delivered_at),money(d.carrier_cost)]))}
function tasksPanel(rows){if(!rows.length)return empty("El registro histórico no contiene tareas de flujo","");return `<div class="history-timeline-v11150">${rows.map(t=>`<div><i></i><section><header><strong>${safe(label(t.step_code))}</strong><span>${safe(label(t.status))}</span></header><p>${dateTime(t.started_at||t.assigned_at||t.created_at)} → ${dateTime(t.completed_at)}</p><small>Tiempo de negocio: ${duration(t.business_seconds)}${t.result_code?` · ${safe(label(t.result_code))}`:""}</small></section></div>`).join("")}</div>`}
function auditPanel(rows){if(!rows.length)return empty("Sin eventos adicionales de auditoría","");return `<div class="history-audit-list-v11150">${rows.map(a=>`<article><time>${dateTime(a.createdAt)}</time><div><strong>${safe(label(a.action))}</strong><span>${safe(a.actor||"Sistema")}</span><pre>${safe(JSON.stringify(a.metadata||a.after||{},null,2))}</pre></div></article>`).join("")}</div>`}
function table(headers,rows){return `<div class="history-table-wrap-v11150"><table class="history-table-v11150 compact"><thead><tr>${headers.map(h=>`<th>${safe(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(cell=>`<td>${safe(cell??"—")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`}

async function exportHistory(format){
  try{
    toast("Preparando exportación histórica…","info",3000);
    const data=await rpc("erp_x_history_export",{p_payload:filtersPayload({limit:5000})});
    const rows=data?.rows||[];if(!rows.length){toast("No hay registros para exportar.","error");return}
    if(format==="xlsx"){
      if(!window.XLSX){toast("El motor Excel no está disponible.","error");return}
      const wb=window.XLSX.utils.book_new();window.XLSX.utils.book_append_sheet(wb,window.XLSX.utils.json_to_sheet(rows),"Historico");window.XLSX.writeFile(wb,`CRM_Historico_${new Date().toISOString().slice(0,10)}.xlsx`,{compression:true});
    }else downloadCsv(rows,`CRM_Historico_${new Date().toISOString().slice(0,10)}.csv`);
    toast(`${fmt.number(rows.length)} registro(s) exportados.`);
  }catch(error){toast(error.message,"error",7000)}
}
function downloadCsv(rows,name){
  const headers=[...new Set(rows.flatMap(row=>Object.keys(row||{})))];
  const csv=[headers,...rows.map(row=>headers.map(h=>row?.[h]))].map(row=>row.map(v=>`"${String(typeof v==="object"&&v!==null?JSON.stringify(v):v??"").replaceAll('"','""')}"`).join(",")).join("\n");
  const link=document.createElement("a");link.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),0);
}

function startImportWizard(){
  let rows=[],errors=[];
  wizard({
    title:"Importar pedidos históricos",subtitle:"Incorpora únicamente pedidos cerrados o cancelados que no deban iniciar flujo operativo.",finishLabel:"Importar historial",
    steps:[
      {title:"Seleccionar archivo",description:"Usa la plantilla oficial CSV.",content:`<div class="field"><label>Archivo CSV *</label><input class="control" name="file" type="file" accept=".csv,text/csv" required></div><label class="filter-pill"><input name="confirmedHistory" type="checkbox" required> Confirmo que estos registros pertenecen al histórico y no deben iniciar tareas operativas.</label><div class="history-wizard-warning-v11150">Si un número de pedido ya existe como pedido operativo, esa fila será rechazada para proteger la integridad del CRM.</div>`},
      {title:"Validar archivo",description:"Se revisan encabezados y campos obligatorios antes de tocar la base.",content:`<div id="import-analysis">Analizando archivo…</div>`,onEnter:async({root,form})=>{const file=form.querySelector('[name="file"]').files[0];if(!file)throw new Error("Selecciona un archivo CSV.");rows=parseCsv(await file.text()).map(normalizeHistoryRow);errors=rows.filter(row=>!row.orderNumber||!row.clientName);root.querySelector("#import-analysis").innerHTML=`<div class="summary-grid"><div class="summary-box"><span class="muted">Filas</span><strong>${fmt.number(rows.length)}</strong></div><div class="summary-box"><span class="muted">Válidas</span><strong class="success">${fmt.number(rows.length-errors.length)}</strong></div><div class="summary-box"><span class="muted">Con error</span><strong class="danger">${fmt.number(errors.length)}</strong></div><div class="summary-box"><span class="muted">Lotes técnicos</span><strong>${fmt.number(Math.ceil(rows.length/200))}</strong></div></div>${errors.length?'<div class="wizard-tip">Corrige las filas sin pedido o cliente antes de continuar.</div>':""}`},validate:()=>{if(!rows.length)throw new Error("El archivo no contiene registros.");if(errors.length)throw new Error(`El archivo contiene ${errors.length} filas con errores.`);return true}},
      {title:"Vista previa",description:"Comprueba la información antes de incorporarla.",content:`<div id="import-preview"></div>`,onEnter:({root})=>{root.querySelector("#import-preview").innerHTML=rows.length?`<div class="table-wrap mobile-card-table"><table><thead><tr><th>Pedido</th><th>Cliente</th><th>Tipo</th><th>Ruta</th><th>Estado</th><th>Fecha</th></tr></thead><tbody>${rows.slice(0,20).map(row=>`<tr><td>${safe(row.orderNumber)}</td><td>${safe(row.clientName)}</td><td>${safe(label(row.orderType))}</td><td>${safe(fmt.route?.(row.deliveryRoute)||label(row.deliveryRoute))}</td><td>${safe(label(row.status))}</td><td>${safe(row.createdAt||"")}</td></tr>`).join("")}</tbody></table></div>`:empty("Sin registros","")}},
      {title:"Confirmar",description:"La importación queda auditada como un lote histórico.",content:`<div class="wizard-summary">${summaryItem("Registros","")}<div class="wizard-summary-item"><label>Registros válidos</label><strong data-valid-rows></strong></div><div class="wizard-summary-item"><label>Modo</label><strong>Archivo histórico protegido</strong></div></div><div class="wizard-confirm-box"><strong>No se crearán tareas ni movimientos operativos</strong><p>Los pedidos serán consultables en Histórico y Analítica. Los conflictos con pedidos nativos se rechazarán.</p></div>`,onEnter:({root})=>{root.querySelector("[data-valid-rows]").textContent=String(rows.length)}}
    ],
    onFinish:async({form})=>{
      const file=form.querySelector('[name="file"]').files[0],parts=chunk(rows,200);const progress=operationProgress({title:"Importando historial",message:"Registrando lote histórico…",fileName:file.name,fileSize:file.size,kind:"import"});let batchId=null,inserted=0,rejected=0;
      try{
        for(let index=0;index<parts.length;index++){
          progress.update({progress:Math.round(12+(index/Math.max(1,parts.length))*78),phase:"REGISTER",message:`Procesando lote ${index+1} de ${parts.length}…`});
          const result=await api.importHistory(file.name,parts[index],batchId);batchId=result.batchId;inserted+=result.inserted;rejected+=result.rejected;
        }
        progress.done(`Importación finalizada: ${inserted} incorporados y ${rejected} rechazados.`);toast(`Importación finalizada: ${inserted} incorporados y ${rejected} rechazados.`,rejected?"error":"success",8000);await Promise.all([loadHistory(),loadBatches()]);
      }catch(error){progress.error(error);throw error}
    }
  });
}
