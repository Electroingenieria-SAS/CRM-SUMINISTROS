-- CRM Suministros V11.37.0
-- PACO Operational Assistant: feed compacto de alertas/eventos.
-- No crea tablas ni índices. Reutiliza índices de order_tasks, work_executions,
-- work_activity_events y order_issues.
begin;

create or replace function public.erp_x_paco_feed(
  p_since timestamptz default null,
  p_event_limit integer default 20
)
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
  v_is_leader boolean:=v_roles && array[
    'lider_logistica','coordinador_logistico','jefe_logistica','gerencia','super_admin'
  ]::text[];
  v_tz text:='America/Bogota';
  v_org_settings jsonb:='{}'::jsonb;
  v_idle_minutes integer:=20;
  v_long_factor numeric:=1.35;
  v_long_grace_minutes integer:=15;
  v_since timestamptz:=greatest(coalesce(p_since,now()-interval '3 minutes'),now()-interval '24 hours');
  v_limit integer:=greatest(1,least(coalesce(p_event_limit,20),30));
  v_local_now timestamp;
  v_local_date date;
  v_iso_weekday integer;
  v_segment_start timestamptz;
  v_alerts jsonb:='[]'::jsonb;
  v_events jsonb:='[]'::jsonb;
  v_my_active jsonb;
