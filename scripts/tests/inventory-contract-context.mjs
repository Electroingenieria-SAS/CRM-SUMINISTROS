

export function readInventoryContractContext({ read }){
  const inventory=read("assets/js/modules/inventory.js");
  const service=read("assets/js/services/inventory.js");
  const home=read("assets/js/modules/inventory-home-v11250.js");
  const operator=read("assets/js/modules/inventory-operator-v11250.js");
  const plan=read("assets/js/modules/inventory-plan-v11250.js");
  const review=read("assets/js/modules/inventory-review-v11250.js");
  const stock=read("assets/js/modules/inventory-stock-v11250.js");
  const ledger=read("assets/js/modules/inventory-ledger-v11250.js");
  const control=read("assets/js/modules/inventory-control-v11250.js");
  const exportsModule=read("assets/js/modules/inventory-export-v11250.js");
  const ui=read("assets/js/modules/inventory-ui-v11240.js");
  const inventoryDialogs=read("assets/js/modules/inventory-dialogs-v11260.js");
  const inventoryWorkspaceCss=read("assets/runtime-css/inventory-workspace-v11251.css");
  const inventoryDialogsCss=read("assets/runtime-css/inventory-dialogs-v11260.css");
  const inventoryContract=inventory+"\n"+inventoryWorkspaceCss;
  const inventoryDialogsContract=inventoryDialogs+"\n"+inventoryDialogsCss;
    return { inventory, service, home, operator, plan, review, stock, ledger, control, exportsModule, ui, inventoryDialogs, inventoryWorkspaceCss, inventoryDialogsCss, inventoryContract, inventoryDialogsContract };
}
