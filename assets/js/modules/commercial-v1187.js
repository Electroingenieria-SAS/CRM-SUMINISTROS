import {icon} from "../core/icons.js";

let queued=false;
let pageObserver=null;

function schedule(){
  if(queued)return;
  queued=true;
  requestAnimationFrame(()=>{
    queued=false;
    enhanceCommercialExperience();
  });
}

function moduleHint(){
  const hash=String(location.hash||"").toLowerCase();
  if(hash.includes("credit"))return "credit";
  if(hash.includes("sales"))return "sales";
  if(hash.includes("orders"))return "orders";
  return "";
}

function enhanceCommercialExperience(){
  const root=document.querySelector("#page-content");
  if(!root)return;
  const isOrders=Boolean(root.querySelector("#orders-result"));
  const isCredit=Boolean(root.querySelector("#credit-result"));
  root.classList.toggle("commercial-v1187",isOrders||isCredit);
  root.classList.remove("commercial-orders-v1187","commercial-sales-v1187","commercial-credit-v1187");

  if(isOrders){
    const mode=moduleHint()==="sales"||root.querySelector(".page-head h2")?.textContent?.includes("comercial")?"sales":"orders";
    root.classList.add(mode==="sales"?"commercial-sales-v1187":"commercial-orders-v1187");
    enhanceOrders(root,mode);
    refreshOrderResultMeta(root);
  }else if(isCredit){
    root.classList.add("commercial-credit-v1187");
    enhanceCredit(root);
    refreshCreditResultMeta(root);
  }
  enhanceCommercialWizards();
}

