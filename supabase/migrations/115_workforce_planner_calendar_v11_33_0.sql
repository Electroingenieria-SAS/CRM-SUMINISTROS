-- CRM Suministros V11.33.0
-- Cronograma laboral eficiente: una sola respuesta planner + guardia física de jornada.
-- Esta migración se versiona ahora, pero NO se aplica a producción en esta fase.
begin;

create or replace function erp_supply.validate_work_assignment_business_window()
returns trigger
language plpgsql
security invoker
set search_path=erp_supply,public,auth,pg_catalog
as $$
declare
  v_raw_seconds bigint;
  v_business_seconds bigint;
begin
  if new.status='PUBLISHED'
     and new.assignment_kind='ACTIVITY'
     and new.planned_start is not null
     and new.planned_end is not null then
    v_raw_seconds:=greatest(0,extract(epoch from(new.planned_end-new.planned_start))::bigint);
    v_business_seconds:=erp_supply.business_seconds_between(new.organization_id,new.planned_start,new.planned_end);
    if v_business_seconds+1<v_raw_seconds then
      raise exception 'OUTSIDE_WORKING_TIME: la actividad invade almuerzo, fin de semana, festivo o tiempo fuera de jornada'
        using errcode='22023';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function erp_supply.validate_work_assignment_business_window() from public,anon,authenticated;

drop trigger if exists trg_work_assignment_business_window on erp_supply.work_assignments;
create trigger trg_work_assignment_business_window
before insert or update of status,assignment_kind,planned_start,planned_end
on erp_supply.work_assignments
for each row execute function erp_supply.validate_work_assignment_business_window();

create or replace function public.erp_x_work_planner(p_from date,p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path=erp_supply,public,auth,pg_catalog
as $$
declare
  v_actor uuid:=erp_supply.require_profile();
  v_org uuid:=erp_supply.current_org_id();
  v_from date:=coalesce(p_from,current_date-date_part('dow',current_date)::int);
  v_to date:=coalesce(p_to,v_from+4);
  v_tz text:=coalesce((select timezone from erp_supply.organizations where id=v_org),'America/Bogota');
  v_start timestamptz:=(v_from::timestamp at time zone v_tz);
  v_end timestamptz:=((v_to+1)::timestamp at time zone v_tz);
begin
  if v_to<v_from or v_to-v_from>62 then raise exception 'Rango de planificación inválido'; end if;
  if not (erp_supply.has_role('super_admin') or erp_supply.has_role('jefe_logistica') or erp_supply.has_role('lider_logistica') or erp_supply.has_role('gerencia')) then
    raise exception 'No tienes permisos de planificación' using errcode='42501';
  end if;

  return jsonb_build_object(
    'from',v_from,
    'to',v_to,
    'people',(
      select coalesce(
        jsonb_agg(
          person || jsonb_build_object('activeStatus',active_exec.status)
          order by person->>'name'
        ),
        '[]'::jsonb
      )
      from jsonb_array_elements(public.erp_x_work_people(null)) person
      left join lateral(
        select e.status
        from erp_supply.work_executions e
        where e.organization_id=v_org
          and e.profile_id=(person->>'id')::uuid
          and e.status in('IN_PROGRESS','PAUSED')
        order by e.started_at desc
        limit 1
      ) active_exec on true
    ),
    'assignments',(
      select coalesce(jsonb_agg(to_jsonb(x) order by x."plannedStart" nulls last,x."dueAt" nulls last,x.title),'[]'::jsonb)
      from(
        select a.id,a.series_id "seriesId",a.title,a.description,a.assignment_kind "kind",a.status,a.priority,
               a.planned_start "plannedStart",a.planned_end "plannedEnd",a.due_at "dueAt",a.estimated_minutes "estimatedMinutes",
               a.evidence_policy "evidencePolicy",a.acceptance_required "acceptanceRequired",a.catalog_id "catalogId",c.name "catalogName",
               p.id "profileId",p.display_name "profileName",m.id "memberId",m.status "memberStatus",a.assigned_by "assignedBy",
               a.request_origin "requestOrigin",a.request_reason "requestReason",a.approval_status "approvalStatus",a.approval_scope "approvalScope",
               a.recurrence,a.metadata
        from erp_supply.work_assignments a
        join erp_supply.work_assignment_members m on m.assignment_id=a.id
        join erp_supply.profiles p on p.id=m.profile_id
        left join erp_supply.work_activity_catalog c on c.id=a.catalog_id
        where a.organization_id=v_org
          and a.status='PUBLISHED'
          and erp_supply.can_manage_work_profile(p.id,a.assignment_kind)
          and (
            (a.planned_start is not null and a.planned_start<v_end and coalesce(a.planned_end,a.planned_start+interval '1 minute')>v_start)
            or
            (a.planned_start is null and a.due_at>=v_start and a.due_at<v_end)
          )
      ) x
    ),
    'calendar',jsonb_build_object(
      'timezone',v_tz,
      'segments',(
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'isoWeekday',s.iso_weekday,
              'startTime',to_char(s.start_time,'HH24:MI'),
              'endTime',to_char(s.end_time,'HH24:MI')
            )
            order by s.iso_weekday,s.start_time
          ),
          '[]'::jsonb
        )
        from erp_supply.work_calendars c
        join erp_supply.work_calendar_segments s on s.calendar_id=c.id
        where c.organization_id=v_org and c.active
      ),
      'holidays',(
        select coalesce(
          jsonb_agg(
            jsonb_build_object('date',h.holiday_date,'name',h.name)
            order by h.holiday_date
          ),
          '[]'::jsonb
        )
        from erp_supply.holidays h
        where h.organization_id=v_org
          and h.holiday_date between v_from and v_to
      )
    ),
    'permissions',jsonb_build_object(
      'logistics',erp_supply.has_role('jefe_logistica') or erp_supply.has_role('lider_logistica') or erp_supply.has_role('super_admin'),
      'management',erp_supply.has_role('gerencia') or erp_supply.has_role('super_admin'),
      'deliverables',erp_supply.has_role('gerencia') or erp_supply.has_role('super_admin'),
      'approvals',erp_supply.work_can_approve_scope('LOGISTICS') or erp_supply.work_can_approve_scope('MANAGEMENT'),
      'all',erp_supply.has_role('super_admin')
    ),
    'serverTime',now(),
    'version','11.33.0'
  );
end;
$$;

revoke all on function public.erp_x_work_planner(date,date) from public,anon;
grant execute on function public.erp_x_work_planner(date,date) to authenticated;

commit;
