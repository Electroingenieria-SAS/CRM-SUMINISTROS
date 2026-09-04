-- V11.8.1 · Jefatura Logística: revisión y aprobación sin operación directa
-- Aplicado en producción como migración 079.

update erp_supply.role_module_permissions
set can_create = false,
    can_update = false,
    can_admin = false,
    can_approve = case
      when module_code in ('approvals','billing','cutting','inventory','orders','picking','purchasing','receiving','shipping','workforce') then true
      else false
    end
where role_code = 'jefe_logistica';

update erp_supply.step_roles
set can_view = true,
    can_claim = false,
    can_assign = false,
    can_start = false,
    can_complete = false,
    can_block = false,
    can_override = false
where role_code = 'jefe_logistica';

create or replace function erp_supply.can_approve_globally()
returns boolean
language sql
stable
security definer
set search_path to 'erp_supply','public','auth','pg_catalog'
as $$
  select erp_supply.has_role('super_admin')
      or erp_supply.has_role('gerencia')
      or erp_supply.has_role('jefe_logistica');
$$;

create or replace function erp_supply.can_manage_exception_center()
returns boolean
language sql
stable
security definer
set search_path to 'erp_supply','public','auth','pg_catalog'
as $$
  select erp_supply.has_role('super_admin')
      or erp_supply.has_role('gerencia');
$$;

-- Mantener Jefatura como autoridad global de aprobación sin devolverle
-- autoridad operativa para resolver incidencias.
do $migration$
declare v_def text;
begin
  v_def := pg_get_functiondef('public.erp_x_decide_approval(uuid,text,text)'::regprocedure);
  v_def := replace(v_def, 'v_global boolean:=erp_supply.can_manage_exception_center();', 'v_global boolean:=erp_supply.can_approve_globally();');
  execute v_def;

  v_def := pg_get_functiondef('public.erp_x_list_approvals(text,integer,integer)'::regprocedure);
  v_def := replace(v_def, 'v_global boolean:=erp_supply.can_manage_exception_center();', 'v_global boolean:=erp_supply.can_approve_globally();');
  execute v_def;

  v_def := pg_get_functiondef('public.erp_x_decide_order_cancellation(uuid,text,text)'::regprocedure);
  v_def := replace(v_def, 'v_global boolean:=erp_supply.can_manage_exception_center();', 'v_global boolean:=erp_supply.can_approve_globally();');
  execute v_def;
end
$migration$;

-- En la bandeja Jefatura puede revisar, pero no se le ofrece Solucionar.
do $migration$
declare v_def text;
begin
  v_def := pg_get_functiondef('public.erp_x_exception_center(text,text,integer,integer)'::regprocedure);
  v_def := replace(
    v_def,
    $old$(not erp_supply.profile_is_read_only_auditor(v_actor) and (erp_supply.can_manage_exception_center() or i.target_role_code=any(v_roles) or o.current_assignee_id=v_actor or (i.source_code='NO_DELIVERY' and erp_supply.can_access_module('shipping','update')))) can_resolve$old$,
    $new$(not erp_supply.profile_is_read_only_auditor(v_actor) and not (erp_supply.has_role('jefe_logistica') and not (erp_supply.has_role('super_admin') or erp_supply.has_role('gerencia'))) and (erp_supply.can_manage_exception_center() or i.target_role_code=any(v_roles) or o.current_assignee_id=v_actor or (i.source_code='NO_DELIVERY' and erp_supply.can_access_module('shipping','update')))) can_resolve$new$
  );
  execute v_def;
end
$migration$;

-- Defensa backend: Jefatura no puede cerrar incidencias por llamada directa al RPC.
do $migration$
declare v_def text;
begin
  v_def := pg_get_functiondef('public.erp_x_resolve_order_issue(uuid,jsonb)'::regprocedure);
  v_def := replace(
    v_def,
    $old$if v_resolution is null then raise exception 'Describe cómo se solucionó'; end if;$old$,
    $new$if erp_supply.has_role('jefe_logistica') and not (erp_supply.has_role('super_admin') or erp_supply.has_role('gerencia')) then
    raise exception 'Jefatura Logística es un perfil de revisión y aprobación; no puede cerrar gestiones operativas' using errcode='42501';
  end if;
  if v_resolution is null then raise exception 'Describe cómo se solucionó'; end if;$new$
  );
  execute v_def;
end
$migration$;
