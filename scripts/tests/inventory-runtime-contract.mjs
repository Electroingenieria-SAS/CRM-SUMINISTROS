

export function validateInventoryRuntime({ check, inventory, service, home, operator, plan, review, stock, ledger, control, exportsModule, ui, inventoryContract }){
  check(inventory.includes('inventoryCountCenter')&&inventory.includes('access.operator')&&inventory.includes('access.controller'),"Inventario debe gobernarse por capacidades del servidor.");
  for(const view of ["home","capture","express","count","labels","plan","review","history","stock","ledger","control"])check(inventory.includes(`"${view}"`),`Falta vista de Inventario: ${view}`);
  check(inventory.includes('express-review'),"Super Admin perdió Revisión exprés.");
  check(inventory.includes('inventory-nav-v11251')&&inventory.includes('Control y auditoría')&&inventory.includes('inventory-nav-groups-v11251'),"Inventario perdió la navegación agrupada.");
  check(inventoryContract.includes('overflow-wrap:anywhere')&&inventoryContract.includes('@media(max-width:760px)')&&inventoryContract.includes('@media(max-width:480px)'),"Inventario perdió defensas responsive contra desbordes.");
  check(home.includes("Conteo no programado")&&home.includes("Etiquetas y stickers")&&home.includes("Movimientos"),"Inicio no expone las funciones críticas.");
  check(operator.includes("REGISTRAR CONTEO")&&operator.includes("Conteo exprés")&&operator.includes("Metraje")&&operator.includes("Imprimir jornada")&&operator.includes("Exportar CSV"),"Captura perdió conteo, exprés, metraje o stickers.");
  check(operator.includes("inventoryCountSubmit")&&operator.includes("inventoryCountResolve")&&operator.includes("inventoryCountSearch"),"Captura no usa los contratos seguros de conteo.");
  check(plan.includes("PARETO ADAPTATIVO")&&plan.includes("Exportar CSV")&&plan.includes("businessScore"),"Plan perdió Pareto o exportación.");
  check(review.includes("Aprobar y aplicar")&&review.includes("Solicitar reconteo")&&review.includes("Exportar CSV")&&review.includes("ALL"),"Revisión/Historial perdió decisiones o exportación.");
  check(review.includes('inventory-audit-card-v11251')&&review.includes('inventory-audit-filter-v11251')&&review.includes('inventory-audit-tabs-v11251'),"Revisión/Exprés/Historial perdió su composición de auditoría.");
  check(review.includes('inventory-comparison-row-v11251')&&review.includes('Reservado')&&review.includes('Bloqueado')&&review.includes('Diferencia / impacto'),"Detalle de revisión perdió comparación física estructurada.");
  check(!review.includes('inventoryEnterpriseRow'),"Revisión volvió a usar la fila genérica que causaba desbordes.");
  check(stock.includes("Actualizar Siesa")&&stock.includes("Exportar CSV")&&stock.includes("inventoryMovements"),"Existencias perdió sincronización, exportación o trazabilidad.");
  check(ledger.includes("KARDEX")&&ledger.includes("inventoryMovements")&&ledger.includes("Exportar CSV"),"Movimientos no implementa kardex exportable.");
  check(control.includes("PARETO ADAPTATIVO")&&control.includes("Exportar análisis"),"Inteligencia perdió Pareto o exportación.");
  check(exportsModule.includes("downloadCsv")&&exportsModule.includes("URL.createObjectURL"),"Falta utilidad de exportación CSV.");
  check(ui.includes("v115-goods-row")&&ui.includes("bindListFilter"),"Falta el sistema visual WMS común.");
  check(ui.includes('inventory-enterprise-row-v11252')&&ui.includes('has-actions')&&ui.includes('no-actions'),"Inventario perdió el contrato de filas con/sin acciones.");
  check(ui.includes('const actionsHtml=hasActions?')&&ui.includes('const hasActions=Boolean(actionHtml)'),"inventoryEnterpriseRow volvió a reservar una zona de acción sin comprobar contenido.");
  check(!ui.includes('<div class="page-actions">${actions}</div>'),"inventoryEnterpriseRow conserva el contenedor de acciones incondicional histórico.");
  check(ui.includes('no-controls')&&ui.includes('Sin distribución Pareto'),"La auditoría de contenedores vacíos perdió toolbar o Pareto defensivo.");
  check(service.includes("erp_x_inventory_count_submit")&&service.includes("erp_x_inventory_count_review")&&service.includes("erp_x_inventory_express_reports"),"El servicio de Inventario perdió contratos contables.");
  check(!service.includes("erp_x_inventory_cycle_count"),"El servicio aún referencia conteo directo V11.22.");
}
