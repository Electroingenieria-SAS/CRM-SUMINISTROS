-- CRM Suministros · V11.14.0
-- Centro de inteligencia: dashboard transversal, comparación de periodos y calidad del dato.

create table if not exists erp_supply.report_saved_views (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id) on delete cascade,
  owner_profile_id uuid not null references erp_supply.profiles(id) on delete cascade,
  name text not null,
  description text,
  config jsonb not null default '{}'::jsonb,
  is_shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_report_saved_views_org_owner on erp_supply.report_saved_views(organization_id,owner_profile_id,updated_at desc);
create index if not exists idx_report_saved_views_shared on erp_supply.report_saved_views(organization_id,is_shared,updated_at desc) where is_shared;
alter table erp_supply.report_saved_views enable row level security;
grant usage on schema erp_supply to authenticated;

create or replace function erp_supply.reports_analytics_core(p_from date,p_to date)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
  v_actor uuid := erp_supply.require_profile();
  v_org uuid := erp_supply.current_org_id();
  v_tz text := coalesce((select o.timezone from erp_supply.organizations o where o.id=v_org),'America/Bogota');
  v_start timestamptz; v_end timestamptz; v_days integer; v_prev_from date; v_prev_to date; v_prev_start timestamptz; v_prev_end timestamptz; v_granularity text; v_result jsonb;
