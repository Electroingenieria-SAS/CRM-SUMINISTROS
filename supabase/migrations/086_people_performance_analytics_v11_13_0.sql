-- CRM Suministros · V11.13.0
-- Analítica integral de personas y tiempos para Flujo y tiempos.
-- Separa jornada programada, trabajo clasificado, pausas explícitas y tiempo sin clasificar.

create or replace function public.erp_x_vsm_people(
  p_date_from date default current_date-30,
  p_date_to date default current_date,
  p_profile_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := erp_supply.require_profile();
  v_org uuid := erp_supply.current_org_id();
  v_tz text := coalesce((select o.timezone from erp_supply.organizations o where o.id=v_org),'America/Bogota');
  v_start timestamptz;
  v_end timestamptz;
  v_manager boolean := erp_supply.has_role('super_admin')
    or erp_supply.has_role('jefe_logistica')
    or erp_supply.has_role('lider_logistica')
    or erp_supply.has_role('gerencia')
    or erp_supply.has_role('auditoria');
  v_profiles uuid[];
  v_bucket_days integer;
  v_result jsonb;
begin
  if not erp_supply.can_access_module('vsm','read') then
    raise exception 'No autorizado para consultar analítica de personas' using errcode='42501';
  end if;

  if p_date_from is null or p_date_to is null or p_date_from>p_date_to then
    raise exception 'Rango de fechas inválido';
  end if;
  if (p_date_to-p_date_from)>366 then
    raise exception 'La analítica admite un máximo de 367 días por consulta';
  end if;

  v_start := (p_date_from::timestamp at time zone v_tz);
  v_end := ((p_date_to+1)::timestamp at time zone v_tz);
  v_bucket_days := case when (p_date_to-p_date_from)>92 then 7 else 1 end;

  if p_profile_id is not null then
    if not exists(
      select 1 from erp_supply.profiles p
      where p.id=p_profile_id and p.organization_id=v_org and p.active and not p.is_system
    ) then
      raise exception 'Usuario no disponible para el análisis';
    end if;
    if p_profile_id<>v_actor and not(
      erp_supply.has_role('super_admin') or erp_supply.has_role('auditoria')
      or erp_supply.can_manage_work_profile(p_profile_id,'ACTIVITY')
      or erp_supply.can_manage_work_profile(p_profile_id,'DELIVERABLE')
    ) then
      raise exception 'No autorizado para consultar este usuario' using errcode='42501';
    end if;
    v_profiles:=array[p_profile_id];
  elsif v_manager then
    select coalesce(array_agg(p.id order by p.display_name),'{}'::uuid[])
    into v_profiles
    from erp_supply.profiles p
    where p.organization_id=v_org and p.active and not p.is_system
      and(
        erp_supply.has_role('super_admin') or erp_supply.has_role('auditoria')
        or erp_supply.can_manage_work_profile(p.id,'ACTIVITY')
        or erp_supply.can_manage_work_profile(p.id,'DELIVERABLE')
      );
  else
    v_profiles:=array[v_actor];
  end if;

  if coalesce(array_length(v_profiles,1),0)=0 then
    v_profiles:=array[v_actor];
  end if;

  with
  selected_profiles as (
    select
      p.id,
      p.display_name,
      p.email,
      coalesce(array(
        select pr.role_code from erp_supply.profile_roles pr
        where pr.profile_id=p.id order by pr.role_code
      ),'{}'::text[]) roles
    from erp_supply.profiles p
    where p.organization_id=v_org and p.id=any(v_profiles) and p.active and not p.is_system
  ),
  occupation as (
    select
      p.id profile_id,
      p.display_name,
      p.email,
      p.roles,
      (m.metrics->>'scheduledBusinessSeconds')::bigint scheduled_seconds,
      (m.metrics->>'fixedProcessSeconds')::bigint fixed_seconds,
      (m.metrics->>'miscActivitySeconds')::bigint misc_seconds,
      (m.metrics->>'classifiedSeconds')::bigint classified_seconds,
      (m.metrics->>'overlapSeconds')::bigint overlap_seconds,
      (m.metrics->>'unclassifiedSeconds')::bigint unclassified_seconds,
      (m.metrics->>'occupationPct')::numeric occupation_pct
    from selected_profiles p
    cross join lateral(
      select erp_supply.work_profile_occupation_summary(p.id,v_start,v_end) metrics
    ) m
  ),
  task_rows as (
    select
      s.profile_id,
      s.task_id,
      t.order_id,
      t.step_code,
      ws.name step_name,
      ws.sort_order,
      t.completed_at,
      erp_supply.business_seconds_between(
        v_org,
        greatest(s.started_at,v_start),
        least(coalesce(s.ended_at,now()),v_end)
      )::bigint seconds
    from erp_supply.task_sessions s
    join erp_supply.order_tasks t on t.id=s.task_id
    join erp_supply.orders o on o.id=t.order_id
    join erp_supply.workflow_steps ws on ws.code=t.step_code
    where s.profile_id=any(v_profiles)
      and o.organization_id=v_org
      and not o.is_test
      and s.started_at<v_end
      and coalesce(s.ended_at,now())>v_start
  ),
  task_user as (
    select
      profile_id,
      count(*)::integer sessions,
      count(distinct task_id)::integer tasks_handled,
      count(distinct order_id)::integer orders_handled,
      count(distinct task_id) filter(where completed_at>=v_start and completed_at<v_end)::integer tasks_completed,
      coalesce(sum(seconds),0)::bigint process_touch_seconds,
      round((avg(seconds)/60.0)::numeric,1) avg_session_minutes,
      round((percentile_cont(.5) within group(order by seconds)/60.0)::numeric,1) median_session_minutes,
      round((percentile_cont(.9) within group(order by seconds)/60.0)::numeric,1) p90_session_minutes
    from task_rows
    where seconds>=0
    group by profile_id
  ),
  task_step as (
    select
      r.profile_id,
      p.display_name profile_name,
      r.step_code,
      r.step_name,
      r.sort_order,
      count(*)::integer sessions,
      count(distinct r.task_id)::integer tasks,
      coalesce(sum(r.seconds),0)::bigint seconds
    from task_rows r
    join selected_profiles p on p.id=r.profile_id
    group by r.profile_id,p.display_name,r.step_code,r.step_name,r.sort_order
  ),
  pause_rows as (
    select
      e.profile_id,
      coalesce(nullif(trim(p.reason_code),''),'OTHER') reason_code,
      erp_supply.business_seconds_between(
        v_org,
        greatest(p.started_at,v_start),
        least(coalesce(p.ended_at,now()),v_end)
      )::bigint seconds
    from erp_supply.work_execution_pauses p
    join erp_supply.work_executions e on e.id=p.execution_id
    where e.organization_id=v_org
      and e.profile_id=any(v_profiles)
      and p.started_at<v_end
      and coalesce(p.ended_at,now())>v_start
  ),
  pause_user as (
    select profile_id,count(*)::integer pauses,coalesce(sum(seconds),0)::bigint pause_seconds
    from pause_rows group by profile_id
  ),
  work_rows as (
    select
      e.id,
      e.profile_id,
      e.status,
      e.assignment_id,
      e.start_delay_seconds,
      e.deviation_ratio,
      c.activity_group,
      erp_supply.business_seconds_between(
        v_org,
        greatest(e.started_at,v_start),
        least(coalesce(e.ended_at,now()),v_end)
      )::bigint gross_business_seconds
    from erp_supply.work_executions e
    join erp_supply.work_activity_catalog c on c.id=e.catalog_id
    where e.organization_id=v_org
      and e.profile_id=any(v_profiles)
      and e.status<>'CANCELLED'
      and e.started_at<v_end
      and coalesce(e.ended_at,now())>v_start
  ),
  work_user as (
    select
      profile_id,
      count(*)::integer executions,
      count(*) filter(where status='COMPLETED')::integer completed,
      coalesce(sum(gross_business_seconds),0)::bigint gross_activity_seconds,
      round((avg(start_delay_seconds) filter(where assignment_id is not null)/60.0)::numeric,1) avg_start_delay_minutes,
      round((percentile_cont(.9) within group(order by start_delay_seconds) filter(where assignment_id is not null)/60.0)::numeric,1) p90_start_delay_minutes,
      round((100.0*count(*) filter(where assignment_id is not null and coalesce(start_delay_seconds,0)<=300)
        /nullif(count(*) filter(where assignment_id is not null),0))::numeric,1) start_adherence_pct,
      round(greatest(
        0::numeric,
        100.0-(avg(abs(deviation_ratio-1)) filter(where deviation_ratio is not null)*100.0)
      )::numeric,1) estimate_accuracy_pct
    from work_rows
    group by profile_id
  ),
  assignment_user as (
    select
      m.profile_id,
      count(*) filter(where m.completed_at>=v_start and m.completed_at<v_end)::integer completed_assignments,
      count(*) filter(where m.status not in('COMPLETED','CANCELLED'))::integer pending_assignments,
      round((
        100.0*count(*) filter(
          where m.completed_at>=v_start and m.completed_at<v_end
            and m.completed_at<=coalesce(a.due_at,a.planned_end,m.completed_at)
        )/nullif(count(*) filter(where m.completed_at>=v_start and m.completed_at<v_end),0)
      )::numeric,1) on_time_pct
    from erp_supply.work_assignment_members m
    join erp_supply.work_assignments a on a.id=m.assignment_id
    where m.profile_id=any(v_profiles) and a.organization_id=v_org and a.status<>'CANCELLED'
    group by m.profile_id
  ),
  people_metrics as (
    select
      o.profile_id "profileId",
      o.display_name "profileName",
      o.email,
      o.roles,
      o.scheduled_seconds "scheduledSeconds",
      o.fixed_seconds "fixedProcessSeconds",
      o.misc_seconds "miscActivitySeconds",
      o.classified_seconds "classifiedSeconds",
      o.overlap_seconds "overlapSeconds",
      o.unclassified_seconds "unclassifiedSeconds",
      coalesce(pu.pause_seconds,0) "explicitPauseSeconds",
      greatest(o.classified_seconds-coalesce(pu.pause_seconds,0),0)::bigint "effectiveSeconds",
      least(o.scheduled_seconds,greatest(o.unclassified_seconds+coalesce(pu.pause_seconds,0),0))::bigint "potentialDeadSeconds",
      o.occupation_pct "occupationPct",
      case when o.scheduled_seconds=0 then 0 else round((100.0*greatest(o.classified_seconds-coalesce(pu.pause_seconds,0),0)/o.scheduled_seconds)::numeric,1) end "effectiveOccupationPct",
      case when o.scheduled_seconds=0 then 0 else round((100.0*least(o.scheduled_seconds,greatest(o.unclassified_seconds+coalesce(pu.pause_seconds,0),0))/o.scheduled_seconds)::numeric,1) end "idlePct",
      coalesce(pu.pauses,0) "pauseCount",
      coalesce(tu.sessions,0) "taskSessions",
      coalesce(tu.tasks_handled,0) "tasksHandled",
      coalesce(tu.orders_handled,0) "ordersHandled",
      coalesce(tu.tasks_completed,0) "tasksCompleted",
      coalesce(tu.process_touch_seconds,0) "processTouchSeconds",
      coalesce(tu.avg_session_minutes,0) "avgSessionMinutes",
      coalesce(tu.median_session_minutes,0) "medianSessionMinutes",
      coalesce(tu.p90_session_minutes,0) "p90SessionMinutes",
      coalesce(wu.executions,0) "activityExecutions",
      coalesce(wu.completed,0) "activityCompleted",
      coalesce(wu.gross_activity_seconds,0) "activityGrossSeconds",
      greatest(coalesce(wu.gross_activity_seconds,0)-coalesce(pu.pause_seconds,0),0)::bigint "activityNetSeconds",
      coalesce(au.completed_assignments,0) "completedAssignments",
      coalesce(au.pending_assignments,0) "pendingAssignments",
      au.on_time_pct "onTimePct",
      wu.start_adherence_pct "startAdherencePct",
      coalesce(wu.avg_start_delay_minutes,0) "avgStartDelayMinutes",
      coalesce(wu.p90_start_delay_minutes,0) "p90StartDelayMinutes",
      wu.estimate_accuracy_pct "estimateAccuracyPct",
      case when greatest(o.classified_seconds-coalesce(pu.pause_seconds,0),0)=0 then 0 else round((coalesce(tu.tasks_completed,0)*3600.0/greatest(o.classified_seconds-coalesce(pu.pause_seconds,0),1))::numeric,2) end "tasksPerEffectiveHour",
      case when greatest(o.classified_seconds-coalesce(pu.pause_seconds,0),0)=0 then 0 else round(((coalesce(tu.sessions,0)+coalesce(wu.executions,0))*3600.0/greatest(o.classified_seconds-coalesce(pu.pause_seconds,0),1))::numeric,2) end "eventsPerEffectiveHour"
    from occupation o
    left join task_user tu on tu.profile_id=o.profile_id
    left join pause_user pu on pu.profile_id=o.profile_id
    left join work_user wu on wu.profile_id=o.profile_id
    left join assignment_user au on au.profile_id=o.profile_id
  ),
  buckets as (
    select
      d::date bucket_start,
      least((d::date+v_bucket_days),p_date_to+1)::date bucket_end
    from generate_series(p_date_from,p_date_to,make_interval(days=>v_bucket_days)) d
  ),
  daily_profile as (
    select
      b.bucket_start,
      b.bucket_end,
      p.id profile_id,
      p.display_name profile_name,
      (m.metrics->>'scheduledBusinessSeconds')::bigint scheduled_seconds,
      (m.metrics->>'fixedProcessSeconds')::bigint fixed_seconds,
      (m.metrics->>'miscActivitySeconds')::bigint misc_seconds,
      (m.metrics->>'classifiedSeconds')::bigint classified_seconds,
      (m.metrics->>'unclassifiedSeconds')::bigint unclassified_seconds,
      coalesce((
        select sum(erp_supply.business_seconds_between(
          v_org,
          greatest(pp.started_at,(b.bucket_start::timestamp at time zone v_tz)),
          least(coalesce(pp.ended_at,now()),(b.bucket_end::timestamp at time zone v_tz))
        ))::bigint
        from erp_supply.work_execution_pauses pp
        join erp_supply.work_executions ee on ee.id=pp.execution_id
        where ee.organization_id=v_org and ee.profile_id=p.id
          and pp.started_at<(b.bucket_end::timestamp at time zone v_tz)
          and coalesce(pp.ended_at,now())>(b.bucket_start::timestamp at time zone v_tz)
      ),0)::bigint pause_seconds
    from buckets b
    cross join selected_profiles p
    cross join lateral(
      select erp_supply.work_profile_occupation_summary(
        p.id,
        (b.bucket_start::timestamp at time zone v_tz),
        (b.bucket_end::timestamp at time zone v_tz)
      ) metrics
    ) m
  ),
  daily_scope as (
    select
      bucket_start "periodStart",
      bucket_end "periodEnd",
      sum(scheduled_seconds)::bigint "scheduledSeconds",
      sum(classified_seconds)::bigint "classifiedSeconds",
      sum(pause_seconds)::bigint "explicitPauseSeconds",
      sum(greatest(classified_seconds-pause_seconds,0))::bigint "effectiveSeconds",
      sum(least(scheduled_seconds,greatest(unclassified_seconds+pause_seconds,0)))::bigint "potentialDeadSeconds",
      case when sum(scheduled_seconds)=0 then 0 else round((100.0*sum(greatest(classified_seconds-pause_seconds,0))/sum(scheduled_seconds))::numeric,1) end "effectiveOccupationPct",
      case when sum(scheduled_seconds)=0 then 0 else round((100.0*sum(least(scheduled_seconds,greatest(unclassified_seconds+pause_seconds,0)))/sum(scheduled_seconds))::numeric,1) end "idlePct"
    from daily_profile
    group by bucket_start,bucket_end
  ),
  top_idle_days as (
    select
      d.profile_id "profileId",
      d.profile_name "profileName",
      d.bucket_start "periodStart",
      d.bucket_end "periodEnd",
      d.scheduled_seconds "scheduledSeconds",
      greatest(d.classified_seconds-d.pause_seconds,0)::bigint "effectiveSeconds",
      d.pause_seconds "explicitPauseSeconds",
      least(d.scheduled_seconds,greatest(d.unclassified_seconds+d.pause_seconds,0))::bigint "potentialDeadSeconds",
      case when d.scheduled_seconds=0 then 0 else round((100.0*least(d.scheduled_seconds,greatest(d.unclassified_seconds+d.pause_seconds,0))/d.scheduled_seconds)::numeric,1) end "idlePct"
    from daily_profile d
    where d.scheduled_seconds>0
    order by "potentialDeadSeconds" desc,"idlePct" desc
    limit 20
  ),
  pause_reason as (
    select
      reason_code reason,
      count(*)::integer events,
      coalesce(sum(seconds),0)::bigint seconds
    from pause_rows
    group by reason_code
  ),
  activity_group as (
    select
      r.profile_id "profileId",
      p.display_name "profileName",
      r.activity_group "group",
      count(*)::integer executions,
      coalesce(sum(r.gross_business_seconds),0)::bigint seconds
    from work_rows r
    join selected_profiles p on p.id=r.profile_id
    group by r.profile_id,p.display_name,r.activity_group
  )
  select jsonb_build_object(
    'mode',case when array_length(v_profiles,1)>1 then 'TEAM' else 'PERSON' end,
    'summary',jsonb_build_object(
      'people',(select count(*) from people_metrics),
      'scheduledSeconds',coalesce((select sum("scheduledSeconds") from people_metrics),0),
      'classifiedSeconds',coalesce((select sum("classifiedSeconds") from people_metrics),0),
      'effectiveSeconds',coalesce((select sum("effectiveSeconds") from people_metrics),0),
      'unclassifiedSeconds',coalesce((select sum("unclassifiedSeconds") from people_metrics),0),
      'explicitPauseSeconds',coalesce((select sum("explicitPauseSeconds") from people_metrics),0),
      'potentialDeadSeconds',coalesce((select sum("potentialDeadSeconds") from people_metrics),0),
      'fixedProcessSeconds',coalesce((select sum("fixedProcessSeconds") from people_metrics),0),
      'miscActivitySeconds',coalesce((select sum("miscActivitySeconds") from people_metrics),0),
      'processTouchSeconds',coalesce((select sum("processTouchSeconds") from people_metrics),0),
      'taskSessions',coalesce((select sum("taskSessions") from people_metrics),0),
      'tasksHandled',coalesce((select sum("tasksHandled") from people_metrics),0),
      'tasksCompleted',coalesce((select sum("tasksCompleted") from people_metrics),0),
      'activityExecutions',coalesce((select sum("activityExecutions") from people_metrics),0),
      'completedAssignments',coalesce((select sum("completedAssignments") from people_metrics),0),
      'effectiveOccupationPct',coalesce((select round((100.0*sum("effectiveSeconds")/nullif(sum("scheduledSeconds"),0))::numeric,1) from people_metrics),0),
      'idlePct',coalesce((select round((100.0*sum("potentialDeadSeconds")/nullif(sum("scheduledSeconds"),0))::numeric,1) from people_metrics),0),
      'peopleWithActivity',(select count(*) from people_metrics where "classifiedSeconds">0),
      'peopleWithoutActivity',(select count(*) from people_metrics where "classifiedSeconds"=0),
      'openTaskSessions',(select count(*) from erp_supply.task_sessions s where s.profile_id=any(v_profiles) and s.ended_at is null),
      'openActivityExecutions',(select count(*) from erp_supply.work_executions e where e.organization_id=v_org and e.profile_id=any(v_profiles) and e.ended_at is null and e.status<>'CANCELLED')
    ),
    'profiles',(
      select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name,'roles',p.roles) order by p.display_name),'[]'::jsonb)
      from selected_profiles p
    ),
    'people',(
      select coalesce(jsonb_agg(to_jsonb(p) order by p."profileName"),'[]'::jsonb) from people_metrics p
    ),
    'daily',(
      select coalesce(jsonb_agg(to_jsonb(d) order by d."periodStart"),'[]'::jsonb) from daily_scope d
    ),
    'topIdlePeriods',(
      select coalesce(jsonb_agg(to_jsonb(d) order by d."potentialDeadSeconds" desc),'[]'::jsonb) from top_idle_days d
    ),
    'pauseReasons',(
      select coalesce(jsonb_agg(to_jsonb(p) order by p.seconds desc,p.events desc),'[]'::jsonb) from pause_reason p
    ),
    'stepContribution',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'profileId',s.profile_id,
        'profileName',s.profile_name,
        'stepCode',s.step_code,
        'stepName',s.step_name,
        'sortOrder',s.sort_order,
        'sessions',s.sessions,
        'tasks',s.tasks,
        'seconds',s.seconds
      ) order by s.seconds desc,s.sort_order),'[]'::jsonb) from task_step s
    ),
    'activityGroups',(
      select coalesce(jsonb_agg(to_jsonb(a) order by a.seconds desc),'[]'::jsonb) from activity_group a
    ),
    'range',jsonb_build_object(
      'from',p_date_from,
      'to',p_date_to,
      'days',(p_date_to-p_date_from)+1,
      'trendGranularity',case when v_bucket_days=1 then 'DAY' else 'WEEK' end,
      'bucketDays',v_bucket_days
    ),
    'generatedAt',now(),
    'version','11.13.0'
  ) into v_result;

  return v_result;
end;
$$;

revoke execute on function public.erp_x_vsm_people(date,date,uuid) from public,anon;
grant execute on function public.erp_x_vsm_people(date,date,uuid) to authenticated;
