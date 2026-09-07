import {api} from "../services/api.js";
import {inventoryMovements} from "../services/inventory.js";
import {fmt} from "../core/format.js";
import {can} from "../core/state.js";
import {empty,loading,paginationHtml,wizard,toast,guide,modal} from "../core/ui.js";
import {choice} from "../core/guided.js";
import {syncSiesaFile} from "../services/materials.js";

const DEFAULT_FILTERS=Object.freeze({search:"",stock:"",unit:"",warehouse:"",itemType:"",variants:"ALL",sort:"reference_asc",page:1,pageSize:50});
const OUTGOING_TYPES=new Set(["ISSUE","ADJUSTMENT_OUT","SCRAP"]);

let currentItems=[];
let currentPage=1;
let currentPagination=null;
let currentData=null;
let currentFilters={...DEFAULT_FILTERS};
let inventoryCanUpdate=false;

const esc=value=>fmt.escape(value??"");
const qty=(value,unit="")=>`${fmt.number(value,3)}${unit?` ${esc(unit)}`:""}`;
const numberValue=value=>Number(value||0);

export async function renderInventory(root){
  inventoryCanUpdate=can("inventory","canUpdate");
  currentFilters={...DEFAULT_FILTERS};
  currentItems=[];
  currentData=null;

  root.innerHTML=`
    <section class="page-head inventory-page-head-v11109">
      <div>
        <span class="inventory-kicker-v11109">CONTROL DE EXISTENCIAS</span>
        <h2>Inventario</h2>
        <p>Consulta existencias, disponibilidad comercial, reservas, bodegas, lotes y trazabilidad. La referencia y el nombre provienen del maestro oficial Siesa.</p>
      </div>
      <div class="page-actions inventory-page-actions-v11109">
        <button type="button" class="btn btn-search" data-v116-scan>Escanear QR / código</button>
        ${inventoryCanUpdate?'<button type="button" class="btn btn-primary" id="sync-siesa">Actualizar Siesa</button>':""}
        <button type="button" class="btn btn-ghost" id="inventory-help">Guía rápida</button>
      </div>
    </section>

    <section class="inventory-source-bar-v11109" id="material-master-strip">${loading("Consultando fuente oficial…")}</section>

    <section class="inventory-filter-shell-v11109" aria-label="Búsqueda y filtros de inventario">
      <div class="inventory-search-main-v11109">
        <label for="inv-search">Buscar material</label>
        <div class="inventory-search-control-v11109">
          <input class="control" id="inv-search" autocomplete="off" placeholder="Referencia, nombre, familia, marca o código">
          <button type="button" class="btn btn-search" id="inv-filter">Buscar</button>
        </div>
        <small>Escribe una referencia completa o una parte del nombre. No necesitas conocer la bodega o el lote para empezar.</small>
      </div>

      <div class="inventory-stock-tabs-v11109" role="group" aria-label="Filtros rápidos de disponibilidad">
        <button type="button" class="active" data-stock-filter="">Todos</button>
        <button type="button" data-stock-filter="AVAILABLE">Disponibles</button>
        <button type="button" data-stock-filter="OUT">Sin disponibilidad</button>
        <button type="button" data-stock-filter="RESERVED">Con reserva CRM</button>
        <button type="button" data-stock-filter="BLOCKED">Bloqueados</button>
      </div>

      <details class="inventory-more-filters-v11109">
        <summary><strong>Filtros avanzados</strong><span>Bodega, unidad, tipo, variantes y ordenamiento</span></summary>
        <div class="inventory-filter-grid-v11109">
          <label><span>Bodega</span><select class="control" id="inv-warehouse"><option value="">Todas</option></select></label>
          <label><span>Unidad</span><select class="control" id="inv-unit"><option value="">Todas</option></select></label>
          <label><span>Tipo de material</span><select class="control" id="inv-item-type"><option value="">Todos</option><option value="STANDARD">Estándar</option><option value="CUTTABLE">Cortable</option></select></label>
          <label><span>Variantes</span><select class="control" id="inv-variants"><option value="ALL">Todos</option><option value="YES">Con variantes</option><option value="NO">Sin variantes</option></select></label>
          <label><span>Ordenar por</span><select class="control" id="inv-sort"><option value="reference_asc">Referencia</option><option value="name_asc">Nombre</option><option value="atp_desc">Mayor disponible para venta</option><option value="atp_asc">Menor disponible para venta</option><option value="physical_desc">Mayor existencia física</option><option value="reserved_desc">Mayor reserva CRM</option><option value="lots_desc">Más lotes</option></select></label>
        </div>
        <div class="inventory-filter-actions-v11109"><button type="button" class="btn btn-ghost" id="inv-clear">Limpiar filtros</button><button type="button" class="btn btn-primary" id="inv-apply">Aplicar filtros</button></div>
      </details>
    </section>

    <section class="inventory-summary-v11109" id="inventory-summary" aria-label="Resumen de inventario">${loading("Calculando inventario…")}</section>

    <section class="inventory-results-v11109">
      <header class="inventory-results-head-v11109">
        <div><span>CATÁLOGO OPERACIONAL</span><strong>Materiales oficiales</strong><small id="inventory-result-count">Consultando…</small></div>
        <div class="inventory-active-filter-v11109" id="inventory-active-filters"></div>
      </header>
      <div id="inv-result">${loading("Consultando inventario oficial…")}</div>
    </section>`;

  const load=async(page=1)=>{
    currentPage=page;
    currentFilters=readFilters(root,page);
    const target=root.querySelector("#inv-result");
    target.innerHTML=loading("Consultando existencias, reservas y lotes…");
    try{
      const data=await api.inventoryFiltered(currentFilters);
      currentData=data||{};
      currentItems=data?.items||[];
      currentPagination=data?.pagination||null;
      renderFacets(root,data?.facets||{});
      renderSummary(root,data?.summary||{});
      renderActiveFilters(root,currentFilters);
      root.querySelector("#inventory-result-count").textContent=`${fmt.number(currentPagination?.totalItems||0)} material(es) encontrados`;
      target.innerHTML=currentItems.length?`${inventoryTable(currentItems)}${paginationHtml(currentPagination)}`:empty("Sin materiales para estos filtros","Prueba con otra referencia o limpia los filtros de inventario.");
      bindInventoryActions(target,load);
    }catch(error){
      target.innerHTML=`<div class="module-error card-pad"><strong>No fue posible consultar Inventario</strong><p>${esc(error.message)}</p><button class="btn btn-primary" type="button" data-inventory-retry>Reintentar</button></div>`;
      target.querySelector("[data-inventory-retry]")?.addEventListener("click",()=>load(page));
      throw error;
    }
  };

  bindFilterControls(root,load);
  root.querySelector("#sync-siesa")?.addEventListener("click",()=>openSiesaSync(async()=>{await loadSyncStatus(root);await load(1)}));
  root.querySelector("#inventory-help").onclick=()=>guide({
    title:"Cómo leer Inventario",
    description:"La pantalla separa las cantidades para evitar confundir existencia física con disponibilidad comercial.",
    items:[
      {title:"Existencia física",detail:"Cantidad físicamente registrada para el material en los lotes activos."},
      {title:"Disponible Siesa",detail:"Cantidad disponible informada por el sistema fuente antes de reservas propias del CRM."},
      {title:"Reserva CRM",detail:"Cantidad reservada por pedidos del CRM. No modifica la identidad ni la ubicación física."},
      {title:"Disponible para venta",detail:"Disponible Siesa menos la reserva activa del CRM. Es la referencia comercial principal."},
      {title:"Lotes y ubicaciones",detail:"Abre Detalle para consultar bodega, ubicación, lote, variante, cantidades y trazabilidad."},
      {title:"Conteo físico",detail:"Solo usuarios autorizados pueden registrar una diferencia real encontrada en un lote."}
    ]
  });

  await Promise.all([load(1),loadSyncStatus(root)]);
}

