

export function validateInventoryOwnership({ check, exists }){
  const requiredInventory=[
    "assets/js/modules/inventory.js",
    "assets/js/modules/inventory-ui-v11240.js",
    "assets/js/modules/inventory-dialogs-v11260.js",
    "assets/js/modules/inventory-home-v11250.js",
    "assets/js/modules/inventory-operator-v11250.js",
    "assets/js/modules/inventory-plan-v11250.js",
    "assets/js/modules/inventory-review-v11250.js",
    "assets/js/modules/inventory-stock-v11250.js",
    "assets/js/modules/inventory-ledger-v11250.js",
    "assets/js/modules/inventory-control-v11250.js",
    "assets/js/modules/inventory-export-v11250.js",
    "assets/js/services/inventory.js"
  ];
  for(const file of requiredInventory)check(exists(file),`Falta propietario vigente de Inventario: ${file}`);
  const retiredInventory=[
    "assets/js/modules/inventory-modal-v11253.js",
    "assets/js/modules/inventory-modal-workspace-v11254.js",
    "assets/js/modules/inventory-control-v11230.js",
    "assets/js/modules/inventory-operator-v11230.js",
    "assets/js/modules/inventory-plan-v11232.js",
    "assets/js/modules/inventory-review-v11230.js",
    "assets/js/modules/inventory-stock-v11230.js",
    "assets/js/modules/inventory-cycle-v11220.js",
    "assets/js/modules/inventory-control-v11220.js",
    "assets/js/modules/inventory-stock.js"
  ];
  for(const file of retiredInventory)check(!exists(file),`Inventario conserva propietario histórico retirado: ${file}`);
}
