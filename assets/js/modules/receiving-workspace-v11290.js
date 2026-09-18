/* CRM Suministros · Receiving Popups V11.29.1
   Ajuste estrictamente limitado a pop-ups de Recepción.
   No modifica la vista principal, RPC, datos, permisos ni handlers. */

const STYLE_ID="receiving-workspace-v11290";

if(!document.getElementById(STYLE_ID)){
  const link=document.createElement("link");
  link.id=STYLE_ID;link.rel="stylesheet";link.href="./assets/runtime-css/receiving-workspace-v11290.css?v=11.30.2";
  document.head.appendChild(link);
}
