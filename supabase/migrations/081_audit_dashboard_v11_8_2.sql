-- V11.8.2 · Backend de auditoría operativa enriquecida
create or replace function public.erp_x_audit_dashboard(p_filters jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'erp_supply','public','auth','pg_catalog'
as $$
declare
  v_org uuid:=erp_supply.current_org_id();
  v_profile uuid:=erp_supply.require_profile();
  v_search text:=nullif(trim(coalesce(p_filters->>'search','')),'');
  v_category text:=upper(coalesce(nullif(trim(coalesce(p_filters->>'category','')),''),'ALL'));
  v_step text:=upper(nullif(trim(coalesce(p_filters->>'step','')),''));
  v_priority text:=upper(nullif(trim(coalesce(p_filters->>'priority','')),''));
  v_client text:=nullif(trim(coalesce(p_filters->>'client','')),'');
  v_actor uuid;
  v_date_from date;
  v_date_to date;
  v_page integer:=greatest(coalesce((p_filters->>'page')::integer,1),1);
  v_size integer:=least(greatest(coalesce((p_filters->>'pageSize')::integer,50),1),100);
  v_total bigint:=0;
  v_items jsonb:='[]'::jsonb;
  v_summary jsonb:='{}'::jsonb;
  v_facets jsonb:='{}'::jsonb;
  v_insights jsonb:='{}'::jsonb;
begin
  if not erp_supply.can_access_module('audit','read') then raise exception 'No autorizado' using errcode='42501'; end if;
  if coalesce(p_filters->>'actorId','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then v_actor:=(p_filters->>'actorId')::uuid; end if;
  if coalesce(p_filters->>'dateFrom','') ~ '^\d{4}-\d{2}-\d{2}$' then v_date_from:=(p_filters->>'dateFrom')::date; end if;
  if coalesce(p_filters->>'dateTo','') ~ '^\d{4}-\d{2}-\d{2}$' then v_date_to:=(p_filters->>'dateTo')::date; end if;

  select count(*) into v_total
  from erp_supply.order_events e join erp_supply.orders o on o.id=e.order_id left join erp_supply.profiles p on p.id=e.actor_profile_id
  where e.organization_id=v_org and not o.is_test
    and (v_date_from is null or e.created_at>=v_date_from::timestamptz)
    and (v_date_to is null or e.created_at<(v_date_to+1)::timestamptz)
    and (v_step is null or coalesce(e.to_step_code,e.from_step_code,o.current_step_code)=v_step)
    and (v_actor is null or e.actor_profile_id=v_actor)
    and (v_priority is null or o.priority=v_priority)
    and (v_client is null or lower(o.client_name)=lower(v_client))
    and (v_category='ALL' or (v_category='CREATED' and e.event_type='ORDER_CREATED') or (v_category='FLOW' and e.event_type='WORKFLOW_ACTION') or (v_category='DECISIONS' and e.event_type='APPROVAL_DECISION') or (v_category='DOMAIN' and e.event_type in ('DOMAIN_RECORD','CHECKLIST_UPDATED')) or e.event_type=v_category)
    and (v_search is null or lower(concat_ws(' ',o.order_number,o.client_name,coalesce(p.display_name,''),coalesce(e.action_code,''),coalesce(e.event_type,''),coalesce(e.payload::text,''))) like '%'||lower(v_search)||'%');

  select coalesce(jsonb_agg(to_jsonb(x) order by x."createdAt" desc),'[]'::jsonb) into v_items from (
    select e.id::text id,e.order_id "orderId",o.order_number "orderNumber",o.client_name "clientName",o.priority,o.status "orderStatus",o.current_step_code "currentStep",e.task_id "taskId",e.event_type "eventType",e.action_code "actionCode",e.from_step_code "fromStep",e.to_step_code "toStep",e.from_status "fromStatus",e.to_status "toStatus",e.actor_profile_id "actorId",coalesce(p.display_name,'Sistema') actor,e.actor_role_code "actorRole",e.payload,e.created_at "createdAt",coalesce(t.business_seconds,t.raw_seconds,0)::bigint "durationSeconds",
      case when exists(select 1 from erp_supply.operational_alerts a where a.organization_id=v_org and a.order_id=o.id and a.status='OPEN' and a.alert_level>=3) then 'CRITICAL' when o.priority in ('URGENT','CRITICAL') or exists(select 1 from erp_supply.order_issues i where i.organization_id=v_org and i.order_id=o.id and i.status='OPEN' and i.blocking) then 'HIGH' when exists(select 1 from erp_supply.approval_requests ar where ar.organization_id=v_org and ar.order_id=o.id and ar.status='PENDING') then 'MEDIUM' else 'LOW' end "riskLevel",
      greatest((select count(*)::int from erp_supply.drive_files f where f.organization_id=v_org and f.order_id=o.id and (e.task_id is null or f.task_id is null or f.task_id=e.task_id)),case when nullif(e.payload->>'evidenceFileId','') is null then 0 else 1 end) "evidenceCount",
      coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'name',f.file_name,'category',f.file_category,'url',f.web_view_link,'createdAt',f.created_at) order by f.created_at desc) from (select df.* from erp_supply.drive_files df where df.organization_id=v_org and df.order_id=o.id and (e.task_id is null or df.task_id is null or df.task_id=e.task_id) order by df.created_at desc limit 3) f),'[]'::jsonb) "evidenceFiles",
      nullif(e.payload->>'requestId','') "approvalRef",nullif(e.payload->>'detail','') detail
    from erp_supply.order_events e join erp_supply.orders o on o.id=e.order_id left join erp_supply.profiles p on p.id=e.actor_profile_id left join erp_supply.order_tasks t on t.id=e.task_id
    where e.organization_id=v_org and not o.is_test
      and (v_date_from is null or e.created_at>=v_date_from::timestamptz) and (v_date_to is null or e.created_at<(v_date_to+1)::timestamptz)
      and (v_step is null or coalesce(e.to_step_code,e.from_step_code,o.current_step_code)=v_step) and (v_actor is null or e.actor_profile_id=v_actor) and (v_priority is null or o.priority=v_priority) and (v_client is null or lower(o.client_name)=lower(v_client))
      and (v_category='ALL' or (v_category='CREATED' and e.event_type='ORDER_CREATED') or (v_category='FLOW' and e.event_type='WORKFLOW_ACTION') or (v_category='DECISIONS' and e.event_type='APPROVAL_DECISION') or (v_category='DOMAIN' and e.event_type in ('DOMAIN_RECORD','CHECKLIST_UPDATED')) or e.event_type=v_category)
      and (v_search is null or lower(concat_ws(' ',o.order_number,o.client_name,coalesce(p.display_name,''),coalesce(e.action_code,''),coalesce(e.event_type,''),coalesce(e.payload::text,''))) like '%'||lower(v_search)||'%')
    order by e.created_at desc offset (v_page-1)*v_size limit v_size
  ) x;

  select jsonb_build_object(
    'auditedOrders',count(distinct e.order_id),'eventCount',count(*),'createdOrders',count(*) filter(where e.event_type='ORDER_CREATED'),'flowActions',count(*) filter(where e.event_type='WORKFLOW_ACTION'),'decisions',count(*) filter(where e.event_type='APPROVAL_DECISION'),'domainRecords',count(*) filter(where e.event_type in ('DOMAIN_RECORD','CHECKLIST_UPDATED')),
    'pendingApprovals',(select count(*) from erp_supply.approval_requests ar join erp_supply.orders ao on ao.id=ar.order_id where ar.organization_id=v_org and ar.status='PENDING' and not ao.is_test and (v_priority is null or ao.priority=v_priority) and (v_client is null or lower(ao.client_name)=lower(v_client))),
    'approvalTotal',(select count(*) from erp_supply.approval_requests ar join erp_supply.orders ao on ao.id=ar.order_id where ar.organization_id=v_org and not ao.is_test and (v_priority is null or ao.priority=v_priority) and (v_client is null or lower(ao.client_name)=lower(v_client))),
    'openIssues',(select count(*) from erp_supply.order_issues i join erp_supply.orders io on io.id=i.order_id where i.organization_id=v_org and i.status='OPEN' and not io.is_test and (v_priority is null or io.priority=v_priority) and (v_client is null or lower(io.client_name)=lower(v_client))),
    'criticalOrders',(select count(distinct co.id) from erp_supply.orders co where co.organization_id=v_org and not co.is_test and co.status not in ('CLOSED','CANCELLED') and ((co.priority in ('URGENT','CRITICAL')) or exists(select 1 from erp_supply.operational_alerts oa where oa.organization_id=v_org and oa.order_id=co.id and oa.status='OPEN' and oa.alert_level>=3)) and (v_priority is null or co.priority=v_priority) and (v_client is null or lower(co.client_name)=lower(v_client))),
    'avgStageSeconds',coalesce((select round(avg(coalesce(t.business_seconds,t.raw_seconds,0)))::bigint from erp_supply.order_tasks t join erp_supply.orders ot on ot.id=t.order_id where ot.organization_id=v_org and not ot.is_test and t.completed_at is not null and (v_date_from is null or t.completed_at>=v_date_from::timestamptz) and (v_date_to is null or t.completed_at<(v_date_to+1)::timestamptz) and (v_step is null or t.step_code=v_step) and (v_priority is null or ot.priority=v_priority) and (v_client is null or lower(ot.client_name)=lower(v_client))),0),
    'slaCompliance',(select case when count(*)=0 then null else round(100.0*count(*) filter(where so.closed_at<=so.promised_at)/count(*),1) end from erp_supply.orders so where so.organization_id=v_org and not so.is_test and so.closed_at is not null and so.promised_at is not null and (v_date_from is null or so.closed_at>=v_date_from::timestamptz) and (v_date_to is null or so.closed_at<(v_date_to+1)::timestamptz) and (v_priority is null or so.priority=v_priority) and (v_client is null or lower(so.client_name)=lower(v_client))),
    'tabCounts',jsonb_build_object('all',count(*),'created',count(*) filter(where e.event_type='ORDER_CREATED'),'flow',count(*) filter(where e.event_type='WORKFLOW_ACTION'),'decisions',count(*) filter(where e.event_type='APPROVAL_DECISION'),'incidents',(select count(*) from erp_supply.order_issues i join erp_supply.orders io on io.id=i.order_id where i.organization_id=v_org and not io.is_test and (v_date_from is null or i.created_at>=v_date_from::timestamptz) and (v_date_to is null or i.created_at<(v_date_to+1)::timestamptz)),'traceability',count(distinct e.order_id))
  ) into v_summary
  from erp_supply.order_events e join erp_supply.orders o on o.id=e.order_id left join erp_supply.profiles p on p.id=e.actor_profile_id
  where e.organization_id=v_org and not o.is_test and (v_date_from is null or e.created_at>=v_date_from::timestamptz) and (v_date_to is null or e.created_at<(v_date_to+1)::timestamptz) and (v_step is null or coalesce(e.to_step_code,e.from_step_code,o.current_step_code)=v_step) and (v_actor is null or e.actor_profile_id=v_actor) and (v_priority is null or o.priority=v_priority) and (v_client is null or lower(o.client_name)=lower(v_client)) and (v_search is null or lower(concat_ws(' ',o.order_number,o.client_name,coalesce(p.display_name,''),coalesce(e.action_code,''),coalesce(e.event_type,''),coalesce(e.payload::text,''))) like '%'||lower(v_search)||'%');

  select jsonb_build_object(
    'steps',coalesce((select jsonb_agg(jsonb_build_object('code',s.code,'label',s.name) order by s.sort_order) from erp_supply.workflow_steps s where s.active),'[]'::jsonb),
    'actors',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'name',x.display_name) order by x.display_name) from (select distinct p.id,p.display_name from erp_supply.order_events e join erp_supply.profiles p on p.id=e.actor_profile_id join erp_supply.orders o on o.id=e.order_id where e.organization_id=v_org and not o.is_test and p.active) x),'[]'::jsonb),
    'clients',coalesce((select jsonb_agg(x.client_name order by x.client_name) from (select distinct o.client_name from erp_supply.orders o where o.organization_id=v_org and not o.is_test and nullif(trim(o.client_name),'') is not null order by o.client_name limit 100) x),'[]'::jsonb)
  ) into v_facets;

  select jsonb_build_object(
    'bottlenecks',coalesce((select jsonb_agg(to_jsonb(b) order by b."avgSeconds" desc) from (select t.step_code "stepCode",round(avg(coalesce(t.business_seconds,t.raw_seconds,0)))::bigint "avgSeconds",count(*)::int samples from erp_supply.order_tasks t join erp_supply.orders o on o.id=t.order_id where o.organization_id=v_org and not o.is_test and t.completed_at is not null and (v_date_from is null or t.completed_at>=v_date_from::timestamptz) and (v_date_to is null or t.completed_at<(v_date_to+1)::timestamptz) group by t.step_code order by 2 desc limit 5) b),'[]'::jsonb),
    'topActors',coalesce((select jsonb_agg(to_jsonb(a) order by a.events desc) from (select coalesce(p.display_name,'Sistema') actor,e.actor_role_code "roleCode",count(*)::int events from erp_supply.order_events e join erp_supply.orders o on o.id=e.order_id left join erp_supply.profiles p on p.id=e.actor_profile_id where e.organization_id=v_org and not o.is_test and (v_date_from is null or e.created_at>=v_date_from::timestamptz) and (v_date_to is null or e.created_at<(v_date_to+1)::timestamptz) group by p.display_name,e.actor_role_code order by count(*) desc limit 5) a),'[]'::jsonb),
    'issueSeverity',coalesce((select jsonb_object_agg(s.severity,s.total) from (select coalesce(nullif(upper(a.severity),''),case when a.alert_level>=3 then 'CRITICAL' when a.alert_level=2 then 'HIGH' else 'MEDIUM' end) severity,count(*)::int total from erp_supply.operational_alerts a join erp_supply.orders o on o.id=a.order_id where a.organization_id=v_org and a.status='OPEN' and not o.is_test group by 1) s),'{}'::jsonb),
    'alerts',coalesce((select jsonb_agg(to_jsonb(a) order by a."createdAt" desc) from (select oa.id,oa.severity,oa.alert_level "level",oa.message,o.order_number "orderNumber",oa.created_at "createdAt" from erp_supply.operational_alerts oa join erp_supply.orders o on o.id=oa.order_id where oa.organization_id=v_org and oa.status='OPEN' and not o.is_test order by oa.alert_level desc,oa.created_at desc limit 5) a),'[]'::jsonb)
  ) into v_insights;

  return jsonb_build_object('items',v_items,'summary',v_summary,'facets',v_facets,'insights',v_insights,'pagination',jsonb_build_object('page',v_page,'pageSize',v_size,'totalItems',v_total,'totalPages',case when v_total=0 then 0 else ceil(v_total::numeric/v_size)::int end),'generatedAt',now(),'version','11.8.2');
end;
$$;

grant execute on function public.erp_x_audit_dashboard(jsonb) to authenticated;
revoke execute on function public.erp_x_audit_dashboard(jsonb) from public, anon;
