-- V11.8.2 · Compatibilidad con workflow_steps.sort_order
-- Idempotente: conserva la función aun cuando 081 ya fue versionada con sort_order.
do $migration$
declare v_def text;
begin
  v_def:=pg_get_functiondef('public.erp_x_audit_dashboard(jsonb)'::regprocedure);
  v_def:=replace(v_def,'order by s.sequence_no','order by s.sort_order');
  execute v_def;
end
$migration$;