function readFilters(root,page=1){
  return {
    search:root.querySelector("#inv-search")?.value?.trim()||"",
    stock:currentFilters.stock||"",
    unit:root.querySelector("#inv-unit")?.value||"",
    warehouse:root.querySelector("#inv-warehouse")?.value||"",
    itemType:root.querySelector("#inv-item-type")?.value||"",
    variants:root.querySelector("#inv-variants")?.value||"ALL",
    sort:root.querySelector("#inv-sort")?.value||"reference_asc",
    page,
    pageSize:50
  };
}

function bindFilterControls(root,load){
  root.querySelector("#inv-filter").onclick=()=>load(1);
  root.querySelector("#inv-search").onkeydown=event=>{if(event.key==="Enter"){event.preventDefault();load(1)}};
  root.querySelector("#inv-apply").onclick=()=>load(1);
  root.querySelectorAll("[data-stock-filter]").forEach(button=>button.onclick=()=>{
    currentFilters.stock=button.dataset.stockFilter||"";
    root.querySelectorAll("[data-stock-filter]").forEach(item=>item.classList.toggle("active",item===button));
    load(1);
  });
  root.querySelector("#inv-clear").onclick=()=>{
    currentFilters={...DEFAULT_FILTERS};
    root.querySelector("#inv-search").value="";
    root.querySelector("#inv-unit").value="";
    root.querySelector("#inv-warehouse").value="";
    root.querySelector("#inv-item-type").value="";
    root.querySelector("#inv-variants").value="ALL";
    root.querySelector("#inv-sort").value="reference_asc";
    root.querySelectorAll("[data-stock-filter]").forEach(button=>button.classList.toggle("active",button.dataset.stockFilter===""));
    load(1);
  };
}

