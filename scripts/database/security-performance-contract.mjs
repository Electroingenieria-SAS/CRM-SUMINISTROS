

export function validateDatabaseSecurityPerformance({ check, rlsAuditMigration, workPerfMigration, inventoryFilterMigration, inventoryPlanMigration, securityDefinerMigration, securityDefinerFixMigration, deliverySatisfactionMigration, deliverySatisfactionIndexMigration, hardeningMigration, supabaseConfig, shippingFlow, sentOrders, api, reportsEnterprise }){
  check(rlsAuditMigration.includes('drop policy if exists erp_active_read on public.profiles'),"Migración 098 debe retirar la policy RLS permisiva redundante.");
  check(workPerfMigration.includes('erp_supply.current_roles()')&&workPerfMigration.includes('v_roles'),"Migración 099 debe cachear roles de Mi jornada una sola vez.");
  check(inventoryFilterMigration.includes("when v_search='' then true")&&inventoryFilterMigration.includes('else erp_supply.material_norm('),"Migración 100 debe diferir la normalización textual cuando no hay búsqueda.");
  check(inventoryPlanMigration.includes("where l.inventory_item_id=s.item_id and l.source_active"),"Migración 101 debe construir detalle de lotes solo para el plan seleccionado.");
  check(securityDefinerMigration.includes("erp_x_security_definer_contract_check")&&securityDefinerMigration.includes("from public,anon,authenticated")&&securityDefinerMigration.includes("grant execute on function public.erp_x_security_definer_contract_check() to service_role"),"Migración 110 debe crear el health contract SECURITY DEFINER como service-role-only.");
  check(securityDefinerFixMigration.includes("auth[.]uid[(][)]")&&securityDefinerFixMigration.includes("erp_x_security_definer_contract_check"),"Migración 111 debe conservar el detector corregido de auth.uid().");
  check(deliverySatisfactionMigration.includes("erp_x_shipping_confirm_satisfaction")&&deliverySatisfactionMigration.includes("distance_km")&&deliverySatisfactionMigration.includes("satisfaction_confirmed_at"),"Migración 112 debe instalar distancia y satisfacción post-entrega.");
  check(deliverySatisfactionMigration.includes("DELIVERED_SATISFIED")&&deliverySatisfactionMigration.includes("postDeliveryConfirmationSeconds"),"Migración 112 debe conservar milestone y métricas post-entrega.");
  check(deliverySatisfactionMigration.includes("revoke all on function public.erp_x_shipping_confirm_satisfaction")&&deliverySatisfactionMigration.includes("grant execute on function public.erp_x_shipping_confirm_satisfaction"),"RPC de satisfacción debe tener frontera de permisos explícita.");
  check(api.includes("confirmShippingSatisfaction")&&api.includes("erp_x_shipping_confirm_satisfaction"),"API frontend debe exponer confirmación de satisfacción.");
  check(shippingFlow.includes("Entregado con satisfacción")&&shippingFlow.includes("Distancia recorrida (km)")&&shippingFlow.includes("distanceSource"),"Shipping flow debe capturar satisfacción, distancia y fuente.");
  check(sentOrders.includes("data-satisfaction")&&sentOrders.includes("distanceText")&&sentOrders.includes("satisfactionConfirmedAt"),"Pedidos enviados debe mostrar y permitir confirmar satisfacción.");
  check(deliverySatisfactionMigration.includes("reports_delivery_explore_v1131")&&deliverySatisfactionMigration.includes("reports_delivery_export_v1131"),"Migración 112 debe integrar Entregas con Analítica y exportación.");
  check(deliverySatisfactionIndexMigration.includes("distance_recorded_by")&&deliverySatisfactionIndexMigration.includes("satisfaction_confirmed_by"),"Migración 113 debe cubrir las FKs de actores post-entrega.");
  check(deliverySatisfactionIndexMigration.includes("drop index if exists erp_supply.idx_deliveries_satisfaction_confirmed_v1131"),"Migración 113 debe retirar el índice temporal de satisfacción sin hot path.");
  check(reportsEnterprise.includes("distance_km")&&reportsEnterprise.includes("avg_distance_km")&&reportsEnterprise.includes("avg_satisfaction_hours"),"Analítica debe exponer distancia y satisfacción del dataset Entregas.");
  check(hardeningMigration.includes("admin_impersonation_sessions")&&hardeningMigration.includes("originalActorProfileId")&&hardeningMigration.includes("effectiveActorProfileId"),"Migración 114 debe conservar trazabilidad de impersonación con actor original y efectivo.");
  check(hardeningMigration.includes("erp_x_auditoria_erp_metrics_user")&&hardeningMigration.includes("wr.organization_id=v_org"),"Migración 114 debe limitar métricas de integración a la organización autenticada.");
  check(/\[functions\.erp-auditoria-metrics\][\s\S]*?verify_jwt\s*=\s*true/.test(supabaseConfig),"erp-auditoria-metrics debe exigir JWT en supabase/config.toml.");
}
