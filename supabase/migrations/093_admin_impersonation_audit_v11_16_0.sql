-- CRM Suministros V11.16.0
-- Auditoría explícita para sesiones temporales de verificación iniciadas por Super Admin.

create or replace function public.erp_x_admin_auth_audit(
  p_profile_id uuid,
  p_action text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = 'erp_supply', 'public', 'auth', 'pg_catalog'
as $$
declare
  v_actor uuid:=erp_supply.require_profile();
  v_org uuid:=erp_supply.current_org_id();
  v_action text:=upper(trim(coalesce(p_action,'')));
begin
  if not erp_supply.has_role('super_admin') then
    raise exception 'Solo Super Admin puede registrar acciones de cuentas' using errcode='42501';
  end if;
  if v_action not in(
    'AUTH_USER_CREATED','AUTH_USER_UPDATED','AUTH_PASSWORD_CHANGED',
    'AUTH_USER_ENABLED','AUTH_USER_DISABLED','AUTH_USER_DELETED',
    'AUTH_IMPERSONATION_STARTED'
  ) then raise exception 'Acción administrativa inválida'; end if;
  if p_profile_id is null or not exists(
    select 1 from erp_supply.profiles p where p.id=p_profile_id and p.organization_id=v_org
  ) then raise exception 'Perfil objetivo no disponible'; end if;

  insert into erp_supply.system_audit(
    organization_id,actor_profile_id,action,entity_type,entity_id,before_data,after_data,metadata
  ) values(
    v_org,v_actor,v_action,'AUTH_USER',p_profile_id::text,null,null,
    coalesce(p_metadata,'{}'::jsonb)||jsonb_build_object('version','11.16.0','source','SUPER_ADMIN_CONSOLE')
  );
  return jsonb_build_object('success',true);
end;
$$;

revoke all on function public.erp_x_admin_auth_audit(uuid,text,jsonb) from public;
revoke execute on function public.erp_x_admin_auth_audit(uuid,text,jsonb) from anon;
grant execute on function public.erp_x_admin_auth_audit(uuid,text,jsonb) to authenticated;
grant execute on function public.erp_x_admin_auth_audit(uuid,text,jsonb) to service_role;
