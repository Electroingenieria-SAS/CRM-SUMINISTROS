

export function readMigrationContractContext({ read }){
  const inventoryMigration=read("supabase/migrations/095_inventory_accounting_blind_count_v11_23_0.sql");
  const expressMigration=read("supabase/migrations/096_inventory_express_super_admin_review_v11_23_1.sql");
  const scheduleMigration=read("supabase/migrations/097_restore_inventory_control_plan_v11_23_2.sql");
  const rlsAuditMigration=read("supabase/migrations/098_profiles_rls_scope_v11_27_0.sql");
  const workPerfMigration=read("supabase/migrations/099_work_my_day_role_cache_v11_27_0.sql");
  const inventoryFilterMigration=read("supabase/migrations/100_inventory_filtered_hotpath_v11_27_0.sql");
  const inventoryPlanMigration=read("supabase/migrations/101_inventory_count_plan_hotpath_v11_27_0.sql");
  const securityDefinerMigration=read("supabase/migrations/110_security_definer_contract_v11_30_1.sql");
  const securityDefinerFixMigration=read("supabase/migrations/111_security_definer_contract_regex_fix_v11_30_1.sql");
  const deliverySatisfactionMigration=read("supabase/migrations/112_delivery_satisfaction_distance_v11_31_0.sql");
  const deliverySatisfactionIndexMigration=read("supabase/migrations/113_delivery_satisfaction_fk_indexes_v11_31_0.sql");
  const hardeningMigration=read("supabase/migrations/114_impersonation_metrics_security_v11_32_0.sql");
  const workforcePlannerMigration=read("supabase/migrations/115_workforce_planner_calendar_v11_33_0.sql");
  const workforceTodayMigration=read("supabase/migrations/116_workforce_my_day_automation_v11_34_0.sql");
  const workforceManagerMigration=read("supabase/migrations/117_workforce_manager_review_v11_34_1.sql");
  const workforceCatalogMigration=read("supabase/migrations/118_workforce_catalog_taxonomy_v11_34_3.sql");
  const workforceTimelineMigration=read("supabase/migrations/119_workforce_timeline_evidence_v11_35_0.sql");
  const workforceCalendarMigration=read("supabase/migrations/120_workforce_calendar_feed_v11_36_0.sql");
  const pacoMigration=read("supabase/migrations/121_paco_operational_snapshot_v11_37_0.sql");
    return { inventoryMigration, expressMigration, scheduleMigration, rlsAuditMigration, workPerfMigration, inventoryFilterMigration, inventoryPlanMigration, securityDefinerMigration, securityDefinerFixMigration, deliverySatisfactionMigration, deliverySatisfactionIndexMigration, hardeningMigration, workforcePlannerMigration, workforceTodayMigration, workforceManagerMigration, workforceCatalogMigration, workforceTimelineMigration, workforceCalendarMigration, pacoMigration };
}
