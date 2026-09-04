-- V11.8.1 · Gobierno de roles: Gerencia revisiva/aprobativa y Cartera financiera

-- GERENCIA: lectura total, sin operación ni edición directa.
update erp_supply.role_module_permissions
set can_read = true,
    can_create = false,
    can_update = false,
    can_admin = false,
    can_approve = case
      when module_code in (
        'approvals','orders','sales','credit','cartera','caja',
        'purchasing','receiving','picking','cutting','inventory',
        'billing','shipping','workforce'
      ) then true
      else false
    end
where role_code = 'gerencia';

update erp_supply.step_roles
set can_view = true,
    can_claim = false,
    can_assign = false,
    can_start = false,
    can_complete = false,
    can_block = false,
    can_override = false
where role_code = 'gerencia';

-- CARTERA: autoridad financiera únicamente; no decide aprobaciones generales del workflow.
update erp_supply.role_module_permissions
set can_approve = case when module_code in ('cartera','credit') then true else false end,
    can_admin = false
where role_code = 'cartera';

update erp_supply.role_module_permissions
set can_read = true,
    can_create = true,
    can_update = false,
    can_approve = false,
    can_admin = false
where role_code = 'cartera' and module_code = 'approvals';

-- Diferenciar ver el centro de excepciones de resolver incidencias.
create or replace function erp_supply.can_view_exception_center()
returns boolean
language sql
stable
security definer
set search_path to 'erp_supply','public','auth','pg_catalog'
as $$
  select erp_supply.has_role('super_admin')
      or erp_supply.has_role('gerencia')
      or erp_supply.has_role('jefe_logistica')
      or erp_supply.has_role('auditoria');
$$;

create or replace function erp_supply.is_review_approval_only()
returns boolean
language sql
stable
security definer
set search_path to 'erp_supply','public','auth','pg_catalog'
as $$
  select (erp_supply.has_role('gerencia') or erp_supply.has_role('jefe_logistica'))
     and not erp_supply.has_role('super_admin');
$$;

-- Resolver incidencias directamente queda reservado al Super Admin o al responsable operativo.
create or replace function erp_supply.can_manage_exception_center()
returns boolean
language sql
stable
security definer
set search_path to 'erp_supply','public','auth','pg_catalog'
as $$
  select erp_supply.has_role('super_admin');
$$;

-- Ajustar bandeja: Gerencia/Jefatura/Auditoría ven todo; Gerencia/Jefatura no reciben botón de resolver incidencias.
do $migration$
declare v_def text;
begin
  v_def := pg_get_functiondef('public.erp_x_exception_center(text,text,integer,integer)'::regprocedure);
  v_def := replace(
    v_def,
    'v_control boolean:=erp_supply.can_manage_exception_center() or erp_supply.has_role(''auditoria'');',
    'v_control boolean:=erp_supply.can_view_exception_center();'
  );
  v_def := replace(
    v_def,
    'not (erp_supply.has_role(''jefe_logistica'') and not (erp_supply.has_role(''super_admin'') or erp_supply.has_role(''gerencia'')))',
    'not erp_supply.is_review_approval_only()'
  );
  execute v_def;

  v_def := pg_get_functiondef('public.erp_x_exception_summary()'::regprocedure);
  v_def := replace(
    v_def,
    'v_control boolean:=erp_supply.can_manage_exception_center() or erp_supply.has_role(''auditoria'');',
    'v_control boolean:=erp_supply.can_view_exception_center();'
  );
  execute v_def;
end
$migration$;

-- Defensa backend: Gerencia y Jefatura no pueden cerrar incidencias por llamada directa.
do $migration$
declare v_def text;
begin
  v_def := pg_get_functiondef('public.erp_x_resolve_order_issue(uuid,jsonb)'::regprocedure);
  v_def := replace(
    v_def,
    'if erp_supply.has_role(''jefe_logistica'') and not (erp_supply.has_role(''super_admin'') or erp_supply.has_role(''gerencia'')) then
    raise exception ''Jefatura Logística es un perfil de revisión y aprobación; no puede cerrar gestiones operativas'' using errcode=''42501'';
  end if;',
    'if erp_supply.is_review_approval_only() then
    raise exception ''Gerencia y Jefatura Logística son perfiles de revisión y aprobación; no pueden cerrar gestiones operativas'' using errcode=''42501'';
  end if;'
  );
  execute v_def;
end
$migration$;