function renderFacets(root,facets){
  fillSelect(root.querySelector("#inv-unit"),facets.units||[],currentFilters.unit,"Todas");
  fillSelect(root.querySelector("#inv-warehouse"),facets.warehouses||[],currentFilters.warehouse,"Todas");
}

function fillSelect(select,items,current,allLabel){
  if(!select)return;
  const options=[`<option value="">${esc(allLabel)}</option>`,...(items||[]).map(item=>`<option value="${esc(item.value)}">${esc(item.value)} (${fmt.number(item.count)})</option>`)];
  select.innerHTML=options.join("");
  select.value=current||"";
}

function renderSummary(root,summary){
  const metrics=[
    ["Materiales",summary.materials||0,"Resultado actual","neutral"],
    ["Disponibles",summary.availableMaterials||0,"Con saldo para venta","success"],
    ["Sin disponibilidad",summary.outMaterials||0,"Requieren revisión","danger"],
    ["Con reserva CRM",summary.reservedMaterials||0,"Compromiso comercial","info"],
    ["Bloqueados",summary.blockedMaterials||0,"Saldo restringido","warning"]
  ];
  root.querySelector("#inventory-summary").innerHTML=metrics.map(([label,value,detail,tone])=>`<article class="inventory-summary-item-v11109 ${tone}"><span aria-hidden="true"></span><div><strong>${fmt.number(value)}</strong><b>${esc(label)}</b><small>${esc(detail)}</small></div></article>`).join("");
}

function renderActiveFilters(root,filters){
  const labels=[];
  if(filters.search)labels.push(`Búsqueda: ${filters.search}`);
  if(filters.stock)labels.push(stockFilterLabel(filters.stock));
  if(filters.warehouse)labels.push(`Bodega ${filters.warehouse}`);
  if(filters.unit)labels.push(`Unidad ${filters.unit}`);
  if(filters.itemType)labels.push(filters.itemType==="CUTTABLE"?"Cortables":"Estándar");
  if(filters.variants!=="ALL")labels.push(filters.variants==="YES"?"Con variantes":"Sin variantes");
  root.querySelector("#inventory-active-filters").innerHTML=labels.length?labels.map(label=>`<span>${esc(label)}</span>`).join(""):'<span>Sin filtros adicionales</span>';
}

function stockFilterLabel(value){
  return ({AVAILABLE:"Disponibles",OUT:"Sin disponibilidad",RESERVED:"Con reserva CRM",BLOCKED:"Bloqueados",PHYSICAL:"Con existencia física"})[value]||"Todos";
}

async function loadSyncStatus(root){
  const strip=root.querySelector("#material-master-strip");
  if(!strip)return;
  try{
    const history=await api.materialSyncHistory(5);
    const last=(history||[]).find(row=>row.status==="COMPLETED")||(history||[])[0];
    if(!last){
      strip.innerHTML='<div class="inventory-source-main-v11109"><span>SIESA</span><div><strong>Maestro aún no sincronizado</strong><small>Carga el archivo oficial para habilitar la operación normal.</small></div></div>';
      return;
    }
    const summary=last.summary||{};
    strip.innerHTML=`<div class="inventory-source-main-v11109"><span>SIESA</span><div><strong>Fuente oficial sincronizada</strong><small>${esc(last.fileName||"Archivo Siesa")} · ${fmt.date(last.completedAt||last.createdAt)}</small></div></div><div class="inventory-source-stats-v11109"><span><b>${fmt.number(summary.materials||0)}</b> materiales</span><span><b>${fmt.number(summary.stockRows||0)}</b> registros físicos</span><span><b>${fmt.number(summary.variants||0)}</b> variantes</span></div>`;
  }catch(error){
    strip.innerHTML=`<div class="inventory-source-main-v11109"><span>SIESA</span><div><strong>Estado de sincronización no disponible</strong><small>${esc(error.message)}</small></div></div>`;
  }
}

function inventoryTable(rows){
  return `<div class="inventory-list-shell-v11109"><div class="inventory-list-head-v11109" aria-hidden="true"><span>Material</span><span>Tipo / bodega</span><span>Físico</span><span>Disp. Siesa</span><span>Reserva CRM</span><span>Para venta</span><span>Comp. / bloqueado</span><span>Lotes</span><span>Acciones</span></div><div class="inventory-list-v11109">${rows.map(inventoryRow).join("")}</div></div>`;
}

