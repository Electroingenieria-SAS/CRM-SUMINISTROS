create or replace function erp_supply.inventory_count_schedule_core(p_day date)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_org uuid:=erp_supply.current_org_id();
  v_tz text:='America/Bogota';
  v_day date;
  v_engine jsonb;
  v_target integer:=0;
  v_done integer:=0;
  v_remaining integer:=0;
  v_submitted integer:=0;
  v_applied integer:=0;
  v_recounts integer:=0;
  v_plan jsonb:='[]'::jsonb;
begin
  select coalesce(o.timezone,'America/Bogota') into v_tz from erp_supply.organizations o where o.id=v_org;
  v_day:=coalesce(p_day,(now() at time zone v_tz)::date);
  v_engine:=public.erp_x_inventory_count_plan(v_day);
  v_target:=coalesce((v_engine#>>'{summary,targetToday}')::integer,0);

  select count(distinct r.inventory_item_id)::integer,
         count(*) filter(where r.status='SUBMITTED')::integer,
         count(*) filter(where r.status='APPLIED')::integer
    into v_done,v_submitted,v_applied
  from erp_supply.inventory_count_reports r
  where r.organization_id=v_org
    and r.scheduled_date=v_day
    and r.status in('SUBMITTED','APPLIED','RECOUNT_REQUIRED');

  select count(*)::integer into v_recounts
  from erp_supply.inventory_count_reports r
  where r.organization_id=v_org and r.status='RECOUNT_REQUIRED';

  v_remaining:=greatest(v_target-coalesce(v_done,0),0);

  select coalesce(jsonb_agg(x.elem order by x.ord),'[]'::jsonb) into v_plan
  from jsonb_array_elements(coalesce(v_engine->'plan','[]'::jsonb)) with ordinality x(elem,ord)
  where x.ord<=v_remaining;

  return v_engine || jsonb_build_object(
    'plan',v_plan,
    'summary',coalesce(v_engine->'summary','{}'::jsonb)||jsonb_build_object(
      'countedToday',coalesce(v_done,0),
      'remainingToday',v_remaining,
      'submittedToday',coalesce(v_submitted,0),
      'appliedToday',coalesce(v_applied,0),
      'recountPending',coalesce(v_recounts,0)
    ),
    'scheduleVersion','11.23.2'
  );
end;
$$;

revoke all on function erp_supply.inventory_count_schedule_core(date) from public,anon,authenticated;

do $$
declare v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='erp_x_inventory_count_center' and pg_get_function_identity_arguments(p.oid)='p_day date';
  v_def:=replace(v_def,'v_engine:=public.erp_x_inventory_count_plan(v_day);','v_engine:=erp_supply.inventory_count_schedule_core(v_day);');
  if position('''plan'',v_engine->''plan''' in v_def)=0 then
    v_def:=replace(v_def,'''summary'',v_engine->''summary'',','''summary'',v_engine->''summary'',''plan'',v_engine->''plan'',');
  end if;
  execute v_def;
end $$;