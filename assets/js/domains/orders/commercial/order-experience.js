import { upgradePageHead, upgradeActionIcon, insertJourney } from "./workspace-header.js";
import { upgradeOrdersSearch } from "./order-search.js";

export function enhanceOrders(root,mode){
  if(root.querySelector("[data-commercial-orders-ready]"))return;
  const marker=document.createElement("span");
  marker.hidden=true;
  marker.dataset.commercialOrdersReady="1";
  root.prepend(marker);

  upgradePageHead(root,{
    kicker:mode==="sales"?"GESTIÓN COMERCIAL":"GESTIÓN DE PEDIDOS",
    title:mode==="sales"?"Ventas y creación de pedidos":"Pedidos fáciles de encontrar y gestionar",
    description:mode==="sales"?"Crea el pedido con una guía paso a paso y consulta después su avance sin perderte entre filtros.":"Busca por número o cliente, revisa el estado y abre solamente el pedido que necesitas gestionar.",
    primarySource:"#create-order",
    primaryLabel:"Crear pedido",
    primaryIcon:"plus"
  });

  upgradeActionIcon(root,"#create-order","plus","Crear pedido");
  upgradeActionIcon(root,"#show-all-orders","search","Buscar pedidos");
  upgradeActionIcon(root,"#show-my-orders","check","Mis pedidos");
  upgradeActionIcon(root,"#orders-help","activity","Ayuda rápida");

  const workspace=root.querySelector(".guided-workspace");
  if(workspace){
    workspace.classList.add("commercial-action-workspace");
    workspace.querySelector(".guided-workspace-head h3")?.replaceChildren(document.createTextNode(mode==="sales"?"Empieza por aquí":"Acciones principales"));
    const description=workspace.querySelector(".guided-workspace-head p");
    if(description)description.textContent=mode==="sales"?"La opción principal es crear. Las demás sirven para consultar o retomar pedidos existentes.":"Elige una acción. La búsqueda básica está siempre visible y los filtros detallados son opcionales.";
  }

  insertJourney(workspace,mode==="sales"?[
    ["1","Crear","Registra cliente, entrega y materiales"],
    ["2","Revisar","Confirma la información antes de guardar"],
    ["3","Enviar","El sistema define la ruta inicial"],
    ["4","Seguir","Consulta el pedido cuando lo necesites"]
  ]:[
    ["1","Buscar","Número de pedido, cliente o referencia"],
    ["2","Abrir","Revisa estado, etapa y responsable"],
    ["3","Gestionar","Continúa solamente la etapa activa"],
    ["4","Confirmar","La trazabilidad se registra automáticamente"]
  ],mode==="sales"?"Cómo crear y seguir un pedido":"Cómo gestionar un pedido");

  upgradeOrdersSearch(root);
}