begin
  if not erp_supply.can_access_module('reports','read') then raise exception 'No autorizado para consultar Analítica y reportes' using errcode='42501'; end if;
  if p_from is null or p_to is null or p_from>p_to then raise exception 'Rango de fechas inválido'; end if;
  if (p_to-p_from)>366 then raise exception 'El análisis admite un máximo de 367 días por consulta'; end if;
  v_days:=(p_to-p_from)+1; v_prev_from:=p_from-v_days; v_prev_to:=p_from-1;
  v_start:=(p_from::timestamp at time zone v_tz); v_end:=((p_to+1)::timestamp at time zone v_tz);
  v_prev_start:=(v_prev_from::timestamp at time zone v_tz); v_prev_end:=((v_prev_to+1)::timestamp at time zone v_tz);
  v_granularity:=case when v_days>92 then 'WEEK' else 'DAY' end;

  with current_orders as (
    select o.* from erp_supply.orders o where o.organization_id=v_org and not coalesce(o.is_test,false) and o.created_at>=v_start and o.created_at<v_end
  ), previous_orders as (
    select o.* from erp_supply.orders o where o.organization_id=v_org and not coalesce(o.is_test,false) and o.created_at>=v_prev_start and o.created_at<v_prev_end
  ), current_invoices as (
    select i.* from erp_supply.invoices i join erp_supply.orders o on o.id=i.order_id where o.organization_id=v_org and not coalesce(o.is_test,false) and i.created_at>=v_start and i.created_at<v_end
  ), previous_invoices as (
    select i.* from erp_supply.invoices i join erp_supply.orders o on o.id=i.order_id where o.organization_id=v_org and not coalesce(o.is_test,false) and i.created_at>=v_prev_start and i.created_at<v_prev_end
  ), current_deliveries as (
    select d.* from erp_supply.deliveries d join erp_supply.orders o on o.id=d.order_id where o.organization_id=v_org and not coalesce(o.is_test,false) and d.created_at>=v_start and d.created_at<v_end
  ), previous_deliveries as (
    select d.* from erp_supply.deliveries d join erp_supply.orders o on o.id=d.order_id where o.organization_id=v_org and not coalesce(o.is_test,false) and d.created_at>=v_prev_start and d.created_at<v_prev_end
  ), current_tasks as (
    select t.* from erp_supply.order_tasks t join erp_supply.orders o on o.id=t.order_id where o.organization_id=v_org and not coalesce(o.is_test,false) and t.created_at>=v_start and t.created_at<v_end
  ), previous_tasks as (
    select t.* from erp_supply.order_tasks t join erp_supply.orders o on o.id=t.order_id where o.organization_id=v_org and not coalesce(o.is_test,false) and t.created_at>=v_prev_start and t.created_at<v_prev_end
  ), current_issues as (
    select i.* from erp_supply.order_issues i where i.organization_id=v_org and i.created_at>=v_start and i.created_at<v_end
  ), previous_issues as (
    select i.* from erp_supply.order_issues i where i.organization_id=v_org and i.created_at>=v_prev_start and i.created_at<v_prev_end
  ), current_approvals as (
    select a.* from erp_supply.approval_requests a where a.organization_id=v_org and a.created_at>=v_start and a.created_at<v_end
  ), current_purchases as (
    select p.* from erp_supply.purchase_orders p join erp_supply.orders o on o.id=p.order_id where o.organization_id=v_org and not coalesce(o.is_test,false) and p.created_at>=v_start and p.created_at<v_end
  ), current_sessions as (
    select s.* from erp_supply.task_sessions s join erp_supply.order_tasks t on t.id=s.task_id join erp_supply.orders o on o.id=t.order_id
    where o.organization_id=v_org and not coalesce(o.is_test,false) and s.started_at>=v_start and s.started_at<v_end
  ), current_work as (
    select w.* from erp_supply.work_executions w where w.organization_id=v_org and w.started_at>=v_start and w.started_at<v_end
  ), current_summary as (
    select jsonb_build_object(
      'orders',(select count(*) from current_orders),
      'activeOrders',(select count(*) from erp_supply.orders o where o.organization_id=v_org and not coalesce(o.is_test,false) and o.status not in ('CLOSED','CANCELLED')),
      'closedOrders',(select count(*) from current_orders where status='CLOSED'),
      'cancelledOrders',(select count(*) from current_orders where status='CANCELLED'),
      'onTimeClosedOrders',(select count(*) from current_orders where status='CLOSED' and closed_at is not null and promised_at is not null and closed_at<=promised_at),
      'closedWithPromise',(select count(*) from current_orders where status='CLOSED' and closed_at is not null and promised_at is not null),
      'onTimePct',(select round(100.0*count(*) filter(where status='CLOSED' and closed_at is not null and promised_at is not null and closed_at<=promised_at)/nullif(count(*) filter(where status='CLOSED' and closed_at is not null and promised_at is not null),0),2) from current_orders),
      'avgCycleSeconds',(select round(avg(erp_supply.business_seconds_between(v_org,created_at,closed_at)))::bigint from current_orders where status='CLOSED' and closed_at is not null),
      'p90CycleSeconds',(select round(percentile_cont(0.90) within group(order by erp_supply.business_seconds_between(v_org,created_at,closed_at)))::bigint from current_orders where status='CLOSED' and closed_at is not null),
      'invoiceCount',(select count(*) from current_invoices),'invoiceAmount',(select coalesce(sum(amount),0) from current_invoices),
      'invoicedOrders',(select count(distinct order_id) from current_invoices),'avgTicket',(select coalesce(round(sum(amount)/nullif(count(distinct order_id),0),2),0) from current_invoices),
      'deliveries',(select count(*) from current_deliveries),'delivered',(select count(*) from current_deliveries where delivered_at is not null or status='DELIVERED'),'shippingCost',(select coalesce(sum(carrier_cost),0) from current_deliveries),
      'purchaseOrders',(select count(*) from current_purchases),'purchaseAmount',(select coalesce(sum(total_amount),0) from current_purchases),
      'tasks',(select count(*) from current_tasks),'tasksCompleted',(select count(*) from current_tasks where completed_at is not null or status='COMPLETED'),'taskBusinessSeconds',(select coalesce(sum(coalesce(business_seconds,0)),0) from current_tasks),
      'issues',(select count(*) from current_issues),'openIssues',(select count(*) from current_issues where status not in ('RESOLVED','CLOSED')),'blockingIssues',(select count(*) from current_issues where blocking),
      'approvals',(select count(*) from current_approvals),'pendingApprovals',(select count(*) from current_approvals where status='PENDING'),'approvedApprovals',(select count(*) from current_approvals where status='APPROVED'),
      'taskSessions',(select count(*) from current_sessions),'sessionBusinessSeconds',(select coalesce(sum(coalesce(business_seconds,erp_supply.business_seconds_between(v_org,started_at,coalesce(ended_at,v_end)))),0) from current_sessions),'openTaskSessions',(select count(*) from current_sessions where ended_at is null),
      'workExecutions',(select count(*) from current_work),'workActiveSeconds',(select coalesce(sum(coalesce(active_seconds,business_seconds,0)),0) from current_work),'workPausedSeconds',(select coalesce(sum(coalesce(paused_seconds,0)),0) from current_work),'openWorkExecutions',(select count(*) from current_work where ended_at is null and status not in ('COMPLETED','CANCELLED')),
      'activePeople',(select count(*) from erp_supply.profiles p where p.organization_id=v_org and p.active and not p.is_system),
      'inventoryAvailable',(select coalesce(sum(l.quantity_available),0) from erp_supply.inventory_lots l join erp_supply.inventory_items i on i.id=l.inventory_item_id where i.organization_id=v_org and i.active),
      'inventoryReserved',(select coalesce(sum(l.quantity_reserved),0) from erp_supply.inventory_lots l join erp_supply.inventory_items i on i.id=l.inventory_item_id where i.organization_id=v_org and i.active),
      'inventoryBlocked',(select coalesce(sum(l.quantity_blocked),0) from erp_supply.inventory_lots l join erp_supply.inventory_items i on i.id=l.inventory_item_id where i.organization_id=v_org and i.active),
      'inventorySkus',(select count(*) from erp_supply.inventory_items i where i.organization_id=v_org and i.active)
    ) data
  ), previous_summary as (
    select jsonb_build_object(
      'orders',(select count(*) from previous_orders),'closedOrders',(select count(*) from previous_orders where status='CLOSED'),
      'invoiceAmount',(select coalesce(sum(amount),0) from previous_invoices),'deliveries',(select count(*) from previous_deliveries),'delivered',(select count(*) from previous_deliveries where delivered_at is not null or status='DELIVERED'),
      'shippingCost',(select coalesce(sum(carrier_cost),0) from previous_deliveries),'tasksCompleted',(select count(*) from previous_tasks where completed_at is not null or status='COMPLETED'),'issues',(select count(*) from previous_issues),
      'avgCycleSeconds',(select round(avg(erp_supply.business_seconds_between(v_org,created_at,closed_at)))::bigint from previous_orders where status='CLOSED' and closed_at is not null)
    ) data
  ), buckets as (
    select gs::date bucket_start,case when v_granularity='WEEK' then gs+interval '7 days' else gs+interval '1 day' end bucket_end
    from generate_series((case when v_granularity='WEEK' then date_trunc('week',p_from::timestamp)::date else p_from end)::timestamp,p_to::timestamp,case when v_granularity='WEEK' then interval '7 days' else interval '1 day' end) gs
  ), trend as (
    select b.bucket_start,
      (select count(*) from erp_supply.orders o where o.organization_id=v_org and not coalesce(o.is_test,false) and (o.created_at at time zone v_tz)>=b.bucket_start and (o.created_at at time zone v_tz)<b.bucket_end) orders_created,
      (select count(*) from erp_supply.orders o where o.organization_id=v_org and not coalesce(o.is_test,false) and o.closed_at is not null and (o.closed_at at time zone v_tz)>=b.bucket_start and (o.closed_at at time zone v_tz)<b.bucket_end) orders_closed,
      (select coalesce(sum(i.amount),0) from erp_supply.invoices i join erp_supply.orders o on o.id=i.order_id where o.organization_id=v_org and not coalesce(o.is_test,false) and (i.created_at at time zone v_tz)>=b.bucket_start and (i.created_at at time zone v_tz)<b.bucket_end) invoice_amount,
      (select count(*) from erp_supply.deliveries d join erp_supply.orders o on o.id=d.order_id where o.organization_id=v_org and not coalesce(o.is_test,false) and d.delivered_at is not null and (d.delivered_at at time zone v_tz)>=b.bucket_start and (d.delivered_at at time zone v_tz)<b.bucket_end) delivered,
      (select count(*) from erp_supply.order_tasks t join erp_supply.orders o on o.id=t.order_id where o.organization_id=v_org and not coalesce(o.is_test,false) and t.completed_at is not null and (t.completed_at at time zone v_tz)>=b.bucket_start and (t.completed_at at time zone v_tz)<b.bucket_end) tasks_completed,
      (select count(*) from erp_supply.order_issues i where i.organization_id=v_org and (i.created_at at time zone v_tz)>=b.bucket_start and (i.created_at at time zone v_tz)<b.bucket_end) issues
    from buckets b where b.bucket_start<=p_to
  ), stage_rows as (
    select t.step_code,coalesce(ws.name,t.step_code) step_name,coalesce(ws.sort_order,999) sort_order,count(*) tasks,
      count(*) filter(where t.completed_at is not null or t.status='COMPLETED') completed,count(*) filter(where t.status='BLOCKED' or t.blocked_at is not null) blocked,
      round(avg(coalesce(t.business_seconds,0)))::bigint avg_seconds,round(percentile_cont(0.5) within group(order by coalesce(t.business_seconds,0)))::bigint p50_seconds,round(percentile_cont(0.9) within group(order by coalesce(t.business_seconds,0)))::bigint p90_seconds,
      round(avg(case when t.assigned_at is not null and t.started_at is not null then erp_supply.business_seconds_between(v_org,t.assigned_at,t.started_at) end))::bigint avg_wait_seconds
    from current_tasks t left join erp_supply.workflow_steps ws on ws.code=t.step_code group by t.step_code,ws.name,ws.sort_order order by coalesce(ws.sort_order,999),t.step_code
  ), logistics_rows as (
    select coalesce(d.route_code,'SIN_RUTA') route,count(*) deliveries,count(*) filter(where d.delivered_at is not null or d.status='DELIVERED') delivered,coalesce(sum(d.carrier_cost),0) carrier_cost,
      round(avg(case when d.dispatched_at is not null and d.delivered_at is not null then extract(epoch from(d.delivered_at-d.dispatched_at)) end))::bigint avg_transit_seconds
    from current_deliveries d group by coalesce(d.route_code,'SIN_RUTA') order by count(*) desc
  ), inventory_rows as (
    select i.id item_id,coalesce(i.reference,i.sku,'SIN_REFERENCIA') reference,i.description,i.unit,coalesce(sum(l.quantity_available),0) available,coalesce(sum(l.quantity_reserved),0) reserved,coalesce(sum(l.quantity_blocked),0) blocked,count(l.id) lots
    from erp_supply.inventory_items i left join erp_supply.inventory_lots l on l.inventory_item_id=i.id where i.organization_id=v_org and i.active
    group by i.id,i.reference,i.sku,i.description,i.unit order by coalesce(sum(l.quantity_available),0) desc limit 20
  ), person_sessions as (
    select s.profile_id,count(*) sessions,coalesce(sum(coalesce(s.business_seconds,erp_supply.business_seconds_between(v_org,s.started_at,coalesce(s.ended_at,v_end)))),0) session_seconds from current_sessions s group by s.profile_id
  ), person_tasks as (
    select t.assigned_profile_id profile_id,count(*) tasks,count(*) filter(where t.completed_at is not null or t.status='COMPLETED') completed from current_tasks t where t.assigned_profile_id is not null group by t.assigned_profile_id
  ), person_work as (
    select w.profile_id,count(*) executions,coalesce(sum(coalesce(w.active_seconds,w.business_seconds,0)),0) active_seconds,coalesce(sum(coalesce(w.paused_seconds,0)),0) paused_seconds from current_work w group by w.profile_id
  ), people_rows as (
    select p.id profile_id,p.display_name profile_name,coalesce(ps.sessions,0) sessions,coalesce(ps.session_seconds,0) session_seconds,coalesce(pt.tasks,0) tasks,coalesce(pt.completed,0) tasks_completed,coalesce(pw.executions,0) work_executions,coalesce(pw.active_seconds,0) work_active_seconds,coalesce(pw.paused_seconds,0) work_paused_seconds
    from erp_supply.profiles p left join person_sessions ps on ps.profile_id=p.id left join person_tasks pt on pt.profile_id=p.id left join person_work pw on pw.profile_id=p.id
    where p.organization_id=v_org and p.active and not p.is_system order by coalesce(ps.session_seconds,0)+coalesce(pw.active_seconds,0) desc,p.display_name
  ), quality_row as (
    select jsonb_build_object(
      'orderFieldCompletenessPct',(select round(100.0*avg(((case when nullif(trim(client_name),'') is not null then 1 else 0 end)+(case when nullif(trim(client_document),'') is not null then 1 else 0 end)+(case when nullif(trim(client_city),'') is not null then 1 else 0 end)+(case when nullif(trim(client_address),'') is not null then 1 else 0 end)+(case when delivery_route_code is not null then 1 else 0 end)+(case when promised_at is not null or requested_delivery_date is not null then 1 else 0 end))/6.0),2) from current_orders),
      'clientDocumentPct',(select round(100.0*count(*) filter(where nullif(trim(client_document),'') is not null)/nullif(count(*),0),2) from current_orders),
      'clientCityPct',(select round(100.0*count(*) filter(where nullif(trim(client_city),'') is not null)/nullif(count(*),0),2) from current_orders),
      'clientAddressPct',(select round(100.0*count(*) filter(where nullif(trim(client_address),'') is not null)/nullif(count(*),0),2) from current_orders),
      'promisePct',(select round(100.0*count(*) filter(where promised_at is not null or requested_delivery_date is not null)/nullif(count(*),0),2) from current_orders),
      'invoiceAmountPct',(select round(100.0*count(*) filter(where amount is not null and amount>=0)/nullif(count(*),0),2) from current_invoices),
      'deliveryTrackingPct',(select round(100.0*count(*) filter(where nullif(trim(tracking_number),'') is not null or route_code in ('CLIENT_POINT','CLIENT_PICKUP','LOCAL_DISPATCH'))/nullif(count(*),0),2) from current_deliveries),
      'openTaskSessions',(select count(*) from current_sessions where ended_at is null),'openWorkExecutions',(select count(*) from current_work where ended_at is null and status not in ('COMPLETED','CANCELLED')),
      'ordersWithoutItems',(select count(*) from current_orders o where not exists(select 1 from erp_supply.order_items oi where oi.order_id=o.id)),
      'ordersWithoutTasks',(select count(*) from current_orders o where not exists(select 1 from erp_supply.order_tasks ot where ot.order_id=o.id))
    ) data
  )
  select jsonb_build_object(
    'range',jsonb_build_object('from',p_from,'to',p_to,'days',v_days,'previousFrom',v_prev_from,'previousTo',v_prev_to,'granularity',v_granularity),
    'summary',(select data from current_summary),'previous',(select data from previous_summary),
    'trend',coalesce((select jsonb_agg(jsonb_build_object('periodStart',bucket_start,'ordersCreated',orders_created,'ordersClosed',orders_closed,'invoiceAmount',invoice_amount,'delivered',delivered,'tasksCompleted',tasks_completed,'issues',issues) order by bucket_start) from trend),'[]'::jsonb),
    'dimensions',jsonb_build_object(
      'status',coalesce((select jsonb_agg(jsonb_build_object('label',status,'value',cnt) order by cnt desc) from (select coalesce(status,'SIN_ESTADO') status,count(*) cnt from current_orders group by 1) q),'[]'::jsonb),
      'steps',coalesce((select jsonb_agg(jsonb_build_object('label',step,'value',cnt) order by cnt desc) from (select coalesce(current_step_code,'SIN_ETAPA') step,count(*) cnt from current_orders group by 1) q),'[]'::jsonb),
      'routes',coalesce((select jsonb_agg(jsonb_build_object('label',route,'value',cnt) order by cnt desc) from (select coalesce(delivery_route_code,'SIN_RUTA') route,count(*) cnt from current_orders group by 1) q),'[]'::jsonb),
      'types',coalesce((select jsonb_agg(jsonb_build_object('label',typ,'value',cnt) order by cnt desc) from (select coalesce(order_type_code,'SIN_TIPO') typ,count(*) cnt from current_orders group by 1) q),'[]'::jsonb),
      'cities',coalesce((select jsonb_agg(jsonb_build_object('label',city,'value',cnt) order by cnt desc) from (select coalesce(nullif(trim(client_city),''),'SIN_CIUDAD') city,count(*) cnt from current_orders group by 1 order by 2 desc limit 15) q),'[]'::jsonb),
      'sellers',coalesce((select jsonb_agg(jsonb_build_object('label',seller,'value',cnt) order by cnt desc) from (select coalesce(p.display_name,'SIN_ASESOR') seller,count(*) cnt from current_orders o left join erp_supply.profiles p on p.id=o.seller_profile_id group by 1 order by 2 desc limit 15) q),'[]'::jsonb),
      'clients',coalesce((select jsonb_agg(jsonb_build_object('label',client,'value',cnt) order by cnt desc) from (select coalesce(nullif(trim(client_name),''),'SIN_CLIENTE') client,count(*) cnt from current_orders group by 1 order by 2 desc limit 15) q),'[]'::jsonb)
    ),
    'stages',coalesce((select jsonb_agg(to_jsonb(stage_rows) order by sort_order,step_code) from stage_rows),'[]'::jsonb),
    'logistics',coalesce((select jsonb_agg(to_jsonb(logistics_rows) order by deliveries desc) from logistics_rows),'[]'::jsonb),
    'inventory',coalesce((select jsonb_agg(to_jsonb(inventory_rows) order by available desc) from inventory_rows),'[]'::jsonb),
    'people',coalesce((select jsonb_agg(to_jsonb(people_rows) order by (session_seconds+work_active_seconds) desc,profile_name) from people_rows),'[]'::jsonb),
    'causes',jsonb_build_object(
      'issueType',coalesce((select jsonb_agg(jsonb_build_object('label',label,'value',cnt) order by cnt desc) from (select coalesce(issue_type,'SIN_TIPO') label,count(*) cnt from current_issues group by 1) q),'[]'::jsonb),
      'source',coalesce((select jsonb_agg(jsonb_build_object('label',label,'value',cnt) order by cnt desc) from (select coalesce(source_code,'SIN_ORIGEN') label,count(*) cnt from current_issues group by 1) q),'[]'::jsonb),
      'resolution',coalesce((select jsonb_agg(jsonb_build_object('label',label,'value',cnt) order by cnt desc) from (select coalesce(resolution_code,'SIN_RESOLUCION') label,count(*) cnt from current_issues group by 1) q),'[]'::jsonb)
    ),'quality',(select data from quality_row)
  ) into v_result;
  return v_result;
end; $$;
revoke execute on function erp_supply.reports_analytics_core(date,date) from public,anon;
grant execute on function erp_supply.reports_analytics_core(date,date) to authenticated;

create or replace function public.erp_x_reports_analytics(p_from date default current_date-29,p_to date default current_date)
returns jsonb language sql stable security invoker set search_path=''
as $$ select erp_supply.reports_analytics_core(p_from,p_to); $$;
revoke execute on function public.erp_x_reports_analytics(date,date) from public,anon;
grant execute on function public.erp_x_reports_analytics(date,date) to authenticated;
