-- CRM Suministros · V11.14.0
-- Explorador semántico, exportación detallada y vistas guardadas.

create or replace function erp_supply.reports_explore_core(p_payload jsonb)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
  v_actor uuid := erp_supply.require_profile();
  v_org uuid := erp_supply.current_org_id();
  v_tz text := coalesce((select o.timezone from erp_supply.organizations o where o.id=v_org),'America/Bogota');
  v_dataset text := lower(coalesce(p_payload->>'dataset','orders'));
  v_dimension text := lower(coalesce(p_payload->>'dimension','status'));
  v_metric text := lower(coalesce(p_payload->>'metric','count'));
  v_from date := coalesce((p_payload->>'from')::date,current_date-29);
  v_to date := coalesce((p_payload->>'to')::date,current_date);
  v_limit integer := greatest(1,least(coalesce((p_payload->>'limit')::integer,50),500));
  v_start timestamptz; v_end timestamptz; v_rows jsonb := '[]'::jsonb; v_catalog jsonb;
begin
  if not erp_supply.can_access_module('reports','read') then raise exception 'No autorizado para consultar Analítica y reportes' using errcode='42501'; end if;
  if v_from>v_to or (v_to-v_from)>366 then raise exception 'Rango de fechas inválido'; end if;
  v_start:=(v_from::timestamp at time zone v_tz); v_end:=((v_to+1)::timestamp at time zone v_tz);
  v_catalog:=jsonb_build_object(
    'orders',jsonb_build_object('dimensions',jsonb_build_array('status','step','route','type','city','seller','client','priority','day'),'metrics',jsonb_build_array('count','closed','invoice_amount','avg_cycle_hours')),
    'tasks',jsonb_build_object('dimensions',jsonb_build_array('step','status','assignee','day'),'metrics',jsonb_build_array('count','completed','avg_hours','p90_hours','business_hours')),
    'invoices',jsonb_build_object('dimensions',jsonb_build_array('status','currency','seller','client','day'),'metrics',jsonb_build_array('count','amount','avg_amount')),
    'deliveries',jsonb_build_object('dimensions',jsonb_build_array('route','carrier','status','day'),'metrics',jsonb_build_array('count','delivered','cost','avg_transit_hours')),
    'inventory',jsonb_build_object('dimensions',jsonb_build_array('reference','location','warehouse','item_type'),'metrics',jsonb_build_array('available','reserved','blocked','lots')),
    'people',jsonb_build_object('dimensions',jsonb_build_array('person'),'metrics',jsonb_build_array('session_hours','sessions','tasks','completed_tasks','work_hours','paused_hours')),
    'issues',jsonb_build_object('dimensions',jsonb_build_array('type','source','status','resolution','day'),'metrics',jsonb_build_array('count','resolved','avg_resolution_hours')),
    'approvals',jsonb_build_object('dimensions',jsonb_build_array('type','status','role','day'),'metrics',jsonb_build_array('count','approved','avg_decision_hours'))
  );
  if not (v_catalog ? v_dataset) then raise exception 'Dataset no permitido'; end if;
  if not ((v_catalog->v_dataset->'dimensions') ? v_dimension) then raise exception 'Dimensión no permitida para el dataset'; end if;
  if not ((v_catalog->v_dataset->'metrics') ? v_metric) then raise exception 'Métrica no permitida para el dataset'; end if;

  if v_dataset='orders' then
    with base as (
      select o.*,p.display_name seller_name,(select coalesce(sum(i.amount),0) from erp_supply.invoices i where i.order_id=o.id) invoice_amount,
        case when o.closed_at is not null then erp_supply.business_seconds_between(v_org,o.created_at,o.closed_at) end cycle_seconds
      from erp_supply.orders o left join erp_supply.profiles p on p.id=o.seller_profile_id
      where o.organization_id=v_org and not coalesce(o.is_test,false) and o.created_at>=v_start and o.created_at<v_end
    ), grouped as (
      select case v_dimension when 'status' then coalesce(status,'SIN_ESTADO') when 'step' then coalesce(current_step_code,'SIN_ETAPA') when 'route' then coalesce(delivery_route_code,'SIN_RUTA') when 'type' then coalesce(order_type_code,'SIN_TIPO') when 'city' then coalesce(nullif(trim(client_city),''),'SIN_CIUDAD') when 'seller' then coalesce(seller_name,'SIN_ASESOR') when 'client' then coalesce(nullif(trim(client_name),''),'SIN_CLIENTE') when 'priority' then coalesce(priority,'SIN_PRIORIDAD') when 'day' then to_char(created_at at time zone v_tz,'YYYY-MM-DD') end label,
      case v_metric when 'count' then count(*)::numeric when 'closed' then count(*) filter(where status='CLOSED')::numeric when 'invoice_amount' then coalesce(sum(invoice_amount),0)::numeric when 'avg_cycle_hours' then coalesce(avg(cycle_seconds)/3600.0,0)::numeric end value,count(*) records from base group by 1
    )
    select coalesce(jsonb_agg(jsonb_build_object('label',label,'value',value,'records',records) order by value desc nulls last) filter(where label is not null),'[]'::jsonb) into v_rows from (select * from grouped order by value desc nulls last limit v_limit) q;
  elsif v_dataset='tasks' then
    with base as (
      select t.*,p.display_name assignee_name from erp_supply.order_tasks t join erp_supply.orders o on o.id=t.order_id left join erp_supply.profiles p on p.id=t.assigned_profile_id
      where o.organization_id=v_org and not coalesce(o.is_test,false) and t.created_at>=v_start and t.created_at<v_end
    ), grouped as (
      select case v_dimension when 'step' then coalesce(step_code,'SIN_ETAPA') when 'status' then coalesce(status,'SIN_ESTADO') when 'assignee' then coalesce(assignee_name,'SIN_ASIGNAR') when 'day' then to_char(created_at at time zone v_tz,'YYYY-MM-DD') end label,
      case v_metric when 'count' then count(*)::numeric when 'completed' then count(*) filter(where completed_at is not null or status='COMPLETED')::numeric when 'avg_hours' then coalesce(avg(coalesce(business_seconds,0))/3600.0,0)::numeric when 'p90_hours' then coalesce(percentile_cont(0.9) within group(order by coalesce(business_seconds,0))/3600.0,0)::numeric when 'business_hours' then coalesce(sum(coalesce(business_seconds,0))/3600.0,0)::numeric end value,count(*) records from base group by 1
    )
    select coalesce(jsonb_agg(jsonb_build_object('label',label,'value',value,'records',records) order by value desc nulls last) filter(where label is not null),'[]'::jsonb) into v_rows from (select * from grouped order by value desc nulls last limit v_limit) q;
  elsif v_dataset='invoices' then
    with base as (
      select i.*,o.client_name,p.display_name seller_name from erp_supply.invoices i join erp_supply.orders o on o.id=i.order_id left join erp_supply.profiles p on p.id=o.seller_profile_id
      where o.organization_id=v_org and not coalesce(o.is_test,false) and i.created_at>=v_start and i.created_at<v_end
    ), grouped as (
      select case v_dimension when 'status' then coalesce(status,'SIN_ESTADO') when 'currency' then coalesce(currency,'SIN_MONEDA') when 'seller' then coalesce(seller_name,'SIN_ASESOR') when 'client' then coalesce(nullif(trim(client_name),''),'SIN_CLIENTE') when 'day' then to_char(created_at at time zone v_tz,'YYYY-MM-DD') end label,
      case v_metric when 'count' then count(*)::numeric when 'amount' then coalesce(sum(amount),0)::numeric when 'avg_amount' then coalesce(avg(amount),0)::numeric end value,count(*) records from base group by 1
    )
    select coalesce(jsonb_agg(jsonb_build_object('label',label,'value',value,'records',records) order by value desc nulls last) filter(where label is not null),'[]'::jsonb) into v_rows from (select * from grouped order by value desc nulls last limit v_limit) q;
  elsif v_dataset='deliveries' then
    with base as (
      select d.* from erp_supply.deliveries d join erp_supply.orders o on o.id=d.order_id where o.organization_id=v_org and not coalesce(o.is_test,false) and d.created_at>=v_start and d.created_at<v_end
    ), grouped as (
      select case v_dimension when 'route' then coalesce(route_code,'SIN_RUTA') when 'carrier' then coalesce(nullif(trim(carrier),''),'SIN_TRANSPORTADORA') when 'status' then coalesce(status,'SIN_ESTADO') when 'day' then to_char(created_at at time zone v_tz,'YYYY-MM-DD') end label,
      case v_metric when 'count' then count(*)::numeric when 'delivered' then count(*) filter(where delivered_at is not null or status='DELIVERED')::numeric when 'cost' then coalesce(sum(carrier_cost),0)::numeric when 'avg_transit_hours' then coalesce(avg(case when dispatched_at is not null and delivered_at is not null then extract(epoch from(delivered_at-dispatched_at)) end)/3600.0,0)::numeric end value,count(*) records from base group by 1
    )
    select coalesce(jsonb_agg(jsonb_build_object('label',label,'value',value,'records',records) order by value desc nulls last) filter(where label is not null),'[]'::jsonb) into v_rows from (select * from grouped order by value desc nulls last limit v_limit) q;
  elsif v_dataset='inventory' then
    with base as (
      select i.reference,i.sku,i.item_type,l.location,l.warehouse_code,l.quantity_available,l.quantity_reserved,l.quantity_blocked,l.id lot_id from erp_supply.inventory_items i left join erp_supply.inventory_lots l on l.inventory_item_id=i.id where i.organization_id=v_org and i.active
    ), grouped as (
      select case v_dimension when 'reference' then coalesce(reference,sku,'SIN_REFERENCIA') when 'location' then coalesce(location,'SIN_UBICACION') when 'warehouse' then coalesce(warehouse_code,'SIN_BODEGA') when 'item_type' then coalesce(item_type,'SIN_TIPO') end label,
      case v_metric when 'available' then coalesce(sum(quantity_available),0)::numeric when 'reserved' then coalesce(sum(quantity_reserved),0)::numeric when 'blocked' then coalesce(sum(quantity_blocked),0)::numeric when 'lots' then count(lot_id)::numeric end value,count(*) records from base group by 1
    )
    select coalesce(jsonb_agg(jsonb_build_object('label',label,'value',value,'records',records) order by value desc nulls last) filter(where label is not null),'[]'::jsonb) into v_rows from (select * from grouped order by value desc nulls last limit v_limit) q;
  elsif v_dataset='people' then
    with people as (select p.id,p.display_name from erp_supply.profiles p where p.organization_id=v_org and p.active and not p.is_system),
    sessions as (select s.profile_id,count(*) sessions,coalesce(sum(coalesce(s.business_seconds,erp_supply.business_seconds_between(v_org,s.started_at,coalesce(s.ended_at,v_end)))),0) seconds from erp_supply.task_sessions s join erp_supply.order_tasks t on t.id=s.task_id join erp_supply.orders o on o.id=t.order_id where o.organization_id=v_org and not coalesce(o.is_test,false) and s.started_at>=v_start and s.started_at<v_end group by s.profile_id),
    tasks as (select t.assigned_profile_id profile_id,count(*) tasks,count(*) filter(where t.completed_at is not null or t.status='COMPLETED') completed from erp_supply.order_tasks t join erp_supply.orders o on o.id=t.order_id where o.organization_id=v_org and not coalesce(o.is_test,false) and t.created_at>=v_start and t.created_at<v_end group by t.assigned_profile_id),
    work as (select w.profile_id,count(*) executions,coalesce(sum(coalesce(w.active_seconds,w.business_seconds,0)),0) active_seconds,coalesce(sum(coalesce(w.paused_seconds,0)),0) paused_seconds from erp_supply.work_executions w where w.organization_id=v_org and w.started_at>=v_start and w.started_at<v_end group by w.profile_id),
    scored as (select p.display_name label,case v_metric when 'session_hours' then coalesce(s.seconds,0)/3600.0 when 'sessions' then coalesce(s.sessions,0) when 'tasks' then coalesce(t.tasks,0) when 'completed_tasks' then coalesce(t.completed,0) when 'work_hours' then coalesce(w.active_seconds,0)/3600.0 when 'paused_hours' then coalesce(w.paused_seconds,0)/3600.0 end value,coalesce(s.sessions,0)+coalesce(w.executions,0) records from people p left join sessions s on s.profile_id=p.id left join tasks t on t.profile_id=p.id left join work w on w.profile_id=p.id)
    select coalesce(jsonb_agg(jsonb_build_object('label',label,'value',value,'records',records) order by value desc),'[]'::jsonb) into v_rows from (select * from scored order by value desc limit v_limit) q;
  elsif v_dataset='issues' then
    with base as (select * from erp_supply.order_issues where organization_id=v_org and created_at>=v_start and created_at<v_end), grouped as (
      select case v_dimension when 'type' then coalesce(issue_type,'SIN_TIPO') when 'source' then coalesce(source_code,'SIN_ORIGEN') when 'status' then coalesce(status,'SIN_ESTADO') when 'resolution' then coalesce(resolution_code,'SIN_RESOLUCION') when 'day' then to_char(created_at at time zone v_tz,'YYYY-MM-DD') end label,
      case v_metric when 'count' then count(*)::numeric when 'resolved' then count(*) filter(where resolved_at is not null or status in ('RESOLVED','CLOSED'))::numeric when 'avg_resolution_hours' then coalesce(avg(case when resolved_at is not null then extract(epoch from(resolved_at-created_at)) end)/3600.0,0)::numeric end value,count(*) records from base group by 1)
    select coalesce(jsonb_agg(jsonb_build_object('label',label,'value',value,'records',records) order by value desc nulls last) filter(where label is not null),'[]'::jsonb) into v_rows from (select * from grouped order by value desc nulls last limit v_limit) q;
  elsif v_dataset='approvals' then
    with base as (select * from erp_supply.approval_requests where organization_id=v_org and created_at>=v_start and created_at<v_end), grouped as (
      select case v_dimension when 'type' then coalesce(request_type,'SIN_TIPO') when 'status' then coalesce(status,'SIN_ESTADO') when 'role' then coalesce(assigned_role_code,'SIN_ROL') when 'day' then to_char(created_at at time zone v_tz,'YYYY-MM-DD') end label,
      case v_metric when 'count' then count(*)::numeric when 'approved' then count(*) filter(where status='APPROVED')::numeric when 'avg_decision_hours' then coalesce(avg(case when decided_at is not null then extract(epoch from(decided_at-created_at)) end)/3600.0,0)::numeric end value,count(*) records from base group by 1)
    select coalesce(jsonb_agg(jsonb_build_object('label',label,'value',value,'records',records) order by value desc nulls last) filter(where label is not null),'[]'::jsonb) into v_rows from (select * from grouped order by value desc nulls last limit v_limit) q;
  end if;
  return jsonb_build_object('dataset',v_dataset,'dimension',v_dimension,'metric',v_metric,'from',v_from,'to',v_to,'rows',v_rows,'catalog',v_catalog);
