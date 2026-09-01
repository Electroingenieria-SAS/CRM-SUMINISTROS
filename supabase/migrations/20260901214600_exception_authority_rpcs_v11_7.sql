-- CRM Suministros V11.7.0
-- Extiende la autoridad efectiva del Centro de Excepciones sin duplicar el flujo.

do $$
declare v_def text; v_new text;
begin
  select pg_get_functiondef('public.erp_x_exception_center(text,text,integer,integer)'::regprocedure) into v_def;
  v_new:=replace(v_def,
    '(erp_supply.has_role(''super_admin'') or erp_supply.has_role(''jefe_logistica'') or i.target_role_code=any(v_roles) or o.current_assignee_id=v_actor or (i.source_code=''NO_DELIVERY'' and erp_supply.can_access_module(''shipping'',''update''))) can_resolve',
    '(erp_supply.can_manage_exception_center() or i.target_role_code=any(v_roles) or o.current_assignee_id=v_actor or (i.source_code=''NO_DELIVERY'' and erp_supply.can_access_module(''shipping'',''update''))) can_resolve');
  v_new:=replace(v_new,
    '(erp_supply.has_role(''super_admin'') or erp_supply.has_role(''jefe_logistica'') or erp_supply.has_role(''auditoria'') or erp_supply.has_role(''gerencia'')) can_resolve',
    'erp_supply.can_manage_exception_center() can_resolve');
  v_new:=replace(v_new,
    'a.id,''APPROVAL''::text item_type,a.request_type subtype,a.order_id,o.order_number,o.client_name,o.priority,',
    'a.id,''APPROVAL''::text item_type,a.request_type subtype,a.order_id,o.order_number,o.client_name,coalesce(nullif(a.request_payload->>''priority'',''''),o.priority) priority,');
  if v_new=v_def then raise exception 'No se pudo adaptar erp_x_exception_center'; end if;
  execute v_new;

  select pg_get_functiondef('public.erp_x_list_approvals(text,integer,integer)'::regprocedure) into v_def;
  v_new:=replace(v_def,
    'or erp_supply.has_role(''super_admin'') or erp_supply.has_role(''gerencia'') or erp_supply.has_role(''auditoria'') or erp_supply.has_role(''jefe_logistica'')',
    'or erp_supply.can_manage_exception_center() or erp_supply.has_role(''auditoria'')');
  v_new:=replace(v_new,
    'when a.request_type=''CANCELLATION'' then erp_supply.has_role(''jefe_logistica'')',
    'when a.request_type=''CANCELLATION'' then erp_supply.can_manage_exception_center()');
  v_new:=replace(v_new,
    'and not (erp_supply.has_role(''super_admin'') or erp_supply.has_role(''gerencia'') or erp_supply.has_role(''jefe_logistica''))',
    'and not erp_supply.can_manage_exception_center()');
  v_new:=replace(v_new,
    'o.priority,o.current_step_code',
    'case when a.request_type=''PRIORITY'' then coalesce(nullif(a.request_payload->>''priority'',''''),o.priority) else o.priority end priority,o.current_step_code');
  if v_new=v_def then raise exception 'No se pudo adaptar erp_x_list_approvals'; end if;
  execute v_new;

  select pg_get_functiondef('public.erp_x_resolve_order_issue(uuid,jsonb)'::regprocedure) into v_def;
  v_new:=replace(v_def,
    '(erp_supply.has_role(''super_admin'') or erp_supply.has_role(''jefe_logistica'') or v_issue.target_role_code=any(v_roles) or v_order.current_assignee_id=v_actor or (v_issue.source_code=''NO_DELIVERY'' and erp_supply.can_access_module(''shipping'',''update'')))',
    '(erp_supply.can_manage_exception_center() or v_issue.target_role_code=any(v_roles) or v_order.current_assignee_id=v_actor or (v_issue.source_code=''NO_DELIVERY'' and erp_supply.can_access_module(''shipping'',''update'')))');
  if v_new=v_def then raise exception 'No se pudo adaptar erp_x_resolve_order_issue'; end if;
  execute v_new;

  select pg_get_functiondef('public.erp_x_decide_order_cancellation(uuid,text,text)'::regprocedure) into v_def;
  v_new:=replace(v_def,
    'if not erp_supply.has_role(''jefe_logistica'') then'||chr(13)||chr(10)||'    raise exception ''Solo Jefatura Logística puede decidir la cancelación de un pedido'' using errcode=''42501'';'||chr(13)||chr(10)||'  end if;',
    'if not erp_supply.can_manage_exception_center() then'||chr(13)||chr(10)||'    raise exception ''Solo Liderazgo Logístico, Jefatura Logística o Gerencia pueden decidir la cancelación de un pedido'' using errcode=''42501'';'||chr(13)||chr(10)||'  end if;');
  if v_new=v_def then
    v_new:=replace(v_def,
      'if not erp_supply.has_role(''jefe_logistica'') then
    raise exception ''Solo Jefatura Logística puede decidir la cancelación de un pedido'' using errcode=''42501'';
  end if;',
      'if not erp_supply.can_manage_exception_center() then
    raise exception ''Solo Liderazgo Logístico, Jefatura Logística o Gerencia pueden decidir la cancelación de un pedido'' using errcode=''42501'';
  end if;');
  end if;
  if v_new=v_def then raise exception 'No se pudo adaptar erp_x_decide_order_cancellation'; end if;
  execute v_new;
end $$;

create or replace function erp_supply.sync_priority_approval_v117()
returns trigger
language plpgsql
security definer
set search_path='erp_supply','public','auth','pg_catalog'
as $$
declare v_state text;
begin
  if new.request_type<>'PRIORITY' or new.status is not distinct from old.status then return new; end if;
  v_state:=case when new.status in('APPROVED','EXECUTED') then 'APPROVED' when new.status='REJECTED' then 'REJECTED' else new.status end;
  update erp_supply.orders
  set metadata=jsonb_set(coalesce(metadata,'{}'::jsonb),'{urgencyRequest}',
    coalesce(metadata->'urgencyRequest','{}'::jsonb)||jsonb_build_object('status',v_state,'decidedBy',new.decided_by,'decidedAt',new.decided_at,
      'decisionReason',new.decision_reason,'version','11.7.0'),true)
  where id=new.order_id;
  return new;
end;
$$;

drop trigger if exists trg_sync_priority_approval_v117 on erp_supply.approval_requests;
create trigger trg_sync_priority_approval_v117 after update of status on erp_supply.approval_requests
for each row execute function erp_supply.sync_priority_approval_v117();
