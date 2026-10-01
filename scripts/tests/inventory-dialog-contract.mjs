

export function validateInventoryDialogs({ check, inventoryDialogs, inventoryDialogsContract }){
  for(const token of [
    "inventory-dialog-v11260",
    "inventory-dialog-guide-v11260",
    "inventory-dialog-count-v11260",
    "inventory-dialog-review-v11260",
    "inventory-dialog-stock-v11260",
    "inventory-dialog-plan-v11260",
    "inventory-dialog-scanner-v11260",
    "inventory-dialog-labels-v11260",
    "inventory-dialog-identified-v11260",
    "inventory-dialog-sync-v11260",
    "MutationObserver",
    "#modal-root",
    "state.currentModule"
  ])check(inventoryDialogsContract.includes(token),`Sistema de diálogos guiados incompleto: falta ${token}.`);
  for(const width of ["1120px","1040px","1000px","960px","940px","820px","720px"])check(inventoryDialogsContract.includes(`--inventory-dialog-width:${width}`),`Falta ancho contenido: ${width}.`);
  check(inventoryDialogsContract.includes('calc(100vw - 96px)'),"Desktop debe conservar margen lateral visible.");
  check(!inventoryDialogsContract.includes('width:min(86vw')&&!inventoryDialogsContract.includes('width:min(88vw')&&!inventoryDialogsContract.includes('width:min(94vw'),"Inventario volvió a geometrías casi full-screen en escritorio.");
  check(inventoryDialogsContract.includes('min-height:48px')&&inventoryDialogsContract.includes('font-size:16px')&&inventoryDialogsContract.includes('width:46px')&&inventoryDialogsContract.includes('height:46px'),"Controles o acciones ya no cumplen accesibilidad táctil/visual.");
  check(inventoryDialogs.includes('Qué debes hacer')&&inventoryDialogs.includes('Confirma la referencia')&&inventoryDialogs.includes('Escribe la cantidad física'),"Falta guía de operación simple en los diálogos.");
  check(inventoryDialogsContract.includes('grid-template-columns:repeat(3,minmax(0,1fr))'),"Revisión debe agrupar comparación por lote en tres columnas legibles.");
  check(inventoryDialogsContract.includes('@media(max-width:820px)')&&inventoryDialogsContract.includes('@media(max-width:620px)'),"Faltan breakpoints de tablet/móvil.");
  check(inventoryDialogs.includes('simplifyFooter')&&inventoryDialogs.includes('single-action-v11260'),"Los diálogos informativos deben evitar Cancelar + Cerrar duplicados.");
}
