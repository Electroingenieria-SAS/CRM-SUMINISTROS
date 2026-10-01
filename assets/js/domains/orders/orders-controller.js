import { state, can } from "../../core/state.js";
import { fmt } from "../../core/format.js";
import { loading, actionCards, guide } from "../../core/ui.js";
import { workspaceIntro } from "../../core/guided.js";
import { currentList } from "./orders-state.js";
import { setFilters, select, simpleSelect } from "./list/filters.js";
import { loadOrders } from "./list/load-orders.js";
import { openCreateOrder } from "./create/create-order.js";
import { exportCurrent } from "./list/export-orders.js";

export async function renderOrders(root,{moduleId="orders",params={}}={}){
  currentList.root=root;
  currentList.filters={...currentList.filters,...params,page:Number(params.page||1)};
  if(params.history==="0")currentList.filters.includeHistory=false;
  const canCreate=can("orders","canCreate")||can("sales","canCreate");
  const cards=[
    ...(canCreate?[{id:"create-order",title:"Crear pedido",description:"Registra la información esencial y los materiales en tres pasos.",icon:"＋",tone:"accent"}]:[]),
    {id:"show-all-orders",title:"Buscar pedidos",description:"Encuentra operación activa o historial en una sola vista.",icon:"⌕",tone:"primary"},
    {id:"show-my-orders",title:"Mis pedidos",description:"Muestra lo que requiere tu atención.",icon:"✓",tone:"success"},
    {id:"orders-help",title:"Ayuda rápida",description:"Aprende a gestionar un pedido desde una sola ventana.",icon:"?"}
  ];
  root.innerHTML=`
    <section class="page-head"><div><h2>${moduleId==="sales"?"Registro y control comercial":"Control integral de pedidos"}</h2><p>Selecciona una opción, encuentra el pedido visualmente y sigue el asistente de la operación.</p></div><div class="page-actions"><button class="btn btn-ghost" id="export-list">Exportar resultados</button></div></section>
    ${workspaceIntro({title:moduleId==="sales"?"¿Qué necesitas registrar?":"¿Qué deseas hacer con los pedidos?",description:"Las tarjetas muestran las opciones habilitadas para tu usuario. Ningún formulario extenso se presenta de una sola vez.",cards:actionCards(cards)})}
    <section class="card card-pad">
      <div class="toolbar">
        <input class="control search-wide" id="f-search" placeholder="Buscar pedido, cliente o referencia" value="${fmt.escape(currentList.filters.search||"")}">
        ${select("f-step","Etapa",state.catalogs.steps,"code","name",currentList.filters.step)}
        ${simpleSelect("f-status","Estado",["QUEUED","ASSIGNED","IN_PROGRESS","WAITING","BLOCKED","CLOSED","CANCELLED"],currentList.filters.status)}
        ${select("f-type","Tipo",state.catalogs.orderTypes,"code","name",currentList.filters.orderType)}
        ${select("f-route","Modalidad",state.catalogs.deliveryRoutes,"code","name",currentList.filters.route)}
        ${simpleSelect("f-assignment","Asignación",["ALL","MINE","UNASSIGNED"],currentList.filters.assignment)}
        <label class="filter-pill"><input type="checkbox" id="f-history" ${currentList.filters.includeHistory!==false?"checked":""}> Incluir historial</label>
        <button class="btn btn-search" id="apply-filters">Buscar</button>
      </div>
      <div class="selection-hint"><strong>Lista de pedidos</strong><span>Usa los filtros y abre el pedido desde la acción de la derecha. La lista está pensada para operar alto volumen sin perder contexto.</span></div>
      <div id="orders-result">${loading("Cargando pedidos…")}</div>
    </section>`;

  root.querySelector("#create-order")?.addEventListener("click",openCreateOrder);
  root.querySelector("#show-all-orders").onclick=()=>{setFilters({assignment:"ALL",status:"",includeHistory:true});loadOrders(1)};
  root.querySelector("#show-my-orders").onclick=()=>{setFilters({assignment:"MINE",status:"",includeHistory:false});loadOrders(1)};
    root.querySelector("#orders-help").onclick=()=>guide({title:"Cómo gestionar pedidos",description:"Todo el trabajo se realiza desde una lista y una sola ventana guiada.",items:[{title:"Busca el pedido",detail:"Usa el número, cliente o filtros de la operación."},{title:"Usa Abrir / Continuar",detail:"La acción está siempre a la derecha de la fila."},{title:"Sigue el paso activo",detail:"El popup muestra únicamente la decisión actual y oculta lo que todavía no corresponde."},{title:"Confirma y continúa",detail:"El siguiente paso se habilita cuando la información necesaria está completa."}]});
  root.querySelector("#apply-filters").onclick=()=>loadOrders(1);
  root.querySelector("#f-search").onkeydown=event=>{if(event.key==="Enter")loadOrders(1)};
  root.querySelector("#export-list").onclick=exportCurrent;
  if(moduleId==="sales"&&params.create==="1")openCreateOrder();
  await loadOrders(currentList.filters.page);
}
