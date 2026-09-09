import {api} from "../services/api.js";
import {inventoryMovements} from "../services/inventory.js";
import {fmt} from "../core/format.js";
import {empty,loading,toast} from "../core/ui.js";
import {inventoryEnterpriseRow,inventoryListHeader} from "./inventory-ui-v11240.js";
import {downloadCsv,dateStamp} from "./inventory-export-v11250.js";

const esc=v=>fmt.escape(v??"");
let selected=null,lastMoves=null;

export async function renderInventoryLedger(root){
  root.innerHTML=`<section class="page-head inventory-page-head-v11109"><div><span class="inventory-kicker-v11109">KARDEX Y TRAZABILIDAD</span><h2>Movimientos de inventario</h2><p>Busca una referencia y revisa entradas, salidas, ajustes, conteos aprobados y ubicación del movimiento.</p></div><div class="page-actions"><button class="btn btn-ghost" id="ledger-export" disabled>Exportar CSV</button><button class="btn btn-primary" id="ledger-refresh">Actualizar</button></div></section>
  <section class="inventory-filter-shell-v11109"><div class="inventory-search-main-v11109"><label>Buscar material</label><div class="inventory-search-control-v11109"><input class="control" id="ledger-q" autocomplete="off" placeholder="Referencia o descripción"><button class="btn btn-search" id="ledger-search">Buscar</button></div><small>Selecciona una referencia para abrir su kardex.</small></div></section>
  <section class="inventory-results-v11109">${inventoryListHeader({eyebrow:"SELECCIÓN",title:"Material",detail:"Primero identifica la referencia"})}<div id="ledger-materials">${empty("Busca una referencia","Escribe al menos dos caracteres.")}</div></section>
  <section class="inventory-results-v11109">${inventoryListHeader({eyebrow:"KARDEX",title:"Movimientos",detail:"Trazabilidad cronológica"})}<div id="ledger-moves">${empty("Sin material seleccionado","Elige una referencia para consultar movimientos.")}</div></section>`;
  const runSearch=()=>searchMaterials(root).catch(e=>toast(e.message,"error",7000));
  root.querySelector("#ledger-search").onclick=runSearch;root.querySelector("#ledger-q").onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();runSearch()}};
  root.querySelector("#ledger-refresh").onclick=()=>selected?loadMoves(root,selected):runSearch();
  root.querySelector("#ledger-export").onclick=()=>exportMoves();
}

async function searchMaterials(root){
  const q=root.querySelector("#ledger-q").value.trim(),host=root.querySelector("#ledger-materials");
  if(q.length<2){host.innerHTML=empty("Búsqueda muy corta","Escribe al menos dos caracteres.");return}
  host.innerHTML=loading("Buscando materiales…");
  const data=await api.inventoryFiltered({search:q,stock:"",unit:"",warehouse:"",itemType:"",variants:"ALL",sort:"reference_asc",page:1,pageSize:25});
  const rows=data.items||[];
  host.innerHTML=rows.length?`<section class="v115-goods-list">${rows.map(materialRow).join("")}</section>`:empty("Sin resultados","No se encontraron materiales.");
  host.querySelectorAll("[data-ledger-item]").forEach(btn=>btn.onclick=()=>{selected=rows.find(x=>x.id===btn.dataset.ledgerItem);loadMoves(root,selected).catch(e=>toast(e.message,"error",7000))});
}
function materialRow(i){return inventoryEnterpriseRow({eyebrow:i.itemType==="CUTTABLE"?"CABLE / CORTABLE":"MATERIAL",reference:i.reference,description:i.description,subline:(i.warehouses||[]).join(" · ")||"Sin bodega",meta:[{label:"Unidad",value:i.unit||"—"},{label:"Lotes",value:fmt.number(i.lots||0)},{label:"Físico",value:fmt.number(i.physicalExistence||0,3)},{label:"Disponible",value:fmt.number(i.availableToPromise||0,3)}],statusLabel:"Consultar kardex",statusDetail:"Movimientos y ajustes",statusTone:"linked",actions:`<button class="btn btn-primary" data-ledger-item="${esc(i.id)}">Abrir</button>`})}

async function loadMoves(root,item){
  if(!item)return;const host=root.querySelector("#ledger-moves");host.innerHTML=loading("Consultando movimientos…");
  const data=await inventoryMovements(item.id,{page:1,pageSize:100});lastMoves=data;
  const rows=data.items||[];root.querySelector("#ledger-export").disabled=!rows.length;
  host.innerHTML=`<div class="card-pad"><strong>${esc(item.reference)} · ${esc(item.description)}</strong><small>${fmt.number(data.pagination?.totalItems||0)} movimiento(s) registrados</small></div>${rows.length?`<section class="v115-goods-list">${rows.map(moveRow).join("")}</section>`:empty("Sin movimientos","No hay trazabilidad registrada para esta referencia.")}`;
}
function moveRow(m){
  const qty=Number(m.quantity||0),tone=qty<0?"standalone":"linked";
  return inventoryEnterpriseRow({eyebrow:m.movementType||"MOVIMIENTO",reference:m.reference||selected?.reference||"Movimiento",description:fmt.date(m.createdAt),subline:m.actorName||"Sistema",meta:[{label:"Cantidad",value:`${qty>0?"+":""}${fmt.number(qty,3)} ${m.unit||selected?.unit||""}`},{label:"Bodega",value:m.warehouseCode||"—"},{label:"Ubicación",value:m.location||"—"},{label:"Lote",value:m.lotNumber||m.serialNumber||"—"}],statusLabel:m.movementType||"Registrado",statusDetail:m.source||"Trazabilidad CRM",statusTone:tone});
}
function exportMoves(){
  const rows=lastMoves?.items||[];if(!rows.length)return toast("No hay movimientos para exportar.","warning");
  downloadCsv(`inventario-movimientos-${selected?.reference||"material"}-${dateStamp()}.csv`,rows.map(m=>({fecha:m.createdAt,tipo:m.movementType,referencia:selected?.reference||m.reference||"",descripcion:selected?.description||"",cantidad:m.quantity,unidad:m.unit||selected?.unit||"",bodega:m.warehouseCode||"",ubicacion:m.location||"",lote:m.lotNumber||m.serialNumber||"",responsable:m.actorName||"",origen:m.source||""})));
}