end; $$;
revoke execute on function erp_supply.reports_explore_core(jsonb) from public,anon;
grant execute on function erp_supply.reports_explore_core(jsonb) to authenticated;
create or replace function public.erp_x_reports_explore(p_payload jsonb default '{}'::jsonb) returns jsonb language sql stable security invoker set search_path='' as $$ select erp_supply.reports_explore_core(coalesce(p_payload,'{}'::jsonb)); $$;
revoke execute on function public.erp_x_reports_explore(jsonb) from public,anon;
grant execute on function public.erp_x_reports_explore(jsonb) to authenticated;

create or replace function erp_supply.reports_export_core(p_payload jsonb)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
  v_actor uuid := erp_supply.require_profile(); v_org uuid := erp_supply.current_org_id();
  v_dataset text:=lower(coalesce(p_payload->>'dataset','orders')); v_from date:=coalesce((p_payload->>'from')::date,current_date-29); v_to date:=coalesce((p_payload->>'to')::date,current_date); v_limit integer:=greatest(1,least(coalesce((p_payload->>'limit')::integer,5000),5000)); v_start timestamptz; v_end timestamptz; v_rows jsonb:='[]'::jsonb;
begin
  if not erp_supply.can_access_module('reports','read') then raise exception 'No autorizado para exportar Analítica y reportes' using errcode='42501'; end if;
  if v_from>v_to or (v_to-v_from)>366 then raise exception 'Rango de fechas inválido'; end if;
  v_start:=(v_from::timestamp at time zone coalesce((select o.timezone from erp_supply.organizations o where o.id=v_org),'America/Bogota')); v_end:=((v_to+1)::timestamp at time zone coalesce((select o.timezone from erp_supply.organizations o where o.id=v_org),'America/Bogota'));
  if v_dataset='orders' then
    select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc),'[]'::jsonb) into v_rows from (select o.order_number,o.external_reference,o.order_type_code,o.payment_condition_code,o.delivery_route_code,o.client_name,o.client_document,o.client_city,p.display_name seller,o.current_step_code,o.status,o.priority,o.requires_cut,o.requires_purchase,o.promised_at,o.requested_delivery_date,o.source,o.created_at,o.closed_at,(select coalesce(sum(i.amount),0) from erp_supply.invoices i where i.order_id=o.id) invoiced_amount,(select count(*) from erp_supply.order_items oi where oi.order_id=o.id) item_lines,(select count(*) from erp_supply.order_tasks ot where ot.order_id=o.id) tasks from erp_supply.orders o left join erp_supply.profiles p on p.id=o.seller_profile_id where o.organization_id=v_org and not coalesce(o.is_test,false) and o.created_at>=v_start and o.created_at<v_end order by o.created_at desc limit v_limit) q;
  elsif v_dataset='tasks' then
    select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc),'[]'::jsonb) into v_rows from (select o.order_number,t.step_code,t.queue_code,t.status,p.display_name assignee,t.assigned_role_code,t.assigned_at,t.started_at,t.completed_at,t.blocked_at,t.raw_seconds,t.business_seconds,t.result_code,t.created_at from erp_supply.order_tasks t join erp_supply.orders o on o.id=t.order_id left join erp_supply.profiles p on p.id=t.assigned_profile_id where o.organization_id=v_org and not coalesce(o.is_test,false) and t.created_at>=v_start and t.created_at<v_end order by t.created_at desc limit v_limit) q;
  elsif v_dataset='invoices' then
    select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc),'[]'::jsonb) into v_rows from (select o.order_number,o.client_name,i.invoice_number,i.invoice_date,i.amount,i.currency,i.status,i.package_weight_kg,i.package_quantity,i.weight_per_unit_kg,p.display_name registered_by,i.created_at from erp_supply.invoices i join erp_supply.orders o on o.id=i.order_id left join erp_supply.profiles p on p.id=i.registered_by where o.organization_id=v_org and not coalesce(o.is_test,false) and i.created_at>=v_start and i.created_at<v_end order by i.created_at desc limit v_limit) q;
  elsif v_dataset='deliveries' then
    select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc),'[]'::jsonb) into v_rows from (select o.order_number,o.client_name,d.route_code,d.status,d.scheduled_at,d.dispatched_at,d.delivered_at,d.received_by,d.no_delivery_reason,d.carrier,d.tracking_number,d.carrier_invoice_number,d.carrier_cost,d.carrier_cost_currency,p.display_name assigned_to,d.created_at from erp_supply.deliveries d join erp_supply.orders o on o.id=d.order_id left join erp_supply.profiles p on p.id=d.assigned_profile_id where o.organization_id=v_org and not coalesce(o.is_test,false) and d.created_at>=v_start and d.created_at<v_end order by d.created_at desc limit v_limit) q;
  elsif v_dataset='inventory' then
    select coalesce(jsonb_agg(to_jsonb(q) order by q.reference,q.location),'[]'::jsonb) into v_rows from (select coalesce(i.reference,i.sku) reference,i.description,i.unit,i.item_type,l.lot_number,l.serial_number,l.location,l.warehouse_code,l.quantity_available,l.quantity_reserved,l.quantity_blocked,l.received_at,l.expires_at,l.source_system from erp_supply.inventory_items i left join erp_supply.inventory_lots l on l.inventory_item_id=i.id where i.organization_id=v_org and i.active order by coalesce(i.reference,i.sku),l.location limit v_limit) q;
  elsif v_dataset='issues' then
    select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc),'[]'::jsonb) into v_rows from (select o.order_number,i.issue_type,i.source_code,i.title,i.detail,i.status,i.blocking,i.target_role_code,i.resolution,i.resolution_code,cp.display_name created_by,rp.display_name resolved_by,i.created_at,i.resolved_at from erp_supply.order_issues i left join erp_supply.orders o on o.id=i.order_id left join erp_supply.profiles cp on cp.id=i.created_by left join erp_supply.profiles rp on rp.id=i.resolved_by where i.organization_id=v_org and i.created_at>=v_start and i.created_at<v_end order by i.created_at desc limit v_limit) q;
  elsif v_dataset='approvals' then
    select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc),'[]'::jsonb) into v_rows from (select o.order_number,a.request_type,a.status,a.assigned_role_code,r.display_name requested_by,d.display_name decided_by,a.reason,a.decision_reason,a.created_at,a.decided_at,a.executed_at from erp_supply.approval_requests a left join erp_supply.orders o on o.id=a.order_id left join erp_supply.profiles r on r.id=a.requested_by left join erp_supply.profiles d on d.id=a.decided_by where a.organization_id=v_org and a.created_at>=v_start and a.created_at<v_end order by a.created_at desc limit v_limit) q;
  elsif v_dataset='people' then
    select coalesce(jsonb_agg(to_jsonb(q) order by q.started_at desc),'[]'::jsonb) into v_rows from (select p.display_name person,w.source,w.status,w.title_snapshot,w.started_at,w.ended_at,w.elapsed_seconds,w.active_seconds,w.business_seconds,w.paused_seconds,w.start_delay_seconds,w.deviation_ratio,w.deviation_reason,w.result_note from erp_supply.work_executions w join erp_supply.profiles p on p.id=w.profile_id where w.organization_id=v_org and w.started_at>=v_start and w.started_at<v_end order by w.started_at desc limit v_limit) q;
  else raise exception 'Dataset no permitido para exportación'; end if;
  return jsonb_build_object('dataset',v_dataset,'from',v_from,'to',v_to,'rows',v_rows,'rowCount',jsonb_array_length(v_rows));
