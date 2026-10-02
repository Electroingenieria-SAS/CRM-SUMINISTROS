

export function validateInventoryBootstrap({ check, entry }){
  check(entry.includes('import "./modules/inventory-visual-v11270.js";'),"app-entry.js debe instalar la capa visual vigente de Inventario.");
  check(!entry.includes("inventory-modal-v11253.js")&&!entry.includes("inventory-modal-workspace-v11254.js"),"app-entry.js no debe cargar propietarios modales históricos.");
}
