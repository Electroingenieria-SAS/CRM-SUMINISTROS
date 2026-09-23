-- CRM Suministros V11.34.3
-- Restaura taxonomía de catálogo en Mi jornada sin reintroducir métricas históricas costosas.
begin;

create or replace function public.erp_x_work_catalog()
returns jsonb
language plpgsql
stable
security definer
set search_path=erp_supply,public,auth,pg_catalog
as $work_catalog_taxonomy$
declare
  v_actor uuid:=erp_supply.require_profile();
  v_org uuid:=erp_supply.current_org_id();
begin
  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x."uiCategoryLabel",x."uiSubcategory",x."sortOrder",x.name)
    from(
      select
        c.id,
        c.code,
        c.name,
        c.description,
        c.activity_group "activityGroup",
        c.activity_kind "activityKind",
        c.standard_minutes "standardMinutes",
        c.evidence_policy "evidencePolicy",
        c.acceptance_required "acceptanceRequired",
        c.team_allowed "teamAllowed",
        c.sort_order "sortOrder",
        coalesce(nullif(c.metadata->>'uiCategory',''),c.activity_group) "uiCategory",
        coalesce(nullif(c.metadata->>'uiCategoryLabel',''),initcap(replace(coalesce(c.metadata->>'uiCategory',c.activity_group),'_',' '))) "uiCategoryLabel",
        coalesce(nullif(c.metadata->>'uiSubcategory',''),'Otras actividades') "uiSubcategory",
        nullif(c.metadata->>'procedureHint','') "procedureHint",
        nullif(c.metadata->>'evidenceHint','') "evidenceHint",
        0::integer samples,
        null::numeric "medianMinutes",
        null::numeric "p80Minutes"
      from erp_supply.work_activity_catalog c
      where c.organization_id=v_org
        and c.active
        and (
          erp_supply.work_catalog_allowed(c.id,v_actor)
          or erp_supply.has_role('super_admin')
          or (erp_supply.has_role('gerencia') and c.activity_kind='DELIVERABLE')
          or (erp_supply.has_role('jefe_logistica') and c.activity_kind='ACTIVITY' and c.activity_group in('LOGISTICS','IMPROVEMENT','GENERAL'))
        )
    ) x
  ),'[]'::jsonb);
end;
$work_catalog_taxonomy$;

revoke all on function public.erp_x_work_catalog() from public,anon;
grant execute on function public.erp_x_work_catalog() to authenticated;

notify pgrst,'reload schema';
commit;