function enhanceOrders(root,mode){
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

function upgradePageHead(root,{kicker,title,description,primarySource,primaryLabel,primaryIcon}){
  const head=root.querySelector(".page-head");
  if(!head||head.dataset.commercialHead)return;
  head.dataset.commercialHead="1";
  head.classList.add("commercial-page-head");
  const copy=head.firstElementChild;
  if(copy){
    const oldTitle=copy.querySelector("h2");
    const oldDescription=copy.querySelector("p");
    if(!copy.querySelector(".commercial-kicker")){
      const span=document.createElement("span");
      span.className="commercial-kicker";
      span.textContent=kicker;
      copy.insertBefore(span,oldTitle||copy.firstChild);
    }
    if(oldTitle)oldTitle.textContent=title;
    if(oldDescription)oldDescription.textContent=description;
  }
  const source=root.querySelector(primarySource);
  const actions=head.querySelector(".page-actions")||head.appendChild(document.createElement("div"));
  actions.classList.add("page-actions","commercial-page-actions");
  if(source&&!actions.querySelector("[data-commercial-primary]")){
    const button=document.createElement("button");
    button.type="button";
    button.className="btn btn-create commercial-primary-action";
    button.dataset.commercialPrimary="1";
    button.innerHTML=`${icon(primaryIcon)}<span>${primaryLabel}</span>`;
    button.addEventListener("click",()=>source.click());
    actions.prepend(button);
  }
}

function upgradeActionIcon(root,selector,iconName,label){
  const card=root.querySelector(selector);
  if(!card)return;
  card.classList.add("commercial-action-card");
  card.setAttribute("aria-label",label);
  const holder=card.querySelector(".guided-action-icon");
  if(holder){
    holder.innerHTML=icon(iconName,"commercial-action-svg");
    holder.dataset.commercialIcon="1";
  }
}

function insertJourney(workspace,steps,title){
  if(!workspace||workspace.nextElementSibling?.classList.contains("commercial-journey"))return;
  const section=document.createElement("section");
  section.className="commercial-journey";
  section.innerHTML=`<header><span>RUTA SIMPLE</span><strong>${title}</strong></header><div class="commercial-journey-steps">${steps.map(([number,name,detail])=>`<div class="commercial-journey-step"><b>${number}</b><span><strong>${name}</strong><small>${detail}</small></span></div>`).join("")}</div>`;
  workspace.after(section);
}

function upgradeOrdersSearch(root){
  const toolbar=root.querySelector("#orders-result")?.closest(".card")?.querySelector(".toolbar");
  if(!toolbar||toolbar.dataset.commercialSearch)return;
  toolbar.dataset.commercialSearch="1";
  const card=toolbar.closest(".card");
  card?.classList.add("commercial-results-card");
  const search=toolbar.querySelector("#f-search");
  const apply=toolbar.querySelector("#apply-filters");
  if(!search||!apply)return;

  const shell=document.createElement("section");
  shell.className="commercial-search-shell";
  shell.innerHTML=`
    <header class="commercial-search-head"><div><span>BUSCAR PEDIDO</span><h3>¿Qué pedido necesitas?</h3><p>Escribe el número, el cliente o una referencia. Para la mayoría de consultas no necesitas ningún otro filtro.</p></div><div class="commercial-search-hint">Puedes escribir y presionar Enter</div></header>
    <div class="commercial-search-primary"><div class="commercial-search-input"></div><div class="commercial-search-button"></div></div>
    <div class="commercial-presets" aria-label="Consultas rápidas">
      <button type="button" data-order-preset="all">Todos</button>
      <button type="button" data-order-preset="mine">Mis pedidos</button>
      <button type="button" data-order-preset="active">Activos</button>
      <button type="button" data-order-preset="history">Cerrados / historial</button>
    </div>
    <details class="commercial-advanced-filters"><summary><span>${icon("search")} Filtros avanzados</span><small>Etapa, estado, tipo, modalidad y asignación</small></summary><div class="commercial-advanced-grid"></div><footer><button type="button" class="btn btn-ghost" data-clear-order-filters>Limpiar filtros</button></footer></details>`;

  const inputHost=shell.querySelector(".commercial-search-input");
  inputHost.append(search);
  search.classList.add("commercial-main-search");
  search.placeholder="Ejemplo: PVC-5001, Comercial ABC o referencia";
  const buttonHost=shell.querySelector(".commercial-search-button");
  buttonHost.append(apply);
  apply.innerHTML=`${icon("search")}<span>Buscar pedido</span>`;
  apply.classList.add("commercial-search-cta");

  const advanced=shell.querySelector(".commercial-advanced-grid");
  [...toolbar.children].forEach(node=>advanced.append(node));
  toolbar.replaceWith(shell);

  shell.querySelectorAll("[data-order-preset]").forEach(button=>button.addEventListener("click",()=>{
    applyOrderPreset(root,button.dataset.orderPreset);
    shell.querySelectorAll("[data-order-preset]").forEach(item=>item.classList.toggle("active",item===button));
  }));
  shell.querySelector("[data-clear-order-filters]")?.addEventListener("click",()=>{
    ["#f-step","#f-status","#f-type","#f-route"].forEach(selector=>{const el=root.querySelector(selector);if(el)el.value=""});
    const assignment=root.querySelector("#f-assignment");if(assignment)assignment.value="ALL";
    const history=root.querySelector("#f-history");if(history)history.checked=true;
    if(search)search.value="";
    shell.querySelectorAll("[data-order-preset]").forEach(item=>item.classList.remove("active"));
    apply.click();
  });

  const hint=card?.querySelector(".selection-hint");
  if(hint){
    hint.classList.add("commercial-result-heading");
    hint.innerHTML=`<div><span>RESULTADOS</span><strong>Pedidos encontrados</strong></div><div class="commercial-result-summary"><b data-commercial-order-count>—</b><small>visibles en esta página</small></div>`;
  }
}

function applyOrderPreset(root,preset){
  const search=root.querySelector("#f-search");
  const status=root.querySelector("#f-status");
  const assignment=root.querySelector("#f-assignment");
  const history=root.querySelector("#f-history");
  ["#f-step","#f-type","#f-route"].forEach(selector=>{const el=root.querySelector(selector);if(el)el.value=""});
  if(status)status.value="";
  if(assignment)assignment.value="ALL";
  if(history)history.checked=true;
  if(preset==="mine"){
    if(assignment)assignment.value="MINE";
    if(history)history.checked=false;
  }else if(preset==="active"){
    if(history)history.checked=false;
  }else if(preset==="history"){
    if(status)status.value="CLOSED";
    if(history)history.checked=true;
  }
  root.querySelector("#apply-filters")?.click();
  search?.focus({preventScroll:true});
}

function refreshOrderResultMeta(root){
  const count=root.querySelector("[data-commercial-order-count]");
  if(count)count.textContent=String(root.querySelectorAll("#orders-result .orders-master-row").length);
  root.querySelectorAll("#orders-result .orders-master-row").forEach(row=>row.classList.add("commercial-order-row"));
}

function enhanceCredit(root){
  if(root.querySelector("[data-commercial-credit-ready]"))return;
  const marker=document.createElement("span");
  marker.hidden=true;
  marker.dataset.commercialCreditReady="1";
  root.prepend(marker);

  upgradePageHead(root,{
    kicker:"CRÉDITO Y CARTERA",
    title:"Crédito claro, guiado y trazable",
    description:"Radica una solicitud, identifica en qué momento está y registra la decisión sin navegar entre pantallas confusas.",
    primarySource:"#new-credit",
    primaryLabel:"Radicar solicitud",
    primaryIcon:"plus"
  });

  upgradeActionIcon(root,"#new-credit","plus","Radicar nueva solicitud");
  upgradeActionIcon(root,"#submitted-credit","receiving","Solicitudes radicadas");
  upgradeActionIcon(root,"#review-credit","audit","Solicitudes en estudio");
  upgradeActionIcon(root,"#all-credit","credit","Historial de crédito");

  const workspace=root.querySelector(".guided-workspace");
  workspace?.classList.add("commercial-action-workspace");
  insertJourney(workspace,[
    ["1","Radicar","Ventas registra cliente, valor y plazo"],
    ["2","Tomar","Cartera asume la solicitud"],
    ["3","Estudiar","Se revisan las condiciones solicitadas"],
    ["4","Decidir","Aprobar o rechazar con justificación"]
  ],"Flujo de una solicitud de crédito");
  upgradeCreditSearch(root);
}

function upgradeCreditSearch(root){
  const toolbar=root.querySelector("#credit-result")?.closest(".card")?.querySelector(".toolbar");
  if(!toolbar||toolbar.dataset.commercialSearch)return;
  toolbar.dataset.commercialSearch="1";
  const card=toolbar.closest(".card");
  card?.classList.add("commercial-results-card","commercial-credit-results");
  const search=toolbar.querySelector("#credit-search");
  const apply=toolbar.querySelector("#credit-load");
  if(!search||!apply)return;
  const shell=document.createElement("section");
  shell.className="commercial-search-shell credit-search-shell";
  shell.innerHTML=`<header class="commercial-search-head"><div><span>CONSULTAR CRÉDITO</span><h3>Encuentra una solicitud</h3><p>Busca por número de solicitud, cliente o documento.</p></div><div class="commercial-search-hint">Usa las tarjetas superiores para filtrar por etapa</div></header><div class="commercial-search-primary"><div class="commercial-search-input"></div><div class="commercial-search-button"></div></div><div class="commercial-credit-status"><span>Vista rápida:</span><button type="button" data-credit-proxy="#submitted-credit">Radicadas</button><button type="button" data-credit-proxy="#review-credit">En estudio</button><button type="button" data-credit-proxy="#all-credit" class="active">Todas / historial</button></div>`;
  shell.querySelector(".commercial-search-input").append(search);
  search.classList.add("commercial-main-search");
  search.placeholder="Ejemplo: CR-1024, Cliente ABC o NIT";
  shell.querySelector(".commercial-search-button").append(apply);
  apply.innerHTML=`${icon("search")}<span>Buscar solicitud</span>`;
  apply.classList.add("commercial-search-cta");
  toolbar.replaceWith(shell);
  shell.querySelectorAll("[data-credit-proxy]").forEach(button=>button.addEventListener("click",()=>{
    root.querySelector(button.dataset.creditProxy)?.click();
    shell.querySelectorAll("[data-credit-proxy]").forEach(item=>item.classList.toggle("active",item===button));
  }));

  const result=root.querySelector("#credit-result");
  if(result&&!card.querySelector(".commercial-result-heading")){
    const heading=document.createElement("div");
    heading.className="commercial-result-heading credit-result-heading";
    heading.innerHTML=`<div><span>SOLICITUDES</span><strong>Resultados de crédito</strong></div><div class="commercial-result-summary"><b data-commercial-credit-count>—</b><small>solicitudes visibles</small></div>`;
    result.before(heading);
  }
}

function refreshCreditResultMeta(root){
  const count=root.querySelector("[data-commercial-credit-count]");
  if(count)count.textContent=String(root.querySelectorAll("#credit-result .credit-card").length);
  root.querySelectorAll("#credit-result .credit-card").forEach(card=>card.classList.add("commercial-credit-card"));
}

function enhanceCommercialWizards(){
  document.querySelectorAll("#modal-root .wizard-modal").forEach(modal=>{
    if(modal.dataset.commercialWizard)return;
    const title=modal.querySelector(".wizard-head h3")?.textContent?.trim()||"";
    const isOrder=/crear pedido/i.test(title);
    const isCredit=/crédito|credito|solicitud/i.test(title);
    if(!isOrder&&!isCredit)return;
    modal.dataset.commercialWizard="1";
    modal.classList.add("commercial-wizard",isOrder?"commercial-order-wizard":"commercial-credit-wizard");
    const progress=modal.querySelector(".wizard-progress");
    if(progress){
      const assist=document.createElement("div");
      assist.className="commercial-wizard-assist";
      assist.innerHTML=isOrder?`<span>${icon("check")} 3 pasos guiados</span><span>${icon("orders")} Solo información necesaria</span><span>${icon("audit")} Revisión antes de crear</span>`:`<span>${icon("check")} Proceso guiado</span><span>${icon("credit")} Datos financieros claros</span><span>${icon("audit")} Decisión trazable</span>`;
      progress.before(assist);
    }
  });
}

function install(){
  const root=document.querySelector("#page-content");
  if(!root){setTimeout(install,80);return;}
  if(!pageObserver){
    pageObserver=new MutationObserver(schedule);
    pageObserver.observe(root,{childList:true,subtree:true});
    const modal=document.querySelector("#modal-root");
    if(modal)pageObserver.observe(modal,{childList:true,subtree:true});
    window.addEventListener("hashchange",schedule);
  }
  schedule();
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});else install();