function inventoryRow(item){
  const state=inventoryState(item);
  const criteria=(item.attributes?.criteria||[]).map(entry=>entry?.name).filter(Boolean).slice(0,2).join(" · ");
  const warehouses=item.warehouses||[];
  const warehouseText=warehouses.length?`${warehouses.slice(0,2).join(" · ")}${warehouses.length>2?` +${warehouses.length-2}`:""}`:"Sin bodega";
  return `<article class="inventory-row-v11109" data-inventory-row="${esc(item.id)}">
    <div class="inventory-material-cell-v11109"><div class="inventory-reference-line-v11109"><strong>${esc(item.reference)}</strong><span class="inventory-stock-state-v11109 ${state.tone}">${esc(state.label)}</span></div><h3>${esc(item.description)}</h3><p>${esc(criteria||"Maestro oficial Siesa")}</p></div>
    <div class="inventory-trace-cell-v11109"><small>Tipo / bodega</small><strong>${esc(item.itemType==="CUTTABLE"?"Cortable":"Estándar")} · ${esc(item.unit||"—")}</strong><span>${esc(warehouseText)}</span></div>
    ${quantityCell("Físico",item.physicalExistence,item.unit)}
    ${quantityCell("Disponible Siesa",item.available,item.unit)}
    ${quantityCell("Reserva CRM",item.erpReserved,item.unit,"reserved")}
    ${quantityCell("Para venta",item.availableToPromise??item.available,item.unit,"atp")}
    <div class="inventory-dual-cell-v11109"><small>Comp. / bloqueado</small><span><b>${fmt.number(item.siesaCommitted||0,3)}</b><em>Comp.</em></span><span class="${numberValue(item.blocked)>0?"warning":""}"><b>${fmt.number(item.blocked||0,3)}</b><em>Bloq.</em></span></div>
    <div class="inventory-lot-cell-v11109"><small>Lotes</small><strong>${fmt.number(item.lots||0)}</strong><span>${numberValue(item.variantCount)>0?`${fmt.number(item.variantCount)} variante(s)`:"Sin variantes"}</span></div>
    <div class="inventory-row-action-v11109"><button type="button" class="btn btn-primary" data-inventory-detail="${esc(item.id)}">Ver detalle</button>${inventoryCanUpdate?`<button type="button" class="btn btn-ghost" data-inventory-move="${esc(item.id)}">Movimiento</button>`:""}</div>
  </article>`;
}

function quantityCell(label,value,unit,tone=""){
  return `<div class="inventory-quantity-cell-v11109 ${tone}"><small>${esc(label)}</small><strong>${fmt.number(value||0,3)}</strong><span>${esc(unit||"")}</span></div>`;
}

function inventoryState(item){
  if(numberValue(item.blocked)>0)return {tone:"warning",label:"Con bloqueo"};
  if(numberValue(item.availableToPromise??item.available)<=0)return {tone:"danger",label:"Sin disponibilidad"};
  if(numberValue(item.erpReserved)>0)return {tone:"info",label:"Con reserva"};
  return {tone:"success",label:"Disponible"};
}

function bindInventoryActions(target,reload){
  target.querySelectorAll("[data-inventory-detail]").forEach(button=>button.onclick=()=>openInventoryDetail(button.dataset.inventoryDetail,reload));
  target.querySelectorAll("[data-inventory-move]").forEach(button=>button.onclick=()=>movementWizard(reload,button.dataset.inventoryMove));
  target.querySelectorAll("[data-page]").forEach(button=>button.onclick=()=>reload(Number(button.dataset.page)));
}

async function openInventoryDetail(itemId,reload){
  const item=currentItems.find(row=>row.id===itemId);
  if(!item)return toast("El material ya no está disponible en esta vista.","error");

  const [lots,movementData]=await Promise.all([api.inventoryLots(item.id,""),inventoryMovements(item.id,{page:1,pageSize:50})]);
  const view=modal({
    title:`Inventario · ${item.reference}`,
    size:"wide",
    confirmLabel:"",
    cancelLabel:"Cerrar",
    body:detailHtml(item,lots,movementData)
  });
  const dialog=view.root.querySelector(".modal");
  dialog?.classList.add("inventory-detail-modal-v11109");
  bindDetail(view.root,item,lots,movementData,reload);
}

