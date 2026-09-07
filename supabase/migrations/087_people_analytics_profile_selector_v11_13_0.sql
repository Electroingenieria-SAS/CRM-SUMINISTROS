-- CRM Suministros · V11.13.0
-- Conserva la lista de perfiles autorizados al filtrar un usuario individual.

alter function public.erp_x_vsm_people(date,date,uuid)
  rename to erp_x_vsm_people_core_v11130;

revoke execute on function public.erp_x_vsm_people_core_v11130(date,date,uuid) from public,anon,authenticated;

create or replace function public.erp_x_vsm_people(
  p_date_from date default current_date-30,
  p_date_to date default current_date,
  p_profile_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_actor uuid := erp_supply.require_profile();
  v_org uuid := erp_supply.current_org_id();
  v_result jsonb;
  v_profiles jsonb;
begin
  v_result := public.erp_x_vsm_people_core_v11130(p_date_from,p_date_to,p_profile_id);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',p.id,
      'name',p.display_name,
      'roles',coalesce(array(
        select pr.role_code from erp_supply.profile_roles pr
        where pr.profile_id=p.id order by pr.role_code
      ),'{}'::text[])
    ) order by p.display_name
  ),'[]'::jsonb)
  into v_profiles
  from erp_supply.profiles p
  where p.organization_id=v_org
    and p.active
    and not p.is_system
    and(
      p.id=v_actor
      or erp_supply.has_role('super_admin')
      or erp_supply.has_role('auditoria')
      or erp_supply.can_manage_work_profile(p.id,'ACTIVITY')
      or erp_supply.can_manage_work_profile(p.id,'DELIVERABLE')
    );

  return jsonb_set(v_result,'{profiles}',v_profiles,true);
end;
$$;

revoke execute on function public.erp_x_vsm_people(date,date,uuid) from public,anon;
grant execute on function public.erp_x_vsm_people(date,date,uuid) to authenticated;
