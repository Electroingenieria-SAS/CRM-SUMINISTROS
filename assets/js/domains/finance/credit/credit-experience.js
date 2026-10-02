import { icon } from "../../../core/icons.js";
import { upgradePageHead, upgradeActionIcon, insertJourney } from "../../orders/commercial/workspace-header.js";

export function enhanceCredit(root){
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

export function upgradeCreditSearch(root){
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

export function refreshCreditResultMeta(root){
  const count=root.querySelector("[data-commercial-credit-count]");
  if(count)count.textContent=String(root.querySelectorAll("#credit-result .credit-card").length);
  root.querySelectorAll("#credit-result .credit-card").forEach(card=>card.classList.add("commercial-credit-card"));
}
