-- CRM Suministros V11.37.0
-- PACO Operational Assistant
-- Un snapshot compacto para monitorizar operación sin múltiples RPC desde el navegador.

begin;

create index if not exists idx_paco_order_tasks_active_v11370
  on erp_supply.order_tasks(order_id,created_at)
  where status in('QUEUED','ASSIGNED','WAITING','BLOCKED','IN_PROGRESS');

create index if not exists idx_paco_order_events_recent_v11370
  on erp_supply.order_events(organization_id,created_at desc);

create index if not exists idx_paco_delivery_recent_v11370
  on erp_supply.delivery_milestones(organization_id,occurred_at desc);

create or replace function public.erp_x_paco_snapshot(p_since timestamptz default null)
returns jsonb
language plpgsql
stable
security definer
set search_path=erp_supply,public,auth,pg_catalog
as $$
declare
  v_actor uuid:=erp_supply.require_profile();
  v_org uuid:=erp_supply.current_org_id();
  v_roles text[]:=erp_supply.current_roles();
  v_now timestamptz:=now();
  v_since timestamptz;
  v_tz text:=coalesce((select timezone from erp_supply.organizations where id=v_org),'America/Bogota');
  v_day_start timestamptz;
  v_manager boolean;
begin
  v_since:=greatest(coalesce(p_since,v_now-interval '10 minutes'),v_now-interval '2 hours');
  v_day_start:=(((v_now at time zone v_tz)::date)::timestamp at time zone v_tz);
  v_manager:=v_roles && array[
    'lider_logistica','coordinador_logistico','jefe_logistica','gerencia','super_admin'
  ]::text[];

  return (
    with
    queue_data as (
      select
        t.id task_id,
        o.id order_id,
        o.order_number,
        o.priority,
        t.status task_status,
        t.step_code,
        coalesce(ws.name,initcap(replace(t.step_code,'_',' '))) step_name,
        t.assigned_profile_id,
        ap.display_name assigned_name,
        t.assigned_role_code,
        greatest(
          0,
          erp_supply.business_seconds_between(
            v_org,
            case
              when t.status='IN_PROGRESS' then coalesce(t.started_at,t.assigned_at,t.created_at)
              else coalesce(t.assigned_at,t.created_at)
            end,
            v_now
          )
        )::bigint queue_seconds,
        greatest(
          900,
          round(coalesce(nullif(ws.sla_hours,0),1)::numeric*3600*0.75)
        )::bigint warning_seconds,
        greatest(
          1200,
          round(coalesce(nullif(ws.sla_hours,0),1)::numeric*3600)
        )::bigint critical_seconds
      from erp_supply.order_tasks t
      join erp_supply.orders o on o.id=t.order_id
      left join erp_supply.workflow_steps ws on ws.code=t.step_code
      left join erp_supply.profiles ap on ap.id=t.assigned_profile_id
      where o.organization_id=v_org
        and not coalesce(o.is_history,false)
        and not coalesce(o.is_test,false)
        and o.status not in('CLOSED','CANCELLED')
        and t.status in('QUEUED','ASSIGNED','WAITING','BLOCKED','IN_PROGRESS')
        and (
          v_manager
          or t.assigned_profile_id=v_actor
          or t.assigned_role_code=any(v_roles)
          or o.current_assignee_id=v_actor
          or o.current_role_code=any(v_roles)
          or o.seller_profile_id=v_actor
        )
    ),
    activity_data as (
      select
        e.id execution_id,
        e.profile_id,
        p.display_name profile_name,
        e.title_snapshot title,
        e.started_at,
        e.status,
        c.standard_minutes,
        greatest(
          0,
          erp_supply.business_seconds_between(v_org,e.started_at,v_now)
          - coalesce(e.paused_seconds,0)
        )::bigint active_business_seconds,
        case
          when coalesce(c.standard_minutes,0)>0 then
            greatest(
              (c.standard_minutes*60+600)::bigint,
              round(c.standard_minutes*60*1.25)::bigint
            )
          else 3600::bigint
        end threshold_seconds
      from erp_supply.work_executions e
      join erp_supply.profiles p on p.id=e.profile_id
      left join erp_supply.work_activity_catalog c on c.id=e.catalog_id
      where e.organization_id=v_org
        and e.status='IN_PROGRESS'
        and (e.profile_id=v_actor or v_manager)
    ),
    aux_profiles as (
      select
        p.id,
        p.display_name,
        array_agg(distinct pr.role_code order by pr.role_code) roles
      from erp_supply.profiles p
      join erp_supply.profile_roles pr on pr.profile_id=p.id
      where p.organization_id=v_org
        and p.active
        and pr.role_code in('aux_logistica','auxiliar_corte')
        and (p.id=v_actor or v_manager)
      group by p.id,p.display_name
    ),
    idle_data as (
      select
        p.id profile_id,
        p.display_name profile_name,
        p.roles,
        greatest(
          0,
          erp_supply.business_seconds_between(
            v_org,
            greatest(
              coalesce(last_work.ended_at,v_day_start),
              coalesce(last_task.completed_at,v_day_start),
              v_day_start
            ),
            v_now
          )
        )::bigint idle_seconds
      from aux_profiles p
      left join lateral(
        select max(e.ended_at) ended_at
        from erp_supply.work_executions e
        where e.organization_id=v_org
          and e.profile_id=p.id
          and e.ended_at is not null
          and e.ended_at>=v_day_start
      ) last_work on true
      left join lateral(
        select max(t.completed_at) completed_at
        from erp_supply.order_tasks t
        join erp_supply.orders o on o.id=t.order_id
        where o.organization_id=v_org
          and t.assigned_profile_id=p.id
          and t.completed_at is not null
          and t.completed_at>=v_day_start
      ) last_task on true
      where not exists(
        select 1
        from erp_supply.work_executions e
        where e.organization_id=v_org
          and e.profile_id=p.id
          and e.status in('IN_PROGRESS','PAUSED')
      )
      and not exists(
        select 1
        from erp_supply.order_tasks t
        join erp_supply.orders o on o.id=t.order_id
        where o.organization_id=v_org
          and t.assigned_profile_id=p.id
          and t.status='IN_PROGRESS'
      )
    ),
    alerts as (
      select
        jsonb_build_object(
          'key',case when q.task_status='IN_PROGRESS' then 'PROCESS:' else 'QUEUE:' end||
            q.task_id::text||':'||
            case when q.queue_seconds>=q.critical_seconds then 'CRITICAL' else 'WARNING' end,
          'kind',case when q.task_status='IN_PROGRESS' then 'ORDER_PROCESS_LONG' else 'ORDER_QUEUE' end,
          'severity',case when q.queue_seconds>=q.critical_seconds then 'critical' else 'warning' end,
          'title',case when q.task_status='IN_PROGRESS' then 'Pedido demorado en proceso' else 'Pedido demorado en cola' end,
          'stepName',q.step_name,
          'orderId',q.order_id,
          'orderNumber',q.order_number,
          'profileId',q.assigned_profile_id,
          'profileName',q.assigned_name,
          'stepCode',q.step_code,
          'elapsedSeconds',q.queue_seconds,
          'thresholdSeconds',q.critical_seconds,
          'action','OPEN_ORDER'
        ) alert,
        case when q.queue_seconds>=q.critical_seconds then 100 else 70 end rank
      from queue_data q
      where q.queue_seconds>=q.warning_seconds

      union all

      select
        jsonb_build_object(
          'key','ACTIVITY_LONG:'||a.execution_id::text,
          'kind','ACTIVITY_LONG',
          'severity','warning',
          'title','Actividad excedida',
          'activityTitle',a.title,
          'standardMinutes',a.standard_minutes,
          'executionId',a.execution_id,
          'profileId',a.profile_id,
          'profileName',a.profile_name,
          'elapsedSeconds',a.active_business_seconds,
          'thresholdSeconds',a.threshold_seconds,
          'action','OPEN_WORKFORCE'
        ) alert,
        65 rank
      from activity_data a
      where a.active_business_seconds>=a.threshold_seconds

      union all

      select
        jsonb_build_object(
          'key','IDLE:'||i.profile_id::text||':'||floor(i.idle_seconds/1800)::text,
          'kind','AUXILIARY_IDLE',
          'severity',case when i.idle_seconds>=3600 then 'critical' else 'warning' end,
          'title','Auxiliar disponible hace tiempo',
          'profileId',i.profile_id,
          'profileName',i.profile_name,
          'roles',to_jsonb(i.roles),
          'elapsedSeconds',i.idle_seconds,
          'thresholdSeconds',900,
          'action','OPEN_WORKFORCE'
        ) alert,
        case when i.idle_seconds>=3600 then 90 else 55 end rank
      from idle_data i
      where i.idle_seconds>=900
    ),
    recent_work as (
      select
        e.id event_id,
        e.created_at happened_at,
        e.profile_id,
        p.display_name profile_name,
        x.id execution_id,
        x.title_snapshot title
      from erp_supply.work_activity_events e
      join erp_supply.profiles p on p.id=e.profile_id
      left join erp_supply.work_executions x on x.id=e.execution_id
      where e.organization_id=v_org
        and e.created_at>=v_since
        and e.event_type='FINISHED'
        and (e.profile_id=v_actor or v_manager)
    ),
    recent_delivery as (
      select
        d.id event_id,
        d.occurred_at happened_at,
        d.milestone_code,
        o.id order_id,
        o.order_number
      from erp_supply.delivery_milestones d
      join erp_supply.orders o on o.id=d.order_id
      where d.organization_id=v_org
        and d.occurred_at>=v_since
        and d.milestone_code in('DISPATCHED','DELIVERED')
        and (
          v_manager
          or o.current_assignee_id=v_actor
          or o.current_role_code=any(v_roles)
          or o.seller_profile_id=v_actor
        )
    ),
    recent_issues as (
      select
        i.id event_id,
        i.created_at happened_at,
        i.order_id,
        o.order_number,
        i.title,
        i.detail,
        i.blocking
      from erp_supply.order_issues i
      join erp_supply.orders o on o.id=i.order_id
      where i.organization_id=v_org
        and i.created_at>=v_since
        and i.status='OPEN'
        and (
          v_manager
          or i.created_by=v_actor
          or i.target_role_code=any(v_roles)
          or o.current_assignee_id=v_actor
          or o.current_role_code=any(v_roles)
          or o.seller_profile_id=v_actor
        )
    ),
    recent_flow as (
      select
        oe.id event_id,
        oe.created_at happened_at,
        oe.order_id,
        o.order_number,
        oe.from_step_code,
        oe.to_step_code
      from erp_supply.order_events oe
      join erp_supply.orders o on o.id=oe.order_id
      where oe.organization_id=v_org
        and oe.created_at>=v_since
        and oe.to_step_code is not null
        and oe.to_step_code is distinct from oe.from_step_code
        and (
          v_manager
          or o.current_assignee_id=v_actor
          or o.current_role_code=any(v_roles)
          or o.seller_profile_id=v_actor
        )
    ),
    events as (
      select jsonb_build_object(
        'key','WORK_FINISHED:'||w.event_id::text,
        'kind','ACTIVITY_FINISHED',
        'severity','success',
        'happenedAt',w.happened_at,
        'text',w.profile_name||' terminó '||coalesce(w.title,'una actividad')||'.',
        'profileId',w.profile_id,
        'profileName',w.profile_name,
        'executionId',w.execution_id,
        'action','OPEN_WORKFORCE'
      ) event,w.happened_at
      from recent_work w

      union all

      select jsonb_build_object(
        'key','DELIVERY:'||d.event_id::text,
        'kind',case when d.milestone_code='DISPATCHED' then 'ORDER_DISPATCHED' else 'ORDER_DELIVERED' end,
        'severity','success',
        'happenedAt',d.happened_at,
        'text','El pedido '||d.order_number||
          case when d.milestone_code='DISPATCHED' then ' fue despachado.' else ' fue entregado.' end,
        'orderId',d.order_id,
        'orderNumber',d.order_number,
        'action','OPEN_ORDER'
      ) event,d.happened_at
      from recent_delivery d

      union all

      select jsonb_build_object(
        'key','ISSUE:'||i.event_id::text,
        'kind','ORDER_ISSUE',
        'severity',case when i.blocking then 'critical' else 'warning' end,
        'happenedAt',i.happened_at,
        'text','Novedad en pedido '||i.order_number||': '||i.title||'.',
        'detail',i.detail,
        'orderId',i.order_id,
        'orderNumber',i.order_number,
        'action','OPEN_ORDER'
      ) event,i.happened_at
      from recent_issues i

      union all

      select jsonb_build_object(
        'key','FLOW:'||f.event_id::text,
        'kind','ORDER_ADVANCED',
        'severity','info',
        'happenedAt',f.happened_at,
        'text','El pedido '||f.order_number||' avanzó a '||
          initcap(replace(f.to_step_code,'_',' '))||'.',
        'orderId',f.order_id,
        'orderNumber',f.order_number,
        'stepCode',f.to_step_code,
        'action','OPEN_ORDER'
      ) event,f.happened_at
      from recent_flow f
    )
    select jsonb_build_object(
      'version','11.37.0',
      'serverTime',v_now,
      'since',v_since,
      'viewer',jsonb_build_object(
        'profileId',v_actor,
        'roles',to_jsonb(v_roles),
        'isManager',v_manager
      ),
      'alerts',coalesce(
        (select jsonb_agg(a.alert order by a.rank desc,(a.alert->>'elapsedSeconds')::bigint desc) from alerts a),
        '[]'::jsonb
      ),
      'events',coalesce(
        (select jsonb_agg(e.event order by e.happened_at desc) from (select * from events order by happened_at desc limit 30) e),
        '[]'::jsonb
      ),
      'summary',jsonb_build_object(
        'queueAlerts',(select count(*) from alerts where alert->>'kind'='ORDER_QUEUE'),
        'processAlerts',(select count(*) from alerts where alert->>'kind'='ORDER_PROCESS_LONG'),
        'activityAlerts',(select count(*) from alerts where alert->>'kind'='ACTIVITY_LONG'),
        'idleAlerts',(select count(*) from alerts where alert->>'kind'='AUXILIARY_IDLE'),
        'recentEvents',(select count(*) from events)
      )
    )
  );
end;
$$;

revoke all on function public.erp_x_paco_snapshot(timestamptz) from public,anon;
grant execute on function public.erp_x_paco_snapshot(timestamptz) to authenticated;

comment on function public.erp_x_paco_snapshot(timestamptz)
is 'V11.37.0: snapshot compacto y autorizado para PACO; cola/SLA, actividad excedida, auxiliares inactivos y eventos operativos recientes.';

notify pgrst,'reload schema';
commit;
