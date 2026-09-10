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
  const style=document.createElement("style");
  style.id=STYLE_ID;
  style.textContent=`
  #modal-root .modal-overlay.inventory-dialog-overlay-v11260{
    padding:24px 40px!important;
    background:rgba(6,24,43,.58)!important;
    backdrop-filter:blur(6px) saturate(1.02)!important;
    align-items:center!important;
    justify-content:center!important;
  }

  #modal-root .modal.${DIALOG_CLASS}{
    --inventory-dialog-width:980px;
    width:min(var(--inventory-dialog-width),calc(100vw - 80px))!important;
    max-width:min(var(--inventory-dialog-width),calc(100vw - 80px))!important;
    height:min(900px,calc(100dvh - 48px))!important;
    max-height:calc(100dvh - 48px)!important;
    border:1px solid #d6e0e8!important;
    border-radius:18px!important;
    background:#fff!important;
    box-shadow:0 28px 72px rgba(4,24,44,.28)!important;
    overflow:hidden!important;
  }
  #modal-root .${DIALOG_CLASS}.inventory-dialog-count-v11260{--inventory-dialog-width:1120px}
  #modal-root .${DIALOG_CLASS}.inventory-dialog-review-v11260{--inventory-dialog-width:1180px}
  #modal-root .${DIALOG_CLASS}.inventory-dialog-stock-v11260{--inventory-dialog-width:1080px}
  #modal-root .${DIALOG_CLASS}.inventory-dialog-plan-v11260{--inventory-dialog-width:1040px}
  #modal-root .${DIALOG_CLASS}.inventory-dialog-scanner-v11260{--inventory-dialog-width:1060px;height:min(840px,calc(100dvh - 48px))!important}
  #modal-root .${DIALOG_CLASS}.inventory-dialog-labels-v11260{--inventory-dialog-width:1080px}
  #modal-root .${DIALOG_CLASS}.inventory-dialog-identified-v11260{--inventory-dialog-width:860px;height:auto!important;min-height:min(600px,calc(100dvh - 48px))!important}
  #modal-root .${DIALOG_CLASS}.inventory-dialog-sync-v11260{--inventory-dialog-width:760px;height:auto!important;min-height:min(560px,calc(100dvh - 48px))!important}

  #modal-root .${DIALOG_CLASS} .modal-head{
    min-height:78px!important;
    padding:17px 18px 16px 22px!important;
    border-bottom:1px solid #e1e7ed!important;
    background:#fff!important;
    box-shadow:inset 4px 0 0 #0b65c7!important;
  }
  #modal-root .${DIALOG_CLASS} .modal-title-group{display:grid!important;gap:3px!important;min-width:0!important}
  #modal-root .${DIALOG_CLASS} .modal-kicker{
    display:block!important;
    margin:0!important;
    color:#0b65c7!important;
    font-size:12px!important;
    font-weight:800!important;
    line-height:1.25!important;
    letter-spacing:.075em!important;
  }
  #modal-root .${DIALOG_CLASS} .modal-head h3{
    margin:0!important;
    color:#173b63!important;
    font-size:24px!important;
    line-height:1.25!important;
    letter-spacing:-.018em!important;
    white-space:normal!important;
    overflow-wrap:anywhere!important;
  }
  #modal-root .${DIALOG_CLASS} .modal-head p{
    margin:2px 0 0!important;
    max-width:760px!important;
    color:#657789!important;
    font-size:14px!important;
    line-height:1.5!important;
    white-space:normal!important;
  }
  #modal-root .${DIALOG_CLASS} .modal-head .icon-close{
    flex:0 0 46px!important;
    width:46px!important;
    height:46px!important;
    border-radius:12px!important;
    font-size:25px!important;
  }

  #modal-root .${DIALOG_CLASS} .inventory-dialog-guide-v11260{
    flex:0 0 auto;
    display:grid;
    grid-template-columns:auto minmax(0,1fr);
    gap:14px;
    align-items:center;
    padding:11px 22px;
    border-bottom:1px solid #e6ebef;
    background:#f7fafc;
  }
  #modal-root .${DIALOG_CLASS} .inventory-dialog-guide-v11260>strong{
    color:#284d70;
    font-size:13px;
    line-height:1.35;
    white-space:nowrap;
  }
  #modal-root .${DIALOG_CLASS} .inventory-dialog-guide-v11260 ol{
    display:flex;
    gap:12px 18px;
    align-items:center;
    flex-wrap:wrap;
    margin:0;
    padding:0;
    list-style:none;
    counter-reset:inventory-guide;
  }
  #modal-root .${DIALOG_CLASS} .inventory-dialog-guide-v11260 li{
    counter-increment:inventory-guide;
    display:flex;
    gap:7px;
    align-items:center;
    min-width:0;
    color:#536a7f;
    font-size:13px;
    line-height:1.4;
  }
  #modal-root .${DIALOG_CLASS} .inventory-dialog-guide-v11260 li::before{
    content:counter(inventory-guide);
    flex:0 0 25px;
    width:25px;
    height:25px;
    display:grid;
    place-items:center;
    border-radius:50%;
    background:#e6f1fb;
    color:#0b65c7;
    font-size:12px;
    font-weight:900;
  }

  #modal-root .${DIALOG_CLASS} .modal-body{
    flex:1 1 auto!important;
    min-height:0!important;
    overflow:auto!important;
    overscroll-behavior:contain!important;
    padding:20px 22px 24px!important;
    background:#f8fafc!important;
    color:#314b64!important;
    font-size:15px!important;
    line-height:1.5!important;
    scrollbar-width:thin;
  }
  #modal-root .${DIALOG_CLASS} .modal-body *,
  #modal-root .${DIALOG_CLASS} .modal-foot *{box-sizing:border-box;min-width:0}
  #modal-root .${DIALOG_CLASS} p,
  #modal-root .${DIALOG_CLASS} span,
  #modal-root .${DIALOG_CLASS} small,
  #modal-root .${DIALOG_CLASS} strong,
  #modal-root .${DIALOG_CLASS} b,
  #modal-root .${DIALOG_CLASS} em,
  #modal-root .${DIALOG_CLASS} code,
  #modal-root .${DIALOG_CLASS} label{
    max-width:100%;
    overflow-wrap:anywhere;
    white-space:normal;
  }
  #modal-root .${DIALOG_CLASS} small{font-size:12.5px!important;line-height:1.45!important}
  #modal-root .${DIALOG_CLASS} code{word-break:break-all}
  #modal-root .${DIALOG_CLASS} .control{
    width:100%!important;
    min-height:50px!important;
    padding:11px 13px!important;
    border-radius:10px!important;
    font-size:16px!important;
    line-height:1.35!important;
  }
  #modal-root .${DIALOG_CLASS} textarea.control{min-height:96px!important;resize:vertical}
  #modal-root .${DIALOG_CLASS} .btn{
    min-height:48px!important;
    padding:10px 17px!important;
    border-radius:10px!important;
    font-size:14px!important;
    font-weight:800!important;
    line-height:1.3!important;
    white-space:normal!important;
    text-align:center!important;
  }
  #modal-root .${DIALOG_CLASS} .modal-foot{
    flex:0 0 auto!important;
    min-height:70px!important;
    padding:11px 18px!important;
    gap:10px!important;
    border-top:1px solid #e1e7ed!important;
    background:#fff!important;
    box-shadow:0 -6px 18px rgba(18,48,77,.045)!important;
  }
  #modal-root .${DIALOG_CLASS} .modal-foot.single-action-v11260{justify-content:flex-end!important}
  #modal-root .${DIALOG_CLASS} .modal-foot .btn{min-width:150px!important}

  /* Encabezados y resúmenes: información breve, legible y sin microtexto. */
  #modal-root .${DIALOG_CLASS} .inventory-count-v11109{display:grid!important;gap:14px!important}
  #modal-root .${DIALOG_CLASS} .inventory-count-v11109>header:not(.inventory-review-hero-v11251){
    display:grid!important;
    gap:5px!important;
    padding:16px 18px!important;
    border:1px solid #dfe6ec!important;
    border-left:4px solid #0b65c7!important;
    border-radius:13px!important;
    background:#fff!important;
    box-shadow:none!important;
  }
  #modal-root .${DIALOG_CLASS} .inventory-count-v11109>header:not(.inventory-review-hero-v11251)>span{
    color:#0b65c7!important;
    font-size:12px!important;
    font-weight:900!important;
    letter-spacing:.07em!important;
  }
  #modal-root .${DIALOG_CLASS} .inventory-count-v11109>header:not(.inventory-review-hero-v11251)>strong{
    color:#173b63!important;
    font-size:20px!important;
    line-height:1.3!important;
  }
  #modal-root .${DIALOG_CLASS} .inventory-count-v11109>header:not(.inventory-review-hero-v11251)>p{
    margin:0!important;
    color:#5f7488!important;
    font-size:14px!important;
    line-height:1.5!important;
  }
  #modal-root .${DIALOG_CLASS} .inventory-summary-v11109{
    display:grid!important;
    grid-template-columns:repeat(auto-fit,minmax(150px,1fr))!important;
    gap:10px!important;
  }
  #modal-root .${DIALOG_CLASS} .inventory-summary-item-v11109{min-width:0!important}
  #modal-root .${DIALOG_CLASS} .inventory-source-bar-v11109{
    display:grid!important;
    grid-template-columns:1fr!important;
    gap:8px!important;
    padding:13px 15px!important;
    border:1px solid #d8e5f1!important;
    border-radius:12px!important;
    background:#f2f7fc!important;
  }
  #modal-root .${DIALOG_CLASS} .inventory-source-main-v11109{display:flex!important;align-items:center!important;gap:10px!important}
  #modal-root .${DIALOG_CLASS} .inventory-source-main-v11109>span{
    flex:0 0 34px!important;width:34px!important;height:34px!important;display:grid!important;place-items:center!important;
    border-radius:9px!important;background:#0b65c7!important;color:#fff!important;font-size:17px!important;font-weight:900!important;
  }
  #modal-root .${DIALOG_CLASS} .inventory-source-main-v11109 strong{font-size:14px!important;color:#244c71!important}
  #modal-root .${DIALOG_CLASS} .inventory-source-main-v11109 small{font-size:13px!important;color:#60768b!important}

  /* Conteo/metraje: solo tres zonas, cantidad grande y evidente. */
  #modal-root .inventory-dialog-count-v11260 .inventory-lot-list-shell-v11109{display:grid!important;gap:10px!important}
  #modal-root .inventory-dialog-count-v11260 .inventory-lot-row-v11109{
    display:grid!important;
    grid-template-columns:minmax(0,1.05fr) minmax(0,1fr) minmax(210px,.58fr)!important;
    gap:14px!important;
    align-items:center!important;
    padding:14px 15px!important;
    border:1px solid #dfe6ec!important;
    border-radius:13px!important;
    background:#fff!important;
    box-shadow:none!important;
  }
  #modal-root .inventory-dialog-count-v11260 .inventory-lot-id-v11109,
  #modal-root .inventory-dialog-count-v11260 .inventory-lot-location-v11109,
  #modal-root .inventory-dialog-count-v11260 .inventory-lot-qty-v11109{display:grid!important;gap:4px!important}
  #modal-root .inventory-dialog-count-v11260 .inventory-lot-id-v11109 small,
  #modal-root .inventory-dialog-count-v11260 .inventory-lot-location-v11109 small,
  #modal-root .inventory-dialog-count-v11260 .inventory-lot-qty-v11109 small{
    color:#6c7d8d!important;font-size:12px!important;font-weight:850!important;letter-spacing:.025em!important;text-transform:none!important;
  }
  #modal-root .inventory-dialog-count-v11260 .inventory-lot-id-v11109 strong,
  #modal-root .inventory-dialog-count-v11260 .inventory-lot-location-v11109 strong{font-size:15px!important;color:#284a69!important;line-height:1.4!important}
  #modal-root .inventory-dialog-count-v11260 .inventory-lot-id-v11109 span,
  #modal-root .inventory-dialog-count-v11260 .inventory-lot-location-v11109 span{font-size:13px!important;color:#697c8e!important;line-height:1.45!important}
  #modal-root .inventory-dialog-count-v11260 .inventory-lot-qty-v11109{grid-template-columns:minmax(0,1fr) auto!important;align-items:end!important}
  #modal-root .inventory-dialog-count-v11260 .inventory-lot-qty-v11109 small{grid-column:1/-1!important}
  #modal-root .inventory-dialog-count-v11260 .inventory-lot-qty-v11109 input{
    min-height:54px!important;font-size:19px!important;font-weight:850!important;text-align:right!important;background:#fff!important;
  }
  #modal-root .inventory-dialog-count-v11260 .inventory-lot-qty-v11109>span{padding-bottom:14px!important;color:#4d657a!important;font-size:14px!important;font-weight:850!important}
  #modal-root .inventory-dialog-count-v11260 .field{margin:0!important;padding:14px!important;border:1px solid #e0e6ec!important;border-radius:12px!important;background:#fff!important}
  #modal-root .inventory-dialog-count-v11260 .field label{font-size:14px!important;font-weight:800!important;color:#365570!important}
  #modal-root .inventory-dialog-count-v11260 .v116-origin-note{display:grid!important;gap:3px!important;padding:13px 15px!important;border-left:4px solid #16805d!important;border-radius:10px!important;background:#eff8f4!important}
  #modal-root .inventory-dialog-count-v11260 .v116-origin-note strong{font-size:14px!important}
  #modal-root .inventory-dialog-count-v11260 .v116-origin-note span{font-size:13px!important}

  /* Revisión: cada lote es una tarjeta. Ya no hay seis columnas horizontales. */
  #modal-root .inventory-dialog-review-v11260 .inventory-review-hero-v11251{
    display:grid!important;
    grid-template-columns:minmax(0,1fr) minmax(190px,auto)!important;
    gap:16px!important;
    align-items:center!important;
    padding:16px 18px!important;
    border:1px solid #dfe6ec!important;
    border-radius:13px!important;
    background:#fff!important;
  }
  #modal-root .inventory-dialog-review-v11260 .inventory-review-hero-v11251 strong{font-size:18px!important;line-height:1.4!important}
  #modal-root .inventory-dialog-review-v11260 .inventory-review-hero-v11251 p{font-size:14px!important;line-height:1.5!important}
  #modal-root .inventory-dialog-review-v11260 .inventory-review-hero-v11251 aside{text-align:right!important;display:grid!important;gap:3px!important}
  #modal-root .inventory-dialog-review-v11260 .inventory-review-hero-v11251 aside b{font-size:16px!important;color:#244c71!important}
  #modal-root .inventory-dialog-review-v11260 .inventory-comparison-list-v11251{display:grid!important;gap:11px!important}
  #modal-root .inventory-dialog-review-v11260 .inventory-comparison-row-v11251{
    display:grid!important;
    grid-template-columns:repeat(3,minmax(0,1fr))!important;
    gap:0!important;
    padding:0!important;
    border:1px solid #dfe6ec!important;
    border-radius:13px!important;
    background:#fff!important;
    overflow:hidden!important;
    box-shadow:none!important;
  }
  #modal-root .inventory-dialog-review-v11260 .inventory-comparison-id-v11251{
    grid-column:1/-1!important;
    display:grid!important;
    gap:3px!important;
    padding:13px 15px!important;
    border-bottom:1px solid #e5eaef!important;
    background:#f8fafc!important;
  }
  #modal-root .inventory-dialog-review-v11260 .inventory-comparison-id-v11251 small{font-size:12px!important;color:#718191!important}
  #modal-root .inventory-dialog-review-v11260 .inventory-comparison-id-v11251 strong{font-size:15px!important;color:#294c6c!important}
  #modal-root .inventory-dialog-review-v11260 .inventory-comparison-id-v11251 span{font-size:13px!important;color:#667b8f!important}
  #modal-root .inventory-dialog-review-v11260 .inventory-comparison-cell-v11251,
  #modal-root .inventory-dialog-review-v11260 .inventory-comparison-delta-v11251{
    display:grid!important;
    gap:4px!important;
    align-content:center!important;
    min-height:78px!important;
    padding:11px 13px!important;
    border:0!important;
    border-right:1px solid #edf0f3!important;
    border-top:1px solid #f0f2f4!important;
    background:#fff!important;
  }
  #modal-root .inventory-dialog-review-v11260 .inventory-comparison-cell-v11251 small,
  #modal-root .inventory-dialog-review-v11260 .inventory-comparison-delta-v11251 small{font-size:12px!important;color:#718191!important}
  #modal-root .inventory-dialog-review-v11260 .inventory-comparison-cell-v11251 b,
  #modal-root .inventory-dialog-review-v11260 .inventory-comparison-delta-v11251 strong{font-size:16px!important;color:#264a6b!important;line-height:1.35!important}
  #modal-root .inventory-dialog-review-v11260 .inventory-comparison-delta-v11251.is-diff{background:#fff8ec!important}
  #modal-root .inventory-dialog-review-v11260 .inventory-decision-v11251{
    display:grid!important;gap:12px!important;padding:15px 16px!important;border:1px solid #dbe4eb!important;border-radius:13px!important;background:#fff!important;
  }
  #modal-root .inventory-dialog-review-v11260 .inventory-decision-v11251 label{font-size:14px!important;font-weight:800!important;color:#365570!important}
  #modal-root .inventory-dialog-review-v11260 .inventory-decision-actions-v11251{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:10px!important}
  #modal-root .inventory-dialog-review-v11260 .inventory-decision-actions-v11251 .btn{width:100%!important;min-width:0!important}
  #modal-root .inventory-dialog-review-v11260 .inventory-recorded-decision-v11251{padding:13px 15px!important;border-radius:11px!important}

  /* Detalles de existencias y plan: identidad arriba, datos debajo. */
  #modal-root .${DIALOG_CLASS} .v115-detail-grid{
    display:grid!important;
    grid-template-columns:repeat(auto-fit,minmax(160px,1fr))!important;
    gap:9px!important;
  }
  #modal-root .${DIALOG_CLASS} .v115-detail-grid article{padding:13px!important;border-radius:11px!important}
  #modal-root .${DIALOG_CLASS} .v115-detail-grid article small{font-size:12px!important}
  #modal-root .${DIALOG_CLASS} .v115-detail-grid article strong{font-size:16px!important;line-height:1.35!important}
  #modal-root .${DIALOG_CLASS} .v115-goods-list{display:grid!important;gap:10px!important}
  #modal-root .${DIALOG_CLASS} .v115-goods-row{
    display:grid!important;
    grid-template-columns:minmax(0,1fr) minmax(170px,auto)!important;
    grid-template-rows:auto auto!important;
    gap:10px 14px!important;
    align-items:start!important;
    padding:14px 15px!important;
    border:1px solid #dfe6ec!important;
    border-radius:13px!important;
    background:#fff!important;
    box-shadow:none!important;
  }
  #modal-root .${DIALOG_CLASS} .v115-goods-id{grid-column:1!important;grid-row:1!important;display:grid!important;gap:3px!important}
  #modal-root .${DIALOG_CLASS} .v115-goods-id strong{font-size:15px!important;line-height:1.4!important;color:#274b6c!important}
  #modal-root .${DIALOG_CLASS} .v115-goods-id small{font-size:12px!important;color:#6d7f8f!important}
  #modal-root .${DIALOG_CLASS} .v115-goods-meta{
    grid-column:1/-1!important;
    grid-row:2!important;
    display:grid!important;
    grid-template-columns:repeat(4,minmax(0,1fr))!important;
    gap:8px!important;
  }
  #modal-root .${DIALOG_CLASS} .v115-goods-meta>span{display:grid!important;gap:3px!important;padding:9px 10px!important;border-radius:9px!important;background:#f7f9fb!important}
  #modal-root .${DIALOG_CLASS} .v115-goods-meta small{font-size:12px!important;color:#758594!important}
  #modal-root .${DIALOG_CLASS} .v115-goods-meta b{font-size:14px!important;line-height:1.35!important;color:#294b69!important}
  #modal-root .${DIALOG_CLASS} .v115-goods-link{grid-column:2!important;grid-row:1!important;display:grid!important;gap:3px!important;align-content:center!important;text-align:right!important}
  #modal-root .${DIALOG_CLASS} .v115-goods-link strong{font-size:14px!important;line-height:1.35!important}
  #modal-root .${DIALOG_CLASS} .v115-goods-link em{font-size:12px!important;line-height:1.4!important}
  #modal-root .${DIALOG_CLASS} .v115-goods-row>.page-actions{grid-column:2!important;grid-row:1!important;display:flex!important;justify-content:flex-end!important;align-items:center!important;flex-wrap:wrap!important;gap:7px!important}
  #modal-root .${DIALOG_CLASS} .v115-goods-row.no-status.no-actions{grid-template-columns:1fr!important}
  #modal-root .${DIALOG_CLASS} .v115-goods-row.no-status.no-actions .v115-goods-id{grid-column:1!important}

  /* Escáner: cámara clara y controles sencillos. */
  #modal-root .inventory-dialog-scanner-v11260 .v116-scan-intro{
    display:grid!important;gap:4px!important;margin-bottom:14px!important;padding:14px 16px!important;border:1px solid #d9e4ed!important;border-left:4px solid #0b65c7!important;border-radius:12px!important;background:#f6f9fc!important;
  }
  #modal-root .inventory-dialog-scanner-v11260 .v116-scan-intro span{font-size:12px!important;font-weight:900!important;color:#0b65c7!important}
  #modal-root .inventory-dialog-scanner-v11260 .v116-scan-intro strong{font-size:18px!important;color:#244c71!important}
  #modal-root .inventory-dialog-scanner-v11260 .v116-scan-intro p{margin:0!important;font-size:14px!important;color:#60758a!important}
  #modal-root .inventory-dialog-scanner-v11260 .v116-scanner-shell{display:grid!important;grid-template-columns:minmax(0,1.35fr) minmax(300px,.65fr)!important;gap:16px!important;align-items:stretch!important}
  #modal-root .inventory-dialog-scanner-v11260 .v116-camera{position:relative!important;min-height:420px!important;border-radius:14px!important;overflow:hidden!important}
  #modal-root .inventory-dialog-scanner-v11260 .v116-scan-side{display:grid!important;gap:12px!important;align-content:start!important}
  #modal-root .inventory-dialog-scanner-v11260 .v116-scan-side .field{padding:14px!important;border:1px solid #dfe6ec!important;border-radius:12px!important;background:#fff!important}
  #modal-root .inventory-dialog-scanner-v11260 .v116-scan-side label{font-size:14px!important;font-weight:800!important;color:#365570!important}
  #modal-root .inventory-dialog-scanner-v11260 .v116-scan-help{padding:13px 14px!important;border-radius:11px!important;font-size:13px!important;line-height:1.5!important}

  /* Etiquetas: máximo dos por fila para no reducir la lectura. */
  #modal-root .inventory-dialog-labels-v11260 .v116-label-head{display:flex!important;gap:14px!important;align-items:center!important;justify-content:space-between!important;flex-wrap:wrap!important;margin-bottom:14px!important}
  #modal-root .inventory-dialog-labels-v11260 .v116-label-head strong{font-size:18px!important;color:#274b6b!important}
  #modal-root .inventory-dialog-labels-v11260 .v116-label-head p{font-size:14px!important;line-height:1.5!important}
  #modal-root .inventory-dialog-labels-v11260 .v116-label-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:12px!important}
  #modal-root .inventory-dialog-labels-v11260 .v116-label-card{padding:15px!important;border-radius:13px!important;box-shadow:none!important}
  #modal-root .inventory-dialog-labels-v11260 .v116-label-card strong{font-size:16px!important;line-height:1.35!important}
  #modal-root .inventory-dialog-labels-v11260 .v116-label-card span{font-size:13px!important;line-height:1.45!important}
  #modal-root .inventory-dialog-labels-v11260 .v116-label-card code{font-size:12px!important;line-height:1.35!important}

  /* Resultado escaneado: pocos datos por fila y acciones grandes. */
  #modal-root .inventory-dialog-identified-v11260 .v116-found-hero{padding:15px 16px!important;border-radius:13px!important}
  #modal-root .inventory-dialog-identified-v11260 .v116-found-hero span{font-size:12px!important}
  #modal-root .inventory-dialog-identified-v11260 .v116-found-hero strong{font-size:20px!important;line-height:1.3!important}
  #modal-root .inventory-dialog-identified-v11260 .v116-found-hero h3{font-size:17px!important;line-height:1.4!important}
  #modal-root .inventory-dialog-identified-v11260 .v116-found-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:9px!important}
  #modal-root .inventory-dialog-identified-v11260 .v116-found-grid article{padding:13px!important;border-radius:11px!important}
  #modal-root .inventory-dialog-identified-v11260 .v116-found-grid small{font-size:12px!important}
  #modal-root .inventory-dialog-identified-v11260 .v116-found-grid strong{font-size:16px!important;line-height:1.35!important}
  #modal-root .inventory-dialog-identified-v11260 .v116-result-actions{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(190px,1fr))!important;gap:10px!important}

  /* Sincronización: una tarea lineal, sin espacio sobrante. */
  #modal-root .inventory-dialog-sync-v11260 .inventory-count-v11109{gap:13px!important}
  #modal-root .inventory-dialog-sync-v11260 .field{padding:14px!important;border:1px solid #dfe6ec!important;border-radius:12px!important;background:#fff!important}
  #modal-root .inventory-dialog-sync-v11260 .field label{font-size:14px!important;font-weight:800!important;color:#365570!important}
  #modal-root .inventory-dialog-sync-v11260 input[type=file]{min-height:54px!important;background:#fff!important}
  #modal-root .inventory-dialog-sync-v11260 [data-run]{width:100%!important}

  @media(max-width:1100px){
    #modal-root .modal-overlay.inventory-dialog-overlay-v11260{padding:20px!important}
    #modal-root .modal.${DIALOG_CLASS}{width:min(var(--inventory-dialog-width),calc(100vw - 40px))!important;max-width:min(var(--inventory-dialog-width),calc(100vw - 40px))!important;height:calc(100dvh - 40px)!important;max-height:calc(100dvh - 40px)!important}
    #modal-root .inventory-dialog-count-v11260 .inventory-lot-row-v11109{grid-template-columns:minmax(0,1fr) minmax(220px,.62fr)!important}
    #modal-root .inventory-dialog-count-v11260 .inventory-lot-location-v11109{grid-column:1!important;grid-row:2!important}
    #modal-root .inventory-dialog-count-v11260 .inventory-lot-qty-v11109{grid-column:2!important;grid-row:1/3!important}
    #modal-root .${DIALOG_CLASS} .v115-goods-meta{grid-template-columns:repeat(2,minmax(0,1fr))!important}
  }

  @media(max-width:820px){
    #modal-root .${DIALOG_CLASS} .inventory-dialog-guide-v11260{grid-template-columns:1fr!important;gap:8px!important}
    #modal-root .${DIALOG_CLASS} .inventory-dialog-guide-v11260>strong{white-space:normal!important}
    #modal-root .inventory-dialog-review-v11260 .inventory-comparison-row-v11251{grid-template-columns:repeat(2,minmax(0,1fr))!important}
    #modal-root .inventory-dialog-review-v11260 .inventory-review-hero-v11251{grid-template-columns:1fr!important}
    #modal-root .inventory-dialog-review-v11260 .inventory-review-hero-v11251 aside{text-align:left!important}
    #modal-root .inventory-dialog-review-v11260 .inventory-decision-actions-v11251{grid-template-columns:1fr!important}
    #modal-root .inventory-dialog-scanner-v11260 .v116-scanner-shell{grid-template-columns:1fr!important}
    #modal-root .inventory-dialog-scanner-v11260 .v116-camera{min-height:330px!important}
    #modal-root .inventory-dialog-labels-v11260 .v116-label-grid{grid-template-columns:1fr!important}
  }

  @media(max-width:620px){
    #modal-root .modal-overlay.inventory-dialog-overlay-v11260{padding:0!important}
    #modal-root .modal.${DIALOG_CLASS}{width:100vw!important;max-width:100vw!important;height:100dvh!important;max-height:100dvh!important;border:0!important;border-radius:0!important}
    #modal-root .${DIALOG_CLASS}.inventory-dialog-identified-v11260,
    #modal-root .${DIALOG_CLASS}.inventory-dialog-sync-v11260{height:100dvh!important;min-height:100dvh!important}
    #modal-root .${DIALOG_CLASS} .modal-head{min-height:68px!important;padding:12px 12px 12px 16px!important}
    #modal-root .${DIALOG_CLASS} .modal-head h3{font-size:20px!important}
    #modal-root .${DIALOG_CLASS} .inventory-dialog-guide-v11260{padding:10px 13px!important}
    #modal-root .${DIALOG_CLASS} .inventory-dialog-guide-v11260 ol{display:grid!important;grid-template-columns:1fr!important;gap:6px!important}
    #modal-root .${DIALOG_CLASS} .modal-body{padding:13px!important}
    #modal-root .${DIALOG_CLASS} .modal-foot{padding:9px 10px!important}
    #modal-root .${DIALOG_CLASS} .modal-foot .btn{flex:1 1 140px!important;min-width:0!important}
    #modal-root .inventory-dialog-count-v11260 .inventory-lot-row-v11109{grid-template-columns:1fr!important}
    #modal-root .inventory-dialog-count-v11260 .inventory-lot-location-v11109,
    #modal-root .inventory-dialog-count-v11260 .inventory-lot-qty-v11109{grid-column:1!important;grid-row:auto!important}
    #modal-root .inventory-dialog-review-v11260 .inventory-comparison-row-v11251{grid-template-columns:1fr!important}
    #modal-root .${DIALOG_CLASS} .v115-goods-row{grid-template-columns:1fr!important;grid-template-rows:auto!important}
    #modal-root .${DIALOG_CLASS} .v115-goods-id,
    #modal-root .${DIALOG_CLASS} .v115-goods-link,
    #modal-root .${DIALOG_CLASS} .v115-goods-meta,
    #modal-root .${DIALOG_CLASS} .v115-goods-row>.page-actions{grid-column:1!important;grid-row:auto!important;text-align:left!important;justify-content:flex-start!important}
    #modal-root .${DIALOG_CLASS} .v115-goods-meta{grid-template-columns:1fr!important}
    #modal-root .inventory-dialog-identified-v11260 .v116-found-grid{grid-template-columns:1fr!important}
  }
  `;
  document.head.appendChild(style);
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
  if(titleGroup&&!titleGroup.querySelector(".modal-kicker")){
    const kicker=document.createElement("span");
    kicker.className="modal-kicker";
    kicker.textContent=(GUIDANCE[variant]||GUIDANCE.generic).kicker;
    titleGroup.prepend(kicker);
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