function detailHtml(item,lots,movementData){
  return `<section class="inventory-detail-v11109">
    <header class="inventory-detail-hero-v11109"><div><span>MATERIAL OFICIAL SIESA</span><strong>${esc(item.reference)}</strong><h3>${esc(item.description)}</h3><p>${esc(item.itemType==="CUTTABLE"?"Material cortable":"Material estándar")} · Unidad ${esc(item.unit||"—")} · ${fmt.number(item.lots||0)} registro(s) físico(s)</p></div><div class="inventory-detail-actions-v11109"><button type="button" class="btn btn-search" data-v116-item-labels="${esc(item.id)}">QR / etiquetas</button>${inventoryCanUpdate?`<button type="button" class="btn btn-primary" data-detail-movement="${esc(item.id)}">Registrar movimiento</button>`:""}</div></header>
    <div class="inventory-detail-summary-v11109">${detailMetric("Existencia física",item.physicalExistence,item.unit)}${detailMetric("Disponible Siesa",item.available,item.unit)}${detailMetric("Reserva CRM",item.erpReserved,item.unit)}${detailMetric("Disponible para venta",item.availableToPromise??item.available,item.unit,"success")}${detailMetric("Comprometido Siesa",item.siesaCommitted,item.unit)}${detailMetric("Bloqueado",item.blocked,item.unit,numberValue(item.blocked)>0?"warning":"")}</div>
    <nav class="inventory-detail-tabs-v11109" aria-label="Detalle de inventario"><button type="button" class="active" data-inventory-tab="lots">Lotes y ubicaciones <span>${fmt.number(lots.length)}</span></button><button type="button" data-inventory-tab="movements">Movimientos <span>${fmt.number(movementData?.pagination?.totalItems||0)}</span></button></nav>
    <section data-inventory-panel="lots">${lotsPanel(item,lots)}</section>
    <section data-inventory-panel="movements" hidden>${movementsPanel(movementData?.items||[])}</section>
  </section>`;
}

function detailMetric(label,value,unit,tone=""){
  return `<article class="inventory-detail-metric-v11109 ${tone}"><small>${esc(label)}</small><strong>${fmt.number(value||0,3)}</strong><span>${esc(unit||"")}</span></article>`;
}

function lotsPanel(item,lots){
  if(!lots.length)return empty("Sin lotes activos","Este material no tiene registros físicos activos.");
  return `<div class="inventory-lot-toolbar-v11109"><label><span>Buscar dentro de los lotes</span><input class="control" data-lot-search placeholder="Lote, bodega, ubicación, variante o serie"></label><small>${fmt.number(lots.length)} registro(s)</small></div><div class="inventory-lot-list-shell-v11109"><div class="inventory-lot-head-v11109"><span>Lote / variante</span><span>Bodega / ubicación</span><span>Físico</span><span>Disponible</span><span>Reservado</span><span>Bloqueado</span><span>Vence</span><span>Acciones</span></div><div>${lots.map(lot=>lotRow(item,lot)).join("")}</div></div>`;
}

function lotRow(item,lot){
  const physical=numberValue(lot.available)+numberValue(lot.reserved)+numberValue(lot.blocked);
  const search=[lot.lotNumber,lot.variantLabel,lot.serialNumber,lot.warehouseCode,lot.location,lot.locationName].filter(Boolean).join(" ").toLowerCase();
  return `<article class="inventory-lot-row-v11109" data-lot-search-value="${esc(search)}">
    <div class="inventory-lot-id-v11109"><small>Lote / variante</small><strong>${esc(lot.variantLabel||lot.lotNumber||lot.serialNumber||"Sin lote")}</strong><span>${esc([lot.lotNumber,lot.serialNumber].filter(Boolean).join(" · ")||"Sin serie")}</span></div>
    <div class="inventory-lot-location-v11109"><small>Bodega / ubicación</small><strong>${esc(lot.warehouseCode||"Sin bodega")}</strong><span>${esc([lot.location,lot.locationName].filter(Boolean).join(" · ")||"Sin ubicación")}</span></div>
    ${lotQty("Físico",physical,item.unit)}${lotQty("Disponible",lot.available,item.unit,"success")}${lotQty("Reservado",lot.reserved,item.unit)}${lotQty("Bloqueado",lot.blocked,item.unit,numberValue(lot.blocked)>0?"warning":"")}
    <div class="inventory-lot-text-v11109"><small>Vence</small><strong>${lot.expiresAt?fmt.day(lot.expiresAt):"—"}</strong><span>${esc(lot.sourceSystem||"ERP")}</span></div>
    <div class="inventory-lot-actions-v11109">${inventoryCanUpdate?`<button type="button" class="btn btn-ghost" data-count-lot="${esc(lot.id)}">Conteo físico</button><button type="button" class="btn btn-primary" data-move-lot="${esc(lot.id)}">Movimiento</button>`:'<span class="inventory-readonly-v11109">Consulta</span>'}</div>
  </article>`;
}

function lotQty(label,value,unit,tone=""){
  return `<div class="inventory-lot-qty-v11109 ${tone}"><small>${esc(label)}</small><strong>${fmt.number(value||0,3)}</strong><span>${esc(unit||"")}</span></div>`;
}

function movementsPanel(rows){
  if(!rows.length)return empty("Sin movimientos registrados","Los movimientos manuales y operativos aparecerán aquí cuando se registren.");
  return `<div class="inventory-movement-shell-v11109"><div class="inventory-movement-head-v11109"><span>Fecha</span><span>Movimiento</span><span>Cantidad</span><span>Lote / ubicación</span><span>Responsable</span><span>Pedido / referencia</span></div><div>${rows.map(movementRow).join("")}</div></div>`;
}

