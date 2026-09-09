/* CRM Suministros · Inventario workspace modal V11.25.4
   Hotfix de amplitud: los diálogos de Inventario se comportan como superficies de trabajo
   casi a pantalla completa, con mayor especificidad que popup-ux-v1190. */

const STYLE_ID="inventory-modal-workspace-v11254";

function installInventoryWorkspaceModalV11254(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement("style");
  style.id=STYLE_ID;
  style.textContent=`
  /* Desktop: workspace real, casi de borde a borde. */
  @media(min-width:1181px){
    #modal-root .modal-overlay.inventory-modal-overlay-v11253{
      padding:12px!important;
      align-items:center!important;
    }
    #modal-root .modal.popup-ux-v1190.inventory-modal-v11253,
    #modal-root .modal.inventory-modal-v11253{
      width:calc(100vw - 24px)!important;
      max-width:calc(100vw - 24px)!important;
      height:calc(100dvh - 24px)!important;
      max-height:calc(100dvh - 24px)!important;
      border-radius:18px!important;
    }
    #modal-root .modal.popup-ux-v1190.inventory-modal-v11253.inventory-modal-sync-v11253,
    #modal-root .modal.inventory-modal-v11253.inventory-modal-sync-v11253,
    #modal-root .modal.popup-ux-v1190.inventory-modal-v11253.inventory-modal-identified-v11253,
    #modal-root .modal.inventory-modal-v11253.inventory-modal-identified-v11253{
      width:calc(100vw - 24px)!important;
      max-width:calc(100vw - 24px)!important;
      height:auto!important;
      min-height:min(620px,calc(100dvh - 24px))!important;
      max-height:calc(100dvh - 24px)!important;
    }
    #modal-root .inventory-modal-v11253 .modal-head{
      padding-left:30px!important;
      padding-right:26px!important;
    }
    #modal-root .inventory-modal-v11253 .modal-head p{
      max-width:1500px!important;
    }
    #modal-root .inventory-modal-v11253 .popup-process-guide-v1190{
      grid-template-columns:42px minmax(0,1fr) auto!important;
      gap:14px!important;
      padding-left:30px!important;
      padding-right:30px!important;
    }
    #modal-root .inventory-modal-v11253 .modal-body{
      padding:24px 30px 28px!important;
    }
    #modal-root .inventory-modal-v11253 .modal-foot{
      padding-left:26px!important;
      padding-right:26px!important;
    }

    /* Conteo / metraje: tres zonas anchas reales. */
    #modal-root .inventory-modal-count-v11253 .inventory-lot-row-v11109{
      grid-template-columns:minmax(310px,1fr) minmax(420px,1.45fr) minmax(250px,.62fr)!important;
      gap:18px!important;
      padding:15px 18px!important;
    }

    /* Revisión: comparación horizontal con espacio suficiente por dato. */
    #modal-root .inventory-modal-review-v11253 .inventory-comparison-row-v11251{
      grid-template-columns:minmax(320px,1.4fr) repeat(4,minmax(150px,.72fr)) minmax(210px,.9fr)!important;
      gap:12px!important;
      padding:12px!important;
    }
    #modal-root .inventory-modal-review-v11253 .inventory-review-hero-v11251{
      grid-template-columns:minmax(0,1fr) minmax(240px,auto)!important;
      gap:28px!important;
    }

    /* Existencias / plan / detalles: filas empresariales aprovechan todo el viewport. */
    #modal-root .inventory-modal-v11253 .v115-goods-row{
      grid-template-columns:minmax(300px,1.05fr) minmax(520px,1.6fr) minmax(230px,.72fr) minmax(160px,auto)!important;
      gap:18px!important;
      padding:15px 18px!important;
    }
    #modal-root .inventory-modal-v11253 .v115-goods-row.no-actions{
      grid-template-columns:minmax(320px,1.05fr) minmax(560px,1.65fr) minmax(260px,.76fr)!important;
    }
    #modal-root .inventory-modal-v11253 .v115-goods-row.no-meta.no-actions{
      grid-template-columns:minmax(0,1.6fr) minmax(300px,.55fr)!important;
    }
    #modal-root .inventory-modal-v11253 .v115-goods-meta{
      gap:12px!important;
    }

    /* Escáner: cámara dominante + panel lateral generoso. */
    #modal-root .inventory-modal-scanner-v11253 .v116-scanner-shell{
      grid-template-columns:minmax(0,1.9fr) minmax(430px,.72fr)!important;
      gap:24px!important;
    }
    #modal-root .inventory-modal-scanner-v11253 .v116-camera{
      min-height:560px!important;
    }

    /* Etiquetas: tarjetas más grandes y menos comprimidas. */
    #modal-root .inventory-modal-labels-v11253 .v116-label-grid{
      grid-template-columns:repeat(auto-fit,minmax(360px,1fr))!important;
      gap:16px!important;
    }

    /* Identificación y sincronización también usan ancho de workspace. */
    #modal-root .inventory-modal-identified-v11253 .v116-found-grid{
      grid-template-columns:minmax(0,1.7fr) minmax(420px,.72fr)!important;
      gap:22px!important;
    }
    #modal-root .inventory-modal-sync-v11253 .modal-body{
      width:100%!important;
    }
  }

  /* Laptop y tablet: también casi ancho completo, sin volver a 680/940px. */
  @media(min-width:761px) and (max-width:1180px){
    #modal-root .modal-overlay.inventory-modal-overlay-v11253{padding:8px!important}
    #modal-root .modal.popup-ux-v1190.inventory-modal-v11253,
    #modal-root .modal.inventory-modal-v11253{
      width:calc(100vw - 16px)!important;
      max-width:calc(100vw - 16px)!important;
      height:calc(100dvh - 16px)!important;
      max-height:calc(100dvh - 16px)!important;
    }
    #modal-root .inventory-modal-v11253 .modal-body{padding:18px 20px 22px!important}
  }

  /* Móvil conserva el patrón app-sheet de pantalla completa. */
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

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",installInventoryWorkspaceModalV11254,{once:true});
else installInventoryWorkspaceModalV11254();
