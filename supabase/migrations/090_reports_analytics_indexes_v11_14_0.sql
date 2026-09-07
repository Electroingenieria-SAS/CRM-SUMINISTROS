-- CRM Suministros · V11.14.0
-- Índices orientados a rangos temporales usados por Analítica y reportes.
create index if not exists idx_reports_invoices_created_v11140 on erp_supply.invoices(created_at desc,order_id);
create index if not exists idx_reports_deliveries_created_v11140 on erp_supply.deliveries(created_at desc,order_id);
create index if not exists idx_reports_tasks_created_v11140 on erp_supply.order_tasks(created_at desc,order_id,step_code);
create index if not exists idx_reports_sessions_started_v11140 on erp_supply.task_sessions(started_at desc,task_id,profile_id);
create index if not exists idx_reports_work_org_started_v11140 on erp_supply.work_executions(organization_id,started_at desc,profile_id);
create index if not exists idx_reports_issues_org_created_v11140 on erp_supply.order_issues(organization_id,created_at desc);
create index if not exists idx_reports_approvals_org_created_v11140 on erp_supply.approval_requests(organization_id,created_at desc);
create index if not exists idx_reports_orders_closed_v11140 on erp_supply.orders(organization_id,closed_at desc) where closed_at is not null and not coalesce(is_test,false);
