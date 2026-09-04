-- CRM Suministros V11.8.1 · remediación de auditoría
-- NO_DELIVERY solo se ofrece a Ventas/Super Admin, prioridades canónicas y grants anon mínimos.

do $$
declare
  v_def text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef('public.erp_x_get_actions(uuid)'::regprocedure) into v_def;
  v_old := 'and erp_supply.actor_can(v_actor,v_order.current_step_code,''WAIT'',v_order.current_assignee_id) then v_actions:=v_actions||jsonb_build_array(jsonb_build_object(''code'',''NO_DELIVERY''';
  v_new := 'and (erp_supply.has_role(''ventas'') or erp_supply.has_role(''super_admin'')) and erp_supply.actor_can(v_actor,v_order.current_step_code,''WAIT'',v_order.current_assignee_id) then v_actions:=v_actions||jsonb_build_array(jsonb_build_object(''code'',''NO_DELIVERY''';
  if position(v_old in v_def)=0 then raise exception 'Contrato NO_DELIVERY inesperado; migración detenida'; end if;
  execute replace(v_def,v_old,v_new);

  select pg_get_functiondef('public.erp_x_session()'::regprocedure) into v_def;
  v_old := '''priorities'',jsonb_build_array(''LOW'',''MEDIUM'',''HIGH'',''URGENT'',''CRITICAL'')';
  v_new := '''priorities'',jsonb_build_array(''LOW'',''MEDIUM'',''URGENT'')';
  if position(v_old in v_def)=0 then raise exception 'Catálogo de prioridades inesperado; migración detenida'; end if;
  execute replace(v_def,v_old,v_new);
end $$;

revoke execute on function public.erp_x_goods_receipt_labels(text) from anon;
revoke execute on function public.erp_x_inventory_scan_resolve(text) from anon;