function movementRow(row){
  const outgoing=OUTGOING_TYPES.has(row.movementType)||row.movementType==="TRANSFER_OUT";
  return `<article class="inventory-movement-row-v11109"><div><small>Fecha</small><strong>${fmt.date(row.createdAt)}</strong></div><div><small>Movimiento</small><strong>${esc(fmt.label(row.movementType))}</strong></div><div class="${outgoing?"outgoing":"incoming"}"><small>Cantidad</small><strong>${outgoing?"−":"+"}${fmt.number(row.quantity||0,3)} ${esc(row.unit||"")}</strong></div><div><small>Lote / ubicación</small><strong>${esc(row.variantLabel||row.lotNumber||row.serialNumber||"—")}</strong><span>${esc([row.warehouseCode,row.location].filter(Boolean).join(" · ")||"—")}</span></div><div><small>Responsable</small><strong>${esc(row.actorName||"Sistema / no identificado")}</strong></div><div><small>Pedido / referencia</small><strong>${esc(row.orderNumber||"Sin pedido")}</strong><span>${esc(row.reference||"Sin observación")}</span></div></article>`;
}

function bindDetail(root,item,lots,movementData,reload){
  root.querySelectorAll("[data-inventory-tab]").forEach(button=>button.onclick=()=>{
    const tab=button.dataset.inventoryTab;
    root.querySelectorAll("[data-inventory-tab]").forEach(itemButton=>itemButton.classList.toggle("active",itemButton===button));
    root.querySelectorAll("[data-inventory-panel]").forEach(panel=>panel.hidden=panel.dataset.inventoryPanel!==tab);
  });
  const search=root.querySelector("[data-lot-search]");
  if(search)search.oninput=()=>{
    const query=search.value.trim().toLowerCase();
    root.querySelectorAll("[data-lot-search-value]").forEach(row=>row.hidden=Boolean(query)&&!row.dataset.lotSearchValue.includes(query));
  };
  root.querySelector("[data-detail-movement]")?.addEventListener("click",()=>movementWizard(reload,item.id,null,true));
  root.querySelectorAll("[data-move-lot]").forEach(button=>button.onclick=()=>movementWizard(reload,item.id,button.dataset.moveLot,true));
  root.querySelectorAll("[data-count-lot]").forEach(button=>{
    const lot=lots.find(entry=>entry.id===button.dataset.countLot);
    if(lot)button.onclick=()=>physicalCount(item,lot,reload);
  });
}

function physicalCount(item,lot,reload){
  const previousPhysical=numberValue(lot.available)+numberValue(lot.reserved)+numberValue(lot.blocked);
  const immutableCommitment=numberValue(lot.reserved)+numberValue(lot.blocked);
  modal({
    title:`Conteo físico · ${item.reference}`,
    size:"wide",
    confirmLabel:"Registrar conteo",
    cancelLabel:"Cancelar",
    body:`<section class="inventory-count-v11109"><header><span>CONTEO FÍSICO</span><strong>${esc(lot.variantLabel||lot.lotNumber||"Lote")}</strong><p>${esc([lot.warehouseCode,lot.location,lot.locationName].filter(Boolean).join(" · ")||"Sin ubicación")}</p></header><div class="inventory-count-summary-v11109"><article><small>Físico registrado</small><strong>${qty(previousPhysical,item.unit)}</strong></article><article><small>Reservado / comprometido</small><strong>${qty(lot.reserved,item.unit)}</strong></article><article><small>Bloqueado</small><strong>${qty(lot.blocked,item.unit)}</strong></article></div><div class="form-grid"><div class="field"><label>Cantidad contada *</label><input class="control" name="countedPhysical" type="number" min="0" step="any" value="${previousPhysical}" required></div><div class="field full"><label>Motivo / referencia del conteo *</label><input class="control" name="countReason" maxlength="160" placeholder="Ej. Conteo cíclico septiembre" required></div></div><div class="inventory-count-result-v11109" data-count-result>Sin diferencia frente al registro actual.</div></section>`,
    onConfirm:async dialog=>{
      const counted=Number(dialog.querySelector('[name="countedPhysical"]').value);
      const reason=dialog.querySelector('[name="countReason"]').value.trim();
      if(counted<immutableCommitment)throw new Error(`El conteo no puede ser menor que ${fmt.number(immutableCommitment,3)} ${item.unit}, porque esa cantidad está reservada o bloqueada.`);
      const targetAvailable=counted-immutableCommitment;
      const delta=targetAvailable-numberValue(lot.available);
      if(Math.abs(delta)<0.0000001){toast("Conteo registrado sin diferencia de inventario.","success");return}
      await api.inventoryAdjust({
        itemId:item.id,
        lotId:lot.id,
        movementType:delta>0?"ADJUSTMENT_IN":"ADJUSTMENT_OUT",
        quantity:Math.abs(delta),
        fromLocation:lot.location||null,
        toLocation:lot.location||null,
        reference:`CONTEO FÍSICO · ${reason}`,
        metadata:{source:"PHYSICAL_COUNT",previousPhysical,countedPhysical:counted,previousAvailable:numberValue(lot.available),targetAvailable}
      });
      toast(`Conteo aplicado. Diferencia: ${delta>0?"+":""}${fmt.number(delta,3)} ${item.unit}.`,"success",6500);
      await reload(currentPage);
      setTimeout(()=>openInventoryDetail(item.id,reload),0);
    }
  });
  const modalRoot=document.querySelector("#modal-root");
  const input=modalRoot?.querySelector('[name="countedPhysical"]');
  const result=modalRoot?.querySelector("[data-count-result]");
  if(input&&result)input.oninput=()=>{
    const counted=Number(input.value||0);
    const targetAvailable=counted-immutableCommitment;
    const delta=targetAvailable-numberValue(lot.available);
    result.textContent=Math.abs(delta)<0.0000001?"Sin diferencia frente al registro actual.":`Diferencia prevista: ${delta>0?"+":""}${fmt.number(delta,3)} ${item.unit}.`;
    result.classList.toggle("negative",delta<0);
    result.classList.toggle("positive",delta>0);
  };
}

