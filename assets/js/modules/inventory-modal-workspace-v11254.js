/* CRM Suministros · Inventario workspace modal V11.25.5
   Balance de amplitud: superficies de trabajo generosas, pero con margen lateral visible
   y una jerarquía de ancho distinta según la complejidad de cada diálogo. */

const STYLE_ID="inventory-modal-workspace-v11255";

function installInventoryWorkspaceModalV11255(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement("style");
  style.id=STYLE_ID;
  style.textContent=`
  /* Desktop: el modal conserva identidad visual y márgenes laterales reales. */
  @media(min-width:1201px){
    #modal-root .modal-overlay.inventory-modal-overlay-v11253{
      padding:14px 28px!important;
      align-items:center!important;
      justify-content:center!important;
    }

    /* Base: Plan, Existencias, detalles y diálogos genéricos. */
    #modal-root .modal.popup-ux-v1190.inventory-modal-v11253,
    #modal-root .modal.inventory-modal-v11253{
      width:min(86vw,1500px)!important;
      max-width:min(86vw,1500px)!important;
      height:calc(100dvh - 28px)!important;
      max-height:calc(100dvh - 28px)!important;
      border-radius:20px!important;
    }

    /* Conteo y Revisión: los más amplios por densidad de información. */
    #modal-root .modal.popup-ux-v1190.inventory-modal-count-v11253,
    #modal-root .modal.inventory-modal-count-v11253,
    #modal-root .modal.popup-ux-v1190.inventory-modal-review-v11253,
    #modal-root .modal.inventory-modal-review-v11253{
      width:min(88vw,1600px)!important;
      max-width:min(88vw,1600px)!important;
    }

    /* Escáner y etiquetas: workspace amplio, pero no ejecutivo de borde a borde. */
    #modal-root .modal.popup-ux-v1190.inventory-modal-scanner-v11253,
    #modal-root .modal.inventory-modal-scanner-v11253,
    #modal-root .modal.popup-ux-v1190.inventory-modal-labels-v11253,
    #modal-root .modal.inventory-modal-labels-v11253{
      width:min(82vw,1400px)!important;
      max-width:min(82vw,1400px)!important;
    }

    /* Identificación: lectura y acciones, sin necesidad de un lienzo gigante. */
    #modal-root .modal.popup-ux-v1190.inventory-modal-identified-v11253,
    #modal-root .modal.inventory-modal-identified-v11253{
      width:min(74vw,1180px)!important;
      max-width:min(74vw,1180px)!important;
      height:auto!important;
      min-height:min(620px,calc(100dvh - 28px))!important;
      max-height:calc(100dvh - 28px)!important;
    }

    /* Siesa: proceso focalizado, más contenido. */
    #modal-root .modal.popup-ux-v1190.inventory-modal-sync-v11253,
    #modal-root .modal.inventory-modal-sync-v11253{
      width:min(68vw,980px)!important;
      max-width:min(68vw,980px)!important;
      height:auto!important;
      min-height:min(580px,calc(100dvh - 28px))!important;
      max-height:calc(100dvh - 28px)!important;
    }

    #modal-root .inventory-modal-v11253 .modal-head{
      padding-left:28px!important;
      padding-right:24px!important;
    }
    #modal-root .inventory-modal-v11253 .modal-head p{max-width:1180px!important}
    #modal-root .inventory-modal-v11253 .popup-process-guide-v1190{
      grid-template-columns:40px minmax(0,1fr) auto!important;
      gap:13px!important;
      padding-left:28px!important;
      padding-right:28px!important;
    }
    #modal-root .inventory-modal-v11253 .modal-body{padding:22px 26px 26px!important}
    #modal-root .inventory-modal-v11253 .modal-foot{padding-left:24px!important;padding-right:24px!important}

    /* Conteo / metraje: columnas amplias pero flexibles para evitar overflow. */
    #modal-root .inventory-modal-count-v11253 .inventory-lot-row-v11109{
      grid-template-columns:minmax(250px,1fr) minmax(0,1.35fr) minmax(210px,.62fr)!important;
      gap:16px!important;
      padding:14px 16px!important;
    }

    /* Revisión: comparación horizontal equilibrada. */
    #modal-root .inventory-modal-review-v11253 .inventory-comparison-row-v11251{
      grid-template-columns:minmax(250px,1.3fr) repeat(4,minmax(0,.72fr)) minmax(170px,.86fr)!important;
      gap:10px!important;
      padding:11px!important;
    }
    #modal-root .inventory-modal-review-v11253 .inventory-review-hero-v11251{
      grid-template-columns:minmax(0,1fr) minmax(210px,auto)!important;
      gap:22px!important;
    }

    /* Existencias / Plan / detalles: aprovechan ancho sin forzar mínimos gigantes. */
    #modal-root .inventory-modal-v11253 .v115-goods-row{
      grid-template-columns:minmax(240px,1.02fr) minmax(0,1.48fr) minmax(170px,.68fr) minmax(130px,auto)!important;
      gap:14px!important;
      padding:14px 16px!important;
    }
    #modal-root .inventory-modal-v11253 .v115-goods-row.no-actions{
      grid-template-columns:minmax(250px,1.02fr) minmax(0,1.52fr) minmax(190px,.72fr)!important;
    }
    #modal-root .inventory-modal-v11253 .v115-goods-row.no-meta.no-actions{
      grid-template-columns:minmax(0,1.55fr) minmax(230px,.55fr)!important;
    }
    #modal-root .inventory-modal-v11253 .v115-goods-meta{gap:10px!important}

    /* Escáner: cámara dominante sin sobredimensionar el diálogo. */
    #modal-root .inventory-modal-scanner-v11253 .v116-scanner-shell{
      grid-template-columns:minmax(0,1.65fr) minmax(350px,.72fr)!important;
      gap:20px!important;
    }
    #modal-root .inventory-modal-scanner-v11253 .v116-camera{min-height:520px!important}

    /* Etiquetas: tarjetas cómodas sin dispersarse demasiado. */
    #modal-root .inventory-modal-labels-v11253 .v116-label-grid{
      grid-template-columns:repeat(auto-fit,minmax(320px,1fr))!important;
      gap:14px!important;
    }

    /* Identificación mantiene dos zonas claras. */
    #modal-root .inventory-modal-identified-v11253 .v116-found-grid{
      grid-template-columns:minmax(0,1.45fr) minmax(320px,.72fr)!important;
      gap:18px!important;
    }
    #modal-root .inventory-modal-sync-v11253 .modal-body{width:100%!important}
  }

  /* Laptop y tablet: margen visible, pero prioridad a la comodidad táctil. */
  @media(min-width:761px) and (max-width:1200px){
    #modal-root .modal-overlay.inventory-modal-overlay-v11253{padding:14px!important}
    #modal-root .modal.popup-ux-v1190.inventory-modal-v11253,
    #modal-root .modal.inventory-modal-v11253{
      width:min(94vw,1120px)!important;
      max-width:min(94vw,1120px)!important;
      height:calc(100dvh - 28px)!important;
      max-height:calc(100dvh - 28px)!important;
      border-radius:17px!important;
    }
    #modal-root .modal.popup-ux-v1190.inventory-modal-identified-v11253,
    #modal-root .modal.inventory-modal-identified-v11253{
      width:min(92vw,1040px)!important;
      max-width:min(92vw,1040px)!important;
    }
    #modal-root .modal.popup-ux-v1190.inventory-modal-sync-v11253,
    #modal-root .modal.inventory-modal-sync-v11253{
      width:min(88vw,900px)!important;
      max-width:min(88vw,900px)!important;
      height:auto!important;
      max-height:calc(100dvh - 28px)!important;
    }
    #modal-root .inventory-modal-v11253 .modal-body{padding:18px 20px 22px!important}
  }

  /* Móvil sí conserva app-sheet de pantalla completa por ergonomía. */
  @media(max-width:760px){
    #modal-root .modal-overlay.inventory-modal-overlay-v11253{padding:0!important}
    #modal-root .modal.popup-ux-v1190.inventory-modal-v11253,
    #modal-root .modal.inventory-modal-v11253{
      width:100vw!important;
      max-width:100vw!important;
      height:100dvh!important;
      max-height:100dvh!important;
      border-radius:0!important;
    }
  }
  `;
  document.head.appendChild(style);
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",installInventoryWorkspaceModalV11255,{once:true});
else installInventoryWorkspaceModalV11255();
