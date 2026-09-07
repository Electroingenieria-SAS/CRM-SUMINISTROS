-- CRM Suministros · V11.12.0
-- Flujo y tiempos: VSM operacional, lead time, toque, espera, WIP, aging, SLA y trazabilidad.

create or replace function public.erp_x_vsm(
  p_date_from date default current_date-30,
  p_date_to date default current_date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_org uuid := erp_supply.current_org_id();
  v_result jsonb;
  v_tz text;
begin
  perform erp_supply.require_profile();
  select o.timezone into v_tz from erp_supply.organizations o where o.id=v_org;

  if not erp_supply.can_access_module('vsm','read') then
    raise exception 'No autorizado para consultar Flujo y tiempos' using errcode='42501';
  end if;

  if p_date_from is null or p_date_to is null or p_date_from > p_date_to then
    raise exception 'Rango de fechas inválido';
  end if;

  if (p_date_to - p_date_from) > 366 then
    raise exception 'El análisis de Flujo y tiempos admite un máximo de 367 días por consulta';
  end if;

  with
  completed_tasks as (
    select
      t.id,
      t.order_id,
      t.step_code,
      s.name step_name,
      s.sort_order,
      s.sla_hours,
      t.business_seconds touch_seconds,
      t.raw_seconds elapsed_seconds,
      erp_supply.business_seconds_between(v_org,t.created_at,t.completed_at) lead_business_seconds,
      greatest(
        erp_supply.business_seconds_between(v_org,t.created_at,t.completed_at) - t.business_seconds,
        0
      ) wait_business_seconds
    from erp_supply.order_tasks t
    join erp_supply.orders o on o.id=t.order_id
    join erp_supply.workflow_steps s on s.code=t.step_code
    where o.organization_id=v_org
      and not o.is_test
      and t.status='COMPLETED'
      and (t.completed_at at time zone v_tz)::date between p_date_from and p_date_to
  ),
  step_completed as (
    select
      step_code,
      count(*) tasks,
      round((avg(touch_seconds)/3600.0)::numeric,2) avg_touch_hours,
      round((avg(lead_business_seconds)/3600.0)::numeric,2) avg_lead_hours,
      round((avg(wait_business_seconds)/3600.0)::numeric,2) avg_wait_hours,
      round((avg(elapsed_seconds)/3600.0)::numeric,2) avg_elapsed_hours,
      round((percentile_cont(.5) within group(order by touch_seconds)/3600.0)::numeric,2) median_touch_hours,
      round((percentile_cont(.9) within group(order by touch_seconds)/3600.0)::numeric,2) p90_touch_hours,
      round((percentile_cont(.5) within group(order by lead_business_seconds)/3600.0)::numeric,2) median_lead_hours,
      round((percentile_cont(.9) within group(order by lead_business_seconds)/3600.0)::numeric,2) p90_lead_hours,
      round(
        case when sum(lead_business_seconds)>0
          then (sum(touch_seconds)::numeric/sum(lead_business_seconds))*100
          else 0 end
      ,1) flow_efficiency_pct,
      round(
        (
          100.0 * count(*) filter(where sla_hours is not null and lead_business_seconds <= sla_hours*3600)
          / nullif(count(*) filter(where sla_hours is not null),0)
        )::numeric
      ,1) sla_compliance_pct
    from completed_tasks
    group by step_code
  ),
  active_tasks as (
    select
      t.id,
      t.order_id,
      t.step_code,
      t.status,
      s.sla_hours,
      erp_supply.business_seconds_between(v_org,t.created_at,now()) age_business_seconds
    from erp_supply.order_tasks t
    join erp_supply.orders o on o.id=t.order_id
    join erp_supply.workflow_steps s on s.code=t.step_code
    where o.organization_id=v_org
      and not o.is_test
      and o.status not in ('CLOSED','CANCELLED')
      and t.status in ('QUEUED','ASSIGNED','IN_PROGRESS','WAITING','BLOCKED')
  ),
  step_active as (
    select
      step_code,
      count(*) wip,
      count(*) filter(where status='IN_PROGRESS') in_progress,
      count(*) filter(where status='WAITING') waiting,
      count(*) filter(where status='BLOCKED') blocked,
      count(*) filter(where sla_hours is not null and age_business_seconds > sla_hours*3600) overdue,
      round((avg(age_business_seconds)/3600.0)::numeric,2) avg_age_hours,
      round((max(age_business_seconds)/3600.0)::numeric,2) oldest_hours
    from active_tasks
    group by step_code
  ),
  step_metrics as (
    select
      s.code,
      s.name,
      s.sort_order,
      s.sla_hours,
      coalesce(c.tasks,0) tasks,
      coalesce(c.avg_touch_hours,0) avg_touch_hours,
      coalesce(c.avg_lead_hours,0) avg_lead_hours,
      coalesce(c.avg_wait_hours,0) avg_wait_hours,
      coalesce(c.avg_elapsed_hours,0) avg_elapsed_hours,
      coalesce(c.median_touch_hours,0) median_touch_hours,
      coalesce(c.p90_touch_hours,0) p90_touch_hours,
      coalesce(c.median_lead_hours,0) median_lead_hours,
      coalesce(c.p90_lead_hours,0) p90_lead_hours,
      coalesce(c.flow_efficiency_pct,0) flow_efficiency_pct,
      c.sla_compliance_pct,
      coalesce(a.wip,0) wip,
      coalesce(a.in_progress,0) in_progress,
      coalesce(a.waiting,0) waiting,
      coalesce(a.blocked,0) blocked,
      coalesce(a.overdue,0) overdue,
      coalesce(a.avg_age_hours,0) avg_age_hours,
      coalesce(a.oldest_hours,0) oldest_hours
    from erp_supply.workflow_steps s
    left join step_completed c on c.step_code=s.code
    left join step_active a on a.step_code=s.code
    where s.active and not s.terminal
  ),
  closed_orders as (
    select
      o.id,
      o.order_number,
      o.client_name,
      o.order_type_code,
      o.delivery_route_code,
      o.priority,
      o.created_at,
      o.closed_at,
      o.promised_at,
      erp_supply.business_seconds_between(v_org,o.created_at,o.closed_at) lead_business_seconds,
      greatest(extract(epoch from(o.closed_at-o.created_at))::bigint,0) elapsed_seconds
    from erp_supply.orders o
    where o.organization_id=v_org
      and not o.is_test
      and o.status='CLOSED'
      and o.closed_at is not null
      and (o.closed_at at time zone v_tz)::date between p_date_from and p_date_to
  ),
  duplicate_steps as (
    select order_id,step_code
    from completed_tasks
    group by order_id,step_code
    having count(*)>1
  ),
  daily_flow as (
    select
      d::date flow_day,
      (
        select count(*)
        from erp_supply.orders o
        where o.organization_id=v_org and not o.is_test and (o.created_at at time zone v_tz)::date=d::date
      ) created,
      (
        select count(*)
        from erp_supply.orders o
        where o.organization_id=v_org and not o.is_test and (o.closed_at at time zone v_tz)::date=d::date
      ) closed,
      (
        select count(distinct t.order_id)
        from erp_supply.order_tasks t
        join erp_supply.orders o on o.id=t.order_id
        where o.organization_id=v_org
          and not o.is_test
          and t.status<>'CANCELLED'
          and t.created_at < ((d::date+1)::timestamp at time zone v_tz)
          and (t.completed_at is null or t.completed_at >= ((d::date+1)::timestamp at time zone v_tz))
      ) wip_at_end
    from generate_series(p_date_from,p_date_to,'1 day'::interval) d
  )
  select jsonb_build_object(
    'summary',jsonb_build_object(
      'completedTasks',(select count(*) from completed_tasks),
      'closedOrders',(select count(*) from closed_orders),
      'avgOrderLeadHours',coalesce((select round((avg(lead_business_seconds)/3600.0)::numeric,2) from closed_orders),0),
      'medianOrderLeadHours',coalesce((select round((percentile_cont(.5) within group(order by lead_business_seconds)/3600.0)::numeric,2) from closed_orders),0),
      'p90OrderLeadHours',coalesce((select round((percentile_cont(.9) within group(order by lead_business_seconds)/3600.0)::numeric,2) from closed_orders),0),
      'totalTouchHours',coalesce((select round((sum(touch_seconds)/3600.0)::numeric,2) from completed_tasks),0),
      'totalStageLeadHours',coalesce((select round((sum(lead_business_seconds)/3600.0)::numeric,2) from completed_tasks),0),
      'totalWaitHours',coalesce((select round((sum(wait_business_seconds)/3600.0)::numeric,2) from completed_tasks),0),
      'flowEfficiencyPct',coalesce((select round((case when sum(lead_business_seconds)>0 then sum(touch_seconds)::numeric/sum(lead_business_seconds)*100 else 0 end)::numeric,1) from completed_tasks),0),
      'slaCompliancePct',coalesce((select round((100.0*count(*) filter(where sla_hours is not null and lead_business_seconds<=sla_hours*3600)/nullif(count(*) filter(where sla_hours is not null),0))::numeric,1) from completed_tasks),0),
      'currentWip',(select count(*) from active_tasks),
      'currentOverdue',(select count(*) from active_tasks where sla_hours is not null and age_business_seconds>sla_hours*3600),
      'currentWaitingBlocked',(select count(*) from active_tasks where status in('WAITING','BLOCKED')),
      'reworkOrders',(select count(distinct order_id) from duplicate_steps),
      'ordersWithPromise',(select count(*) from closed_orders where promised_at is not null),
      'onTimeRatePct',coalesce((select round((100.0*count(*) filter(where promised_at is not null and closed_at<=promised_at)/nullif(count(*) filter(where promised_at is not null),0))::numeric,1) from closed_orders),0)
    ),
    'steps',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'code',m.code,
        'name',m.name,
        'sortOrder',m.sort_order,
        'sort_order',m.sort_order,
        'slaHours',m.sla_hours,
        'tasks',m.tasks,
        'avgTouchHours',m.avg_touch_hours,
        'avgBusinessLeadHours',m.avg_lead_hours,
        'avgWaitHours',m.avg_wait_hours,
        'avgElapsedHours',m.avg_elapsed_hours,
        'medianTouchHours',m.median_touch_hours,
        'p90TouchHours',m.p90_touch_hours,
        'medianLeadHours',m.median_lead_hours,
        'p90LeadHours',m.p90_lead_hours,
        'flowEfficiencyPct',m.flow_efficiency_pct,
        'slaCompliancePct',m.sla_compliance_pct,
        'wip',m.wip,
        'inProgress',m.in_progress,
        'waiting',m.waiting,
        'blocked',m.blocked,
        'overdue',m.overdue,
        'avgAgeBusinessHours',m.avg_age_hours,
        'oldestBusinessHours',m.oldest_hours,
        'avgBusinessHours',m.avg_touch_hours,
        'medianBusinessHours',m.median_touch_hours,
        'p90BusinessHours',m.p90_touch_hours
      ) order by m.sort_order),'[]'::jsonb)
      from step_metrics m
    ),
    'throughput',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'day',f.flow_day,
        'created',f.created,
        'closed',f.closed,
        'wipAtEnd',f.wip_at_end
      ) order by f.flow_day),'[]'::jsonb)
      from daily_flow f
    ),
    'atRisk',(
      select coalesce(jsonb_agg(to_jsonb(x) order by x.risk_score desc,x."ageBusinessHours" desc),'[]'::jsonb)
      from (
        select
          o.id "orderId",
          o.order_number "orderNumber",
          o.client_name "clientName",
          o.priority,
          o.status,
          t.step_code "stepCode",
          s.name "stepName",
          p.display_name "assigneeName",
          round((erp_supply.business_seconds_between(v_org,t.created_at,now())/3600.0)::numeric,2) "ageBusinessHours",
          s.sla_hours "slaHours",
          round((greatest(erp_supply.business_seconds_between(v_org,t.created_at,now())-coalesce(s.sla_hours,0)*3600,0)/3600.0)::numeric,2) "overdueHours",
          o.promised_at "promisedAt",
          (
            case o.priority when 'CRITICAL' then 50 when 'URGENT' then 30 when 'HIGH' then 15 else 0 end
            + case when s.sla_hours is not null and erp_supply.business_seconds_between(v_org,t.created_at,now())>s.sla_hours*3600 then 40 else 0 end
            + case when t.status in('WAITING','BLOCKED') then 20 else 0 end
          ) risk_score
        from erp_supply.order_tasks t
        join erp_supply.orders o on o.id=t.order_id
        join erp_supply.workflow_steps s on s.code=t.step_code
        left join erp_supply.profiles p on p.id=t.assigned_profile_id
        where o.organization_id=v_org
          and not o.is_test
          and o.status not in('CLOSED','CANCELLED')
          and t.status in('QUEUED','ASSIGNED','IN_PROGRESS','WAITING','BLOCKED')
          and erp_supply.can_view_order(o.id)
        order by risk_score desc,"ageBusinessHours" desc
        limit 25
      ) x
    ),
    'slowestOrders',(
      select coalesce(jsonb_agg(to_jsonb(x) order by x."leadBusinessHours" desc),'[]'::jsonb)
      from (
        select
          o.id "orderId",
          o.order_number "orderNumber",
          o.client_name "clientName",
          o.order_type_code "orderType",
          o.delivery_route_code route,
          o.priority,
          round((erp_supply.business_seconds_between(v_org,o.created_at,o.closed_at)/3600.0)::numeric,2) "leadBusinessHours",
          round((extract(epoch from(o.closed_at-o.created_at))/3600.0)::numeric,2) "elapsedHours",
          o.promised_at "promisedAt",
          o.closed_at "closedAt",
          case when o.promised_at is null then null else o.closed_at<=o.promised_at end "onTime"
        from erp_supply.orders o
        where o.organization_id=v_org
          and not o.is_test
          and o.status='CLOSED'
          and o.closed_at is not null
          and (o.closed_at at time zone v_tz)::date between p_date_from and p_date_to
          and erp_supply.can_view_order(o.id)
        order by "leadBusinessHours" desc
        limit 25
      ) x
    ),
    'range',jsonb_build_object(
      'from',p_date_from,
      'to',p_date_to,
      'days',(p_date_to-p_date_from)+1
    ),
    'generatedAt',now()
  )
  into v_result;

  return v_result;
end;
$$;

revoke execute on function public.erp_x_vsm(date,date) from public,anon;
grant execute on function public.erp_x_vsm(date,date) to authenticated;