end; $$;
revoke execute on function erp_supply.reports_export_core(jsonb) from public,anon;
grant execute on function erp_supply.reports_export_core(jsonb) to authenticated;
create or replace function public.erp_x_reports_export(p_payload jsonb default '{}'::jsonb) returns jsonb language sql stable security invoker set search_path='' as $$ select erp_supply.reports_export_core(coalesce(p_payload,'{}'::jsonb)); $$;
revoke execute on function public.erp_x_reports_export(jsonb) from public,anon;
grant execute on function public.erp_x_reports_export(jsonb) to authenticated;

create or replace function erp_supply.reports_views_core(p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=erp_supply.require_profile(); v_org uuid:=erp_supply.current_org_id(); v_action text:=upper(coalesce(p_action,'LIST')); v_id uuid; v_row erp_supply.report_saved_views%rowtype;
begin
  if not erp_supply.can_access_module('reports','read') then raise exception 'No autorizado para administrar vistas de reportes' using errcode='42501'; end if;
  if v_action='LIST' then
    return coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'name',v.name,'description',v.description,'config',v.config,'isShared',v.is_shared,'ownerProfileId',v.owner_profile_id,'ownerName',p.display_name,'createdAt',v.created_at,'updatedAt',v.updated_at,'canEdit',(v.owner_profile_id=v_actor or erp_supply.has_role('super_admin'))) order by v.updated_at desc) from erp_supply.report_saved_views v join erp_supply.profiles p on p.id=v.owner_profile_id where v.organization_id=v_org and (v.owner_profile_id=v_actor or v.is_shared)),'[]'::jsonb);
  elsif v_action='SAVE' then
    if nullif(trim(p_payload->>'name'),'') is null then raise exception 'El nombre de la vista es obligatorio'; end if;
    if p_payload?'id' and nullif(p_payload->>'id','') is not null then
      v_id:=(p_payload->>'id')::uuid;
      update erp_supply.report_saved_views set name=trim(p_payload->>'name'),description=nullif(trim(p_payload->>'description'),''),config=coalesce(p_payload->'config','{}'::jsonb),is_shared=coalesce((p_payload->>'isShared')::boolean,false),updated_at=now() where id=v_id and organization_id=v_org and (owner_profile_id=v_actor or erp_supply.has_role('super_admin')) returning * into v_row;
      if v_row.id is null then raise exception 'Vista no encontrada o sin permiso de edición'; end if;
    else
      insert into erp_supply.report_saved_views(organization_id,owner_profile_id,name,description,config,is_shared) values(v_org,v_actor,trim(p_payload->>'name'),nullif(trim(p_payload->>'description'),''),coalesce(p_payload->'config','{}'::jsonb),coalesce((p_payload->>'isShared')::boolean,false)) returning * into v_row;
    end if;
    return jsonb_build_object('id',v_row.id,'name',v_row.name,'updatedAt',v_row.updated_at);
  elsif v_action='DELETE' then
    v_id:=(p_payload->>'id')::uuid; delete from erp_supply.report_saved_views where id=v_id and organization_id=v_org and (owner_profile_id=v_actor or erp_supply.has_role('super_admin')); return jsonb_build_object('deleted',found);
  else raise exception 'Acción de vista no permitida'; end if;
end; $$;
revoke execute on function erp_supply.reports_views_core(text,jsonb) from public,anon;
grant execute on function erp_supply.reports_views_core(text,jsonb) to authenticated;
create or replace function public.erp_x_reports_views(p_action text default 'LIST',p_payload jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$ select erp_supply.reports_views_core(p_action,coalesce(p_payload,'{}'::jsonb)); $$;
revoke execute on function public.erp_x_reports_views(text,jsonb) from public,anon;
grant execute on function public.erp_x_reports_views(text,jsonb) to authenticated;
