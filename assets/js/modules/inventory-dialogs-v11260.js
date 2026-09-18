import {state} from "../core/state.js";

const STYLE_ID="inventory-dialogs-v11260";
const DIALOG_CLASS="inventory-dialog-v11260";
const VARIANTS=["count","review","stock","plan","scanner","labels","identified","sync","generic"];

const GUIDANCE={
  count:{kicker:"REGISTRO DE INVENTARIO",steps:["Confirma la referencia y la ubicación.","Escribe la cantidad física de cada lote.","Envía el conteo a revisión."]},
  review:{kicker:"REVISIÓN DE CONTEO",steps:["Confirma referencia, lote y ubicación.","Compara Sistema con Contado.","Escribe el motivo y toma una decisión."]},
  stock:{kicker:"DETALLE DE INVENTARIO",steps:["Revisa los saldos principales.","Consulta lotes y ubicaciones.","Usa la trazabilidad solo si la necesitas."]},
  plan:{kicker:"PLAN DE CONTEO",steps:["Confirma la referencia.","Ubica la bodega y el lote.","El conteo se registra desde la jornada."]},
  scanner:{kicker:"LECTOR DE INVENTARIO",steps:["Apunta el código dentro del recuadro.","Si la cámara falla, escribe el código.","Confirma el material identificado."]},
  labels:{kicker:"ETIQUETAS DE INVENTARIO",steps:["Revisa lote y ubicación.","Imprime una etiqueta o todas."]},
  identified:{kicker:"MATERIAL IDENTIFICADO",steps:["Confirma que la referencia sea correcta.","Revisa lote y ubicación antes de continuar."]},
  sync:{kicker:"ACTUALIZACIÓN SIESA",steps:["Selecciona el archivo oficial.","Pulsa Validar y sincronizar.","Espera el mensaje de finalización."]},
  generic:{kicker:"INVENTARIO",steps:["Revisa la información mostrada.","Usa la acción principal para continuar."]}
};

function installStyles(){
  if(document.getElementById(STYLE_ID))return;
  const link=document.createElement("link");
  link.id=STYLE_ID;link.rel="stylesheet";link.href="./assets/runtime-css/inventory-dialogs-v11260.css?v=11.30.2";
  document.head.appendChild(link);
}

function titleOf(dialog){return (dialog.querySelector(".modal-head h3,.modal-head h2")?.textContent||"").trim().toLowerCase()}

function inventorySignal(dialog,title){
  const always=/^(escanear inventario|inventario identificado|qr y etiquetas de inventario|actualizar maestro siesa)$/i.test(title);
  if(always)return true;
  if(state.currentModule!=="inventory")return false;
  if(/^(inventario ·|plan ·|etiquetas ·|metraje ·|conteo ·|detalle ·)/i.test(title))return true;
  return Boolean(dialog.querySelector(".inventory-count-v11109,.inventory-review-hero-v11251,.inventory-comparison-list-v11251,.v116-scanner-shell,.v116-found-hero,.v116-label-grid,.inventory-lot-list-shell-v11109"));
}

function variantOf(dialog,title){
  if(dialog.querySelector(".inventory-comparison-list-v11251,.inventory-review-hero-v11251"))return "review";
  if(dialog.querySelector(".inventory-lot-list-shell-v11109")||/^(metraje|conteo) ·/i.test(title))return "count";
  if(dialog.querySelector(".v116-scanner-shell")||/^escanear inventario$/i.test(title))return "scanner";
  if(dialog.querySelector(".v116-found-hero")||/^inventario identificado$/i.test(title))return "identified";
  if(dialog.querySelector(".v116-label-grid")||/^(qr y etiquetas de inventario|etiquetas ·)/i.test(title))return "labels";
  if(/^actualizar maestro siesa$/i.test(title))return "sync";
  if(/^plan ·/i.test(title))return "plan";
  if(/^inventario ·/i.test(title))return "stock";
  return "generic";
}

function guidance(variant){
  const data=GUIDANCE[variant]||GUIDANCE.generic;
  return `<section class="inventory-dialog-guide-v11260" aria-label="Ayuda rápida"><strong>Qué debes hacer</strong><ol>${data.steps.map(step=>`<li>${step}</li>`).join("")}</ol></section>`;
}

function simplifyFooter(dialog){
  const footer=dialog.querySelector(":scope > .modal-foot");
  if(!footer)return;
  const confirm=footer.querySelector("[data-confirm]");
  if((confirm?.textContent||"").trim().toLowerCase()!=="cerrar")return;
  footer.querySelector("[data-close]")?.remove();
  footer.classList.add("single-action-v11260");
}

function enhanceDialog(dialog){
  if(!(dialog instanceof HTMLElement))return;
  const title=titleOf(dialog);
  if(!inventorySignal(dialog,title))return;
  installStyles();
  const variant=variantOf(dialog,title);
  dialog.classList.add(DIALOG_CLASS,`inventory-dialog-${variant}-v11260`);
  dialog.dataset.inventoryDialog="v11.26";
  const overlay=dialog.closest(".modal-overlay");
  overlay?.classList.add("inventory-dialog-overlay-v11260");
  VARIANTS.filter(name=>name!==variant).forEach(name=>dialog.classList.remove(`inventory-dialog-${name}-v11260`));
  const titleGroup=dialog.querySelector(".modal-title-group")||dialog.querySelector(".modal-head>div");
  if(titleGroup){
    let kicker=titleGroup.querySelector(".modal-kicker");
    if(!kicker){kicker=document.createElement("span");kicker.className="modal-kicker";titleGroup.prepend(kicker)}
    kicker.textContent=(GUIDANCE[variant]||GUIDANCE.generic).kicker;
  }
  if(!dialog.querySelector(":scope > .inventory-dialog-guide-v11260")){
    const body=dialog.querySelector(":scope > .modal-body");
    if(body)body.insertAdjacentHTML("beforebegin",guidance(variant));
  }
  simplifyFooter(dialog);
}

let scheduled=false;
function enhanceAll(){
  scheduled=false;
  document.querySelectorAll("#modal-root .modal").forEach(enhanceDialog);
}
function schedule(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(enhanceAll);
}
function install(){
  installStyles();
  enhanceAll();
  const root=document.querySelector("#modal-root");
  if(!root)return;
  new MutationObserver(schedule).observe(root,{childList:true,subtree:true});
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});
else install();
