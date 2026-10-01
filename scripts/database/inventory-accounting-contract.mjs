

export function validateInventoryAccounting({ check, inventoryMigration, expressMigration, scheduleMigration }){
  for(const token of [
    "erp_supply.inventory_count_reports",
    "erp_x_inventory_count_submit",
    "erp_x_inventory_count_review",
    "erp_x_inventory_count_center",
    "inventory_count_is_blind_operator",
    "drop function if exists public.erp_x_inventory_cycle_count",
    "drop function if exists public.erp_x_inventory_cycle_control"
  ])check(inventoryMigration.includes(token),`Migración 095 incompleta: falta ${token}.`);
  check(inventoryMigration.includes("Vista de existencias restringida durante el conteo ciego"),"Falta el bloqueo de existencias para el auxiliar.");
  check(expressMigration.includes("erp_x_inventory_express_reports")&&expressMigration.includes("erp_supply.has_role('super_admin')"),"Migración 096 perdió la revisión exprés exclusiva.");
  check(scheduleMigration.includes("inventory_count_schedule_core")&&scheduleMigration.includes("remainingToday")&&scheduleMigration.includes("countedToday"),"Migración 097 perdió el avance real de jornada.");
}
