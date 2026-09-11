-- CRM Suministros V11.27.0 · Auditoría de rendimiento
-- Evita recalcular current_roles() múltiples veces en el wrapper de Mi jornada.
-- No cambia permisos ni datos; solo reutiliza el contexto de roles de la llamada.

create or replace function public.erp_x_work_my_day(p_day date default current_date)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_result jsonb;
  v_roles text[];
  v_can_view_team boolean;
  v_can_plan_logistics boolean;
begin
  perform erp_supply.require_profile();
  v_roles:=erp_supply.current_roles();
  v_result:=erp_supply.work_my_day_core(p_day);

  v_can_view_team:=v_roles && array[
    'jefe_logistica','lider_logistica','coordinador_logistico','gerencia','super_admin'
  ]::text[];

  v_can_plan_logistics:=v_roles && array[
    'jefe_logistica','lider_logistica','coordinador_logistico','super_admin'
  ]::text[];

  return jsonb_set(
    jsonb_set(
      jsonb_set(v_result,'{permissions,canViewTeam}',to_jsonb(v_can_view_team),true),
      '{permissions,canPlanLogistics}',to_jsonb(v_can_plan_logistics),true
    ),
    '{version}',to_jsonb('11.3.0'::text),true
  );
end;
$function$;

revoke execute on function public.erp_x_work_my_day(date) from public, anon;
grant execute on function public.erp_x_work_my_day(date) to authenticated, service_role;

select pg_notify('pgrst','reload schema');
