/* CRM Suministros · Inventory Visual System V11.27.0
   Glow up integral del módulo Inventario sin alterar lógica de negocio.
   Alcance: navegación, cabeceras, KPI, tarjetas, filtros, filas, revisión,
   Pareto, formularios, pop-ups, scanner, etiquetas y estados. */

const STYLE_ID="inventory-visual-v11270";

function installInventoryVisualV11270(){
  if(document.getElementById(STYLE_ID))return;
  const link=document.createElement("link");
  link.id=STYLE_ID;link.rel="stylesheet";link.href="./assets/runtime-css/inventory-visual-v11270.css?v=11.30.2";
  document.head.appendChild(link);
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",installInventoryVisualV11270,{once:true});
else installInventoryVisualV11270();
