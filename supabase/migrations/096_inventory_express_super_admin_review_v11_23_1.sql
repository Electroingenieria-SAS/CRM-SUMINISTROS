-- V11.23.1 · Cola de revisión exclusiva de conteos exprés para Super Admin.
create or replace function public.erp_x_inventory_express_reports(p_status text default null, p_page integer default 1, p_page_size integer default 50)
returns jsonb
language plpgsql
stable security definer
set search_path=''
as $$
declare
  v_actor uuid:=erp_supply.require_profile();
  v_org uuid:=erp_supply.current_org_id();
  v_status text:=upper(trim(coalesce(p_status,'')));
  v_page integer:=greatest(coalesce(p_page,1),1);
  v_size integer:=least(greatest(coalesce(p_page_size,50),1),100);
  v_total bigint;
begin
  if not erp_supply.has_role('super_admin') then
    raise exception 'Conteo exprés disponible únicamente para Super Admin' using errcode='42501';
  end if;
  if v_status='PENDING' then v_status:='SUBMITTED'; end if;
  if v_status not in ('','ALL','SUBMITTED','APPLIED','RECOUNT_REQUIRED','REJECTED','CANCELLED') then v_status:=''; end if;

  select count(*) into v_total
  from erp_supply.inventory_count_reports r
  where r.organization_id=v_org
    and (r.plan_type='EXPRESS' or r.count_mode='EXPRESS')
    and (v_status in('','ALL') or r.status=v_status);

  return jsonb_build_object(
    'items',coalesce((
      select jsonb_agg(row_data order by submitted_at desc,id desc)
      from (
        select r.id,r.submitted_at,
          jsonb_build_object(
            'id',r.id,'reportCode',r.report_code,'status',r.status,'mode',r.count_mode,'planType',r.plan_type,
            'scheduledDate',r.scheduled_date,'submittedAt',r.submitted_at,'submittedBy',p.display_name,
            'submittedByEmail',p.email,'itemId',i.id,'reference',m.reference,'description',m.exact_name,'unit',m.unit,'itemType',i.item_type,
            'observations',r.observations,'systemSnapshot',r.system_snapshot,'comparison',r.comparison,
            'hasDifference',r.has_difference,'exactLots',r.exact_lots,'differenceLots',r.difference_lots,
            'absoluteDifference',r.absolute_difference,'estimatedValueImpact',r.estimated_value_impact,
            'reviewDecision',r.review_decision,'reviewNote',r.review_note,'reviewedAt',r.reviewed_at,'reviewedBy',rp.display_name,
            'appliedAt',r.applied_at,'recountOf',r.recount_of,'metadata',r.metadata
          ) row_data
        from erp_supply.inventory_count_reports r
        join erp_supply.inventory_items i on i.id=r.inventory_item_id
        join erp_supply.material_master m on m.id=r.material_master_id
        join erp_supply.profiles p on p.id=r.submitted_by
        left join erp_supply.profiles rp on rp.id=r.reviewed_by
        where r.organization_id=v_org
          and (r.plan_type='EXPRESS' or r.count_mode='EXPRESS')
          and (v_status in('','ALL') or r.status=v_status)
        order by r.submitted_at desc,r.id desc
        offset (v_page-1)*v_size limit v_size
      ) q
    ),'[]'::jsonb),
    'pagination',jsonb_build_object('page',v_page,'pageSize',v_size,'totalItems',v_total,'totalPages',case when v_total=0 then 0 else ceil(v_total::numeric/v_size)::integer end),
    'access',jsonb_build_object('controller',true,'canApprove',true,'superAdminOnly',true),
    'scope','EXPRESS',
    'version','11.23.1'
  );
end;
$$;
revoke all on function public.erp_x_inventory_express_reports(text,integer,integer) from public,anon;
grant execute on function public.erp_x_inventory_express_reports(text,integer,integer) to authenticated;