begin
  select coalesce(o.timezone,'America/Bogota'),coalesce(o.settings,'{}'::jsonb)
    into v_tz,v_org_settings
  from erp_supply.organizations o
  where o.id=v_org;

  begin
    v_idle_minutes:=greatest(
      5,
      least(
        240,
        coalesce(nullif(v_org_settings#>>'{pacoAssistant,idleAlertMinutes}','')::integer,20)
      )
    );
  exception when others then
    v_idle_minutes:=20;
  end;

  begin
    v_long_factor:=greatest(
      1.05,
      least(
        3.0,
        coalesce(nullif(v_org_settings#>>'{pacoAssistant,longActivityFactor}','')::numeric,1.35)
      )
    );
  exception when others then
    v_long_factor:=1.35;
  end;

  begin
    v_long_grace_minutes:=greatest(
      5,
      least(
        120,
        coalesce(nullif(v_org_settings#>>'{pacoAssistant,longActivityGraceMinutes}','')::integer,15)
      )
    );
  exception when others then
    v_long_grace_minutes:=15;
  end;

  v_local_now:=now() at time zone v_tz;
  v_local_date:=v_local_now::date;
  v_iso_weekday:=extract(isodow from v_local_now)::integer;

  if not exists(
    select 1
    from erp_supply.holidays h
    where h.organization_id=v_org
      and h.holiday_date=v_local_date
  ) then
    select ((v_local_date::timestamp+s.start_time) at time zone v_tz)
      into v_segment_start
    from erp_supply.work_calendars c
    join erp_supply.work_calendar_segments s on s.calendar_id=c.id
    where c.organization_id=v_org
      and c.active
      and s.iso_weekday=v_iso_weekday
      and v_local_now::time>=s.start_time
      and v_local_now::time<s.end_time
    order by s.start_time
    limit 1;
  end if;

  with
  order_delay as (
    select
      'ORDER_QUEUE_DELAY'::text type,
      case
        when age.business_seconds>=coalesce(ws.sla_hours,0)*3600 then 'critical'
        else 'warning'
      end severity,
      'order:'||t.id::text id,
      o.id "orderId",
      o.order_number "orderNumber",
      t.id "taskId",
      t.step_code "stepCode",
      ws.name "stepName",
      t.assigned_profile_id "profileId",
      p.display_name "profileName",
      age.business_seconds "ageSeconds",
      coalesce(ws.sla_hours,0)*3600 "thresholdSeconds",
      coalesce(t.started_at,t.assigned_at,t.created_at) "startedAt",
      null::uuid "executionId"
    from erp_supply.order_tasks t
    join erp_supply.orders o on o.id=t.order_id
    join erp_supply.workflow_steps ws on ws.code=t.step_code
    left join erp_supply.profiles p on p.id=t.assigned_profile_id
    cross join lateral(
      select erp_supply.business_seconds_between(
        v_org,
        coalesce(t.started_at,t.assigned_at,t.created_at),
        now()
      )::bigint business_seconds
    ) age
    where o.organization_id=v_org
      and not coalesce(o.is_test,false)
      and t.status in('QUEUED','ASSIGNED','IN_PROGRESS','WAITING','BLOCKED')
      and ws.sla_hours is not null
      and ws.sla_hours>0
      and age.business_seconds>=greatest(900,(ws.sla_hours*3600*0.80)::bigint)
      and erp_supply.can_view_order(o.id)
      and (
        v_is_leader
        or t.assigned_profile_id=v_actor
        or (t.assigned_profile_id is null and t.assigned_role_code=any(v_roles))
      )
  ),
  aux_people as (
    select
      p.id,
      p.display_name,
      min(pr.role_code) filter(where pr.role_code in('aux_logistica','auxiliar_corte')) role_code
    from erp_supply.profiles p
    join erp_supply.profile_roles pr on pr.profile_id=p.id
    where p.organization_id=v_org
      and p.active
      and pr.role_code in('aux_logistica','auxiliar_corte')
      and (v_is_leader or p.id=v_actor)
    group by p.id,p.display_name
  ),
  idle_base as (
    select
      p.id,
      p.display_name,
      p.role_code,
      greatest(
        v_segment_start,
        coalesce((
          select max(e.ended_at)
          from erp_supply.work_executions e
          where e.organization_id=v_org
            and e.profile_id=p.id
            and e.ended_at>=v_segment_start
        ),v_segment_start),
        coalesce((
          select max(t.completed_at)
          from erp_supply.order_tasks t
          join erp_supply.orders o on o.id=t.order_id
          where o.organization_id=v_org
            and t.assigned_profile_id=p.id
            and t.completed_at>=v_segment_start
        ),v_segment_start)
      ) idle_since
    from aux_people p
    where v_segment_start is not null
      and not exists(
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
  idle_aux as (
    select
      'AUX_IDLE'::text type,
      case when extract(epoch from(now()-i.idle_since))>=v_idle_minutes*120 then 'critical' else 'warning' end severity,
      'idle:'||i.id::text id,
      null::uuid "orderId",
      null::text "orderNumber",
      null::uuid "taskId",
      null::text "stepCode",
      null::text "stepName",
      i.id "profileId",
      i.display_name "profileName",
      extract(epoch from(now()-i.idle_since))::bigint "ageSeconds",
      (v_idle_minutes*60)::bigint "thresholdSeconds",
      i.idle_since "startedAt",
      null::uuid "executionId"
    from idle_base i
    where extract(epoch from(now()-i.idle_since))>=v_idle_minutes*60
  ),
  long_work_base as (
    select
      e.id,
      e.profile_id,
      p.display_name,
      e.title_snapshot,
      e.started_at,
      greatest(
        0,
        erp_supply.business_seconds_between(v_org,e.started_at,now())
        -coalesce(e.paused_seconds,0)
      )::bigint active_seconds,
      greatest(
        60,
        coalesce(a.estimated_minutes,c.standard_minutes,60)
      )::bigint expected_minutes
    from erp_supply.work_executions e
    join erp_supply.profiles p on p.id=e.profile_id
    join erp_supply.work_activity_catalog c on c.id=e.catalog_id
    left join erp_supply.work_assignments a on a.id=e.assignment_id
    where e.organization_id=v_org
      and e.status='IN_PROGRESS'
      and (v_is_leader or e.profile_id=v_actor)
  ),
  long_activity as (
    select
      'LONG_ACTIVITY'::text type,
      case when w.active_seconds>=threshold.threshold_seconds*1.35 then 'critical' else 'warning' end severity,
      'execution:'||w.id::text id,
      null::uuid "orderId",
      null::text "orderNumber",
      null::uuid "taskId",
      null::text "stepCode",
      w.title_snapshot "stepName",
      w.profile_id "profileId",
      w.display_name "profileName",
      w.active_seconds "ageSeconds",
      threshold.threshold_seconds "thresholdSeconds",
      w.started_at "startedAt",
      w.id "executionId"
    from long_work_base w
    cross join lateral(
      select greatest(
        ceil(w.expected_minutes*60*v_long_factor)::bigint,
        (w.expected_minutes+v_long_grace_minutes)*60
      )::bigint threshold_seconds
    ) threshold
    where w.active_seconds>=threshold.threshold_seconds
  ),
  alert_rows as (
    select * from order_delay
    union all
    select * from idle_aux
    union all
    select * from long_activity
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',a.id,
        'type',a.type,
        'severity',a.severity,
        'orderId',a."orderId",
        'orderNumber',a."orderNumber",
        'taskId',a."taskId",
        'stepCode',a."stepCode",
        'stepName',a."stepName",
        'profileId',a."profileId",
        'profileName',a."profileName",
        'ageSeconds',a."ageSeconds",
        'thresholdSeconds',a."thresholdSeconds",
        'startedAt',a."startedAt",
        'executionId',a."executionId"
      )
      order by
        case a.severity when 'critical' then 0 else 1 end,
        a."ageSeconds" desc
    ),
    '[]'::jsonb
  )
  into v_alerts
  from alert_rows a;

  with event_rows as (
    select
      'WORK_FINISHED'::text type,
      'work:'||ev.id::text id,
      ev.created_at "occurredAt",
      null::uuid "orderId",
      null::text "orderNumber",
      ex.id "executionId",
      ex.profile_id "profileId",
      p.display_name "profileName",
      ex.title_snapshot title,
      null::text "stepCode",
      null::text "stepName",
      null::text "issueType",
      null::text detail
    from erp_supply.work_activity_events ev
    join erp_supply.work_executions ex on ex.id=ev.execution_id
    join erp_supply.profiles p on p.id=ex.profile_id
    where ev.organization_id=v_org
      and ev.event_type='FINISHED'
      and ev.created_at>v_since
      and (v_is_leader or ex.profile_id=v_actor)

    union all

    select
      'ORDER_DISPATCHED',
      'dispatch:'||ev.id::text,
      ev.created_at,
      o.id,
      o.order_number,
      null::uuid,
      ev.actor_profile_id,
      p.display_name,
      null::text,
      ev.from_step_code,
      ws.name,
      null::text,
      null::text
    from erp_supply.order_events ev
    join erp_supply.orders o on o.id=ev.order_id
    left join erp_supply.profiles p on p.id=ev.actor_profile_id
    left join erp_supply.workflow_steps ws on ws.code=ev.from_step_code
    where ev.organization_id=v_org
      and ev.action_code='COMPLETE'
      and ev.from_step_code in('LOCAL_DISPATCH','NATIONAL_DISPATCH','CLIENT_POINT','CLIENT_PICKUP')
      and ev.to_step_code='CLOSURE'
      and ev.created_at>v_since
      and erp_supply.can_view_order(o.id)
      and (v_is_leader or ev.actor_profile_id=v_actor)

    union all

    select
      'ORDER_NOVELTY',
      'issue:'||i.id::text,
      i.created_at,
      o.id,
      o.order_number,
      null::uuid,
      i.created_by,
      p.display_name,
      i.title,
      t.step_code,
      ws.name,
      i.issue_type,
      left(coalesce(i.detail,''),240)
    from erp_supply.order_issues i
    join erp_supply.orders o on o.id=i.order_id
    left join erp_supply.order_tasks t on t.id=i.task_id
    left join erp_supply.workflow_steps ws on ws.code=t.step_code
    left join erp_supply.profiles p on p.id=i.created_by
    where i.organization_id=v_org
      and i.created_at>v_since
      and erp_supply.can_view_order(o.id)
      and (
        v_is_leader
        or i.created_by=v_actor
        or i.target_role_code=any(v_roles)
      )

    union all

    select
      'ORDER_CLOSED',
      'closed:'||ev.id::text,
      ev.created_at,
      o.id,
      o.order_number,
      null::uuid,
      ev.actor_profile_id,
      p.display_name,
      null::text,
      ev.from_step_code,
      'Pedido cerrado',
      null::text,
      null::text
    from erp_supply.order_events ev
    join erp_supply.orders o on o.id=ev.order_id
    left join erp_supply.profiles p on p.id=ev.actor_profile_id
    where ev.organization_id=v_org
      and ev.created_at>v_since
      and (ev.to_step_code='CLOSED' or ev.to_status='CLOSED')
      and erp_supply.can_view_order(o.id)
      and (v_is_leader or ev.actor_profile_id=v_actor)
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',x.id,
        'type',x.type,
        'occurredAt',x."occurredAt",
        'orderId',x."orderId",
        'orderNumber',x."orderNumber",
        'executionId',x."executionId",
        'profileId',x."profileId",
        'profileName',x."profileName",
        'title',x.title,
        'stepCode',x."stepCode",
        'stepName',x."stepName",
        'issueType',x."issueType",
        'detail',x.detail
      )
      order by x."occurredAt" desc
    ),
    '[]'::jsonb
  )
  into v_events
  from (
    select *
    from event_rows
    order by "occurredAt" desc
    limit v_limit
  ) x;

  select jsonb_build_object(
    'executionId',e.id,
    'title',e.title_snapshot,
    'status',e.status,
    'startedAt',e.started_at,
    'activeSeconds',greatest(
      0,
      erp_supply.business_seconds_between(v_org,e.started_at,now())-coalesce(e.paused_seconds,0)
    )
  )
  into v_my_active
  from erp_supply.work_executions e
  where e.organization_id=v_org
    and e.profile_id=v_actor
    and e.status in('IN_PROGRESS','PAUSED')
  order by e.started_at desc
  limit 1;

  return jsonb_build_object(
    'serverTime',now(),
    'viewer',jsonb_build_object(
      'profileId',v_actor,
      'roles',to_jsonb(v_roles),
      'leader',v_is_leader
    ),
    'settings',jsonb_build_object(
      'idleAlertMinutes',v_idle_minutes,
      'longActivityFactor',v_long_factor,
      'longActivityGraceMinutes',v_long_grace_minutes,
      'pollOpenSeconds',20,
      'pollClosedSeconds',45
    ),
    'alerts',v_alerts,
    'events',v_events,
    'context',jsonb_build_object(
      'myActiveWork',v_my_active,
      'workingNow',v_segment_start is not null
    ),
    'version','11.37.0'
  );
end;
$$;

revoke all on function public.erp_x_paco_feed(timestamptz,integer) from public,anon;
grant execute on function public.erp_x_paco_feed(timestamptz,integer) to authenticated;

comment on function public.erp_x_paco_feed(timestamptz,integer)
is 'V11.37.0 PACO: feed compacto y role-scoped de SLA, inactividad auxiliar, actividad prolongada y eventos operativos.';

notify pgrst,'reload schema';
commit;