async function movementWizard(reload,preselectedId,preselectedLotId=null,reopenDetail=false){
  const item=currentItems.find(entry=>entry.id===preselectedId);
  if(!item)return toast("El material ya no está disponible en esta vista.","error");
  const lots=await api.inventoryLots(item.id,"");
  if(!lots.length)return toast("Este material no tiene lotes activos para registrar un movimiento.","error");

  const assistant=wizard({
    title:`Movimiento · ${item.reference}`,
    subtitle:`${item.description}. Selecciona el lote exacto y registra únicamente el movimiento real.`,
    finishLabel:"Registrar movimiento",
    steps:[
      {title:"Seleccionar lote",description:"Bodega, ubicación, lote y variante determinan qué existencia será afectada.",content:`<div class="inventory-move-lots-v11109">${lots.map((lot,index)=>movementLotChoice(item,lot,preselectedLotId?lot.id===preselectedLotId:index===0)).join("")}</div>`},
      {title:"Tipo y cantidad",description:"Los movimientos se registran sobre el lote seleccionado. El traslado se habilitará cuando exista una operación atómica origen-destino.",content:`<div class="wizard-choice-grid inventory-movement-types-v11109">${choice("movementType","ADJUSTMENT_IN","Ajuste de entrada","Corrige una diferencia aumentando el disponible.",true)}${choice("movementType","ADJUSTMENT_OUT","Ajuste de salida","Corrige una diferencia disminuyendo el disponible.")}${choice("movementType","ISSUE","Salida a operación","Entrega material a una operación interna.")}${choice("movementType","RETURN","Devolución","Devuelve cantidad al disponible del lote.")}${choice("movementType","SCRAP","Desperdicio","Registra pérdida, daño o descarte.")}</div><div class="form-grid"><div class="field"><label>Cantidad *</label><input class="control" name="quantity" type="number" min="0.0001" step="any" required></div><div class="field full"><label>Motivo / referencia *</label><input class="control" name="reference" maxlength="160" required></div></div><p class="inventory-transfer-note-v11109">Los traslados entre ubicaciones no se ofrecen aquí hasta que origen y destino puedan confirmarse en una única transacción.</p>`},
      {title:"Confirmar",description:"Verifica material, lote, tipo y cantidad antes de registrar el movimiento.",content:`<section class="inventory-official-confirm"><span>SIESA</span><div><strong>${esc(item.reference)}</strong><h4>${esc(item.description)}</h4><p>${esc(item.unit)} · La identidad del material no puede modificarse.</p></div></section><div class="wizard-summary"><div class="wizard-summary-item"><label>Lote / ubicación</label><strong data-move-lot-summary>—</strong></div><div class="wizard-summary-item"><label>Movimiento</label><strong data-move-type-summary>—</strong></div><div class="wizard-summary-item"><label>Cantidad</label><strong data-move-quantity-summary>—</strong></div></div>`,onEnter:({root,data})=>{
        const lot=lots.find(entry=>entry.id===data.lotId);
        root.querySelector("[data-move-lot-summary]").textContent=lot?[lot.variantLabel||lot.lotNumber,lot.warehouseCode,lot.location].filter(Boolean).join(" · "):"—";
        root.querySelector("[data-move-type-summary]").textContent=fmt.label(data.movementType);
        root.querySelector("[data-move-quantity-summary]").textContent=`${data.quantity||"—"} ${item.unit}`;
      }}
    ],
    onFinish:async({data})=>{
      const lot=lots.find(entry=>entry.id===data.lotId);
      if(!lot)throw new Error("Selecciona un lote válido.");
      const outgoing=OUTGOING_TYPES.has(data.movementType);
      await api.inventoryAdjust({...data,itemId:item.id,fromLocation:outgoing?(lot.location||null):null,toLocation:outgoing?null:(lot.location||null),metadata:{source:"INVENTORY_MANUAL",warehouseCode:lot.warehouseCode||null,lotNumber:lot.lotNumber||null}});
      toast("Movimiento registrado sobre el lote oficial.","success");
      await reload(currentPage);
      if(reopenDetail)setTimeout(()=>openInventoryDetail(item.id,reload),0);
    }
  });
  return assistant;
}

