

export function validatePopupLayout({ check, analyticsCss, operationsCss }){
  check(!analyticsCss.includes(".btn-danger,.btn.danger{"),"analytics.css no debe sobrescribir globalmente los botones danger.");
  check(analyticsCss.includes(".admin-shell-v11160 .btn-danger,.admin-shell-v11160 .btn.danger{"),"Los estilos danger de Administración deben permanecer encapsulados.");
  check(operationsCss.includes(".modal.popup-ux-v1190:not(.full):not(.split):not(.wizard-modal){width:min(680px,100%)}"),"El ancho base de popups comunes debe conservarse en 680px.");
  check(operationsCss.includes("#modal-root .modal.popup-ux-v1190.simple-process-modal.wide")&&operationsCss.includes("width:min(1120px,calc(100vw - 80px))!important"),"Gestión rápida debe usar el ancho desktop V11.31.2 sin afectar otros popups.");
  check(operationsCss.includes(".simple-process-head .wizard-kicker")&&operationsCss.includes("color:#0b65c7!important"),"Gestión rápida debe mostrar el kicker en azul.");
  check(operationsCss.includes(".simple-process-head h3")&&operationsCss.includes("color:#0a4f91!important"),"Gestión rápida debe mostrar el número de pedido en azul.");
  check(operationsCss.includes(".simple-process-head p")&&operationsCss.includes("color:#416e99!important"),"Gestión rápida debe mostrar cliente/etapa en azul legible.");
  check(operationsCss.includes("grid-template-columns:repeat(5,minmax(0,1fr))!important"),"Gestión rápida debe aprovechar el ancho con cinco estados en desktop.");
}