function movementLotChoice(item,lot,checked){
  const physical=numberValue(lot.available)+numberValue(lot.reserved)+numberValue(lot.blocked);
  return `<label class="inventory-move-lot-choice-v11109"><input type="radio" name="lotId" value="${esc(lot.id)}" ${checked?"checked":""} required><span><strong>${esc(lot.variantLabel||lot.lotNumber||lot.serialNumber||"Lote")}</strong><small>${esc([lot.warehouseCode,lot.location,lot.locationName].filter(Boolean).join(" · ")||"Sin ubicación")}</small><b>Disponible ${qty(lot.available,item.unit)} · Físico ${qty(physical,item.unit)}</b></span></label>`;
}

function openSiesaSync(onDone){
  const instance=modal({
    title:"Actualizar maestro oficial Siesa",
    size:"wide",
    confirmLabel:"Validar y actualizar",
    body:`<section class="siesa-sync-intro"><span>SIESA</span><div><strong>Actualización completa y transaccional</strong><p>Selecciona el Excel exportado desde Siesa. El catálogo actual no cambia hasta que todas las filas hayan sido validadas y aplicadas correctamente.</p></div></section><label class="siesa-file-drop"><input type="file" accept=".xls,.xlsx,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" data-siesa-file required><span>Seleccionar archivo</span><strong data-siesa-file-name>Ningún archivo seleccionado</strong><small>Debe contener Referencia Item, Nombre Item, Unidad, Bodega, Ubicación, Lote y cantidades.</small></label><section class="siesa-progress" data-siesa-progress hidden><div><span data-siesa-progress-label>Validando…</span><strong data-siesa-progress-value>0%</strong></div><progress max="100" value="0"></progress><p data-siesa-progress-detail></p></section><div class="siesa-rules"><strong>Reglas de seguridad</strong><ul><li>Una referencia no puede tener dos nombres o unidades diferentes.</li><li>Cada fila física debe ser única por referencia, bodega, ubicación, lote y variante.</li><li>Los materiales ausentes del nuevo snapshot se desactivan, no se borran.</li><li>Los registros de prueba no vinculados al maestro quedan fuera del inventario operativo.</li></ul></div>`,
    onConfirm:async dialog=>{
      const file=dialog.querySelector("[data-siesa-file]").files?.[0];
      if(!file)throw new Error("Selecciona el archivo exportado de Siesa.");
      const progress=dialog.querySelector("[data-siesa-progress]");
      const bar=progress.querySelector("progress");
      const label=progress.querySelector("[data-siesa-progress-label]");
      const value=progress.querySelector("[data-siesa-progress-value]");
      const detail=progress.querySelector("[data-siesa-progress-detail]");
      progress.hidden=false;
      const result=await syncSiesaFile(file,state=>{
        const pct=Number(state.progress||0);bar.value=pct;value.textContent=`${pct}%`;
        label.textContent=state.phase==="validated"?"Archivo validado":state.phase==="upload"?"Enviando filas a Supabase":state.phase==="apply"?"Aplicando snapshot oficial":"Actualización terminada";
        detail.textContent=state.phase==="validated"?`${state.materials} materiales únicos · ${state.rows.length} registros físicos`:state.phase==="upload"?`${state.sent} de ${state.total} filas`:state.phase==="apply"?"Validando identidades, variantes, lotes y existencias…":"Maestro actualizado correctamente.";
      });
      const summary=result.summary||result.result?.summary||{};
      toast(`Maestro Siesa actualizado: ${summary.materials||result.parsed.materials} materiales y ${summary.stockRows||result.parsed.rows.length} registros físicos.`,"success",8000);
      await onDone?.();
    }
  });
  const fileInput=instance.root.querySelector("[data-siesa-file]");
  fileInput.addEventListener("change",()=>{instance.root.querySelector("[data-siesa-file-name]").textContent=fileInput.files?.[0]?.name||"Ningún archivo seleccionado"});
}
