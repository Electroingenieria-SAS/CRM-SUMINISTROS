-- CRM Suministros V11.36.0
-- Feed de cronograma orientado a visualización inmediata.
-- Objetivos:
--   * cero tablas nuevas;
--   * cero índices nuevos;
--   * una sola pasada sobre work_evidence por ejecución;
--   * entregar únicamente evidenceId + driveFileId de la primera foto;
--   * mantener archivos y metadata completa fuera del payload inicial.
begin;

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
  v_roles text[]:=erp_supply.current_roles();
  v_from date:=coalesce(p_from,current_date-date_part('dow',current_date)::int);
  v_to date:=coalesce(p_to,v_from+4);
  v_tz text:=coalesce((select timezone from erp_supply.organizations where id=v_org),'America/Bogota');
  v_start timestamptz:=(v_from::timestamp at time zone v_tz);
  v_end timestamptz:=((v_to+1)::timestamp at time zone v_tz);
  v_can_team boolean:=v_roles && array['jefe_logistica','lider_logistica','coordinador_logistico','gerencia','super_admin']::text[];
  v_is_super boolean:='super_admin'=any(v_roles);
  v_is_management boolean:='gerencia'=any(v_roles);
  v_can_logistics boolean:=v_roles && array['jefe_logistica','lider_logistica','coordinador_logistico','super_admin']::text[];
begin
  if v_to<v_from or v_to-v_from>62 then
    raise exception 'Rango de planificación inválido';
  end if;

  return jsonb_build_object(
    'from',v_from,
    'to',v_to,
    'people',(
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id',p.id,
          'name',p.display_name,
          'activeTitle',ae.title_snapshot,
          'activeStartedAt',ae.started_at,
          'activeStatus',ae.status
        )
        order by p.display_name
      ),'[]'::jsonb)
      from erp_supply.profiles p
      left join lateral(
        select e.title_snapshot,e.started_at,e.status
        from erp_supply.work_executions e
        where e.organization_id=v_org
          and e.profile_id=p.id
          and e.status in('IN_PROGRESS','PAUSED')
        order by e.started_at desc
        limit 1
      ) ae on true
      where p.organization_id=v_org
        and p.active
        and (
          p.id=v_actor
          or (
            v_can_team
            and (
              v_is_super
              or v_is_management
              or erp_supply.can_manage_work_profile(p.id,'ACTIVITY')
              or erp_supply.can_manage_work_profile(p.id,'DELIVERABLE')
            )
          )
        )
    ),
    'assignments',(
      select coalesce(jsonb_agg(to_jsonb(x) order by x."plannedStart" nulls last,x."dueAt" nulls last,x.title),'[]'::jsonb)
      from(
        select
          a.id,
          a.title,
          a.assignment_kind "kind",
          a.priority,
          a.planned_start "plannedStart",
          a.planned_end "plannedEnd",
          a.due_at "dueAt",
          a.estimated_minutes "estimatedMinutes",
          a.catalog_id "catalogId",
          c.name "catalogName",
          p.id "profileId",
          p.display_name "profileName",
          m.status "memberStatus"
        from erp_supply.work_assignments a
        join erp_supply.work_assignment_members m on m.assignment_id=a.id
        join erp_supply.profiles p on p.id=m.profile_id
        left join erp_supply.work_activity_catalog c on c.id=a.catalog_id
        where a.organization_id=v_org
          and a.status='PUBLISHED'
          and (
            p.id=v_actor
            or (
              v_can_team
              and (
                v_is_super
                or v_is_management
                or erp_supply.can_manage_work_profile(p.id,a.assignment_kind)
              )
            )
          )
          and (
            (a.planned_start is not null and a.planned_start<v_end and coalesce(a.planned_end,a.planned_start+interval '1 minute')>v_start)
            or
            (a.planned_start is null and a.due_at>=v_start and a.due_at<v_end)
          )
      ) x
    ),
    'executions',(
      select coalesce(jsonb_agg(to_jsonb(x) order by x."startedAt",x.title),'[]'::jsonb)
      from(
        select
          e.id,
          e.assignment_id "assignmentId",
          e.catalog_id "catalogId",
          e.profile_id "profileId",
          p.display_name "profileName",
          e.title_snapshot title,
          c.name "catalogName",
          c.activity_kind "kind",
          e.source,
          e.status,
          e.started_at "startedAt",
          e.ended_at "endedAt",
          coalesce(e.active_seconds,0) "activeSeconds",
          coalesce(ev.evidence_count,0) "evidenceCount",
          coalesce(ev.has_photo,false) "hasPhoto",
          ev.preview_evidence_id "previewEvidenceId",
          ev.preview_drive_file_id "previewDriveFileId"
        from erp_supply.work_executions e
        join erp_supply.profiles p on p.id=e.profile_id
        join erp_supply.work_activity_catalog c on c.id=e.catalog_id
        left join lateral(
          select
            count(*)::integer evidence_count,
            bool_or(w.evidence_type in('BEFORE_PHOTO','AFTER_PHOTO','FINAL_PHOTO')) has_photo,
            (
              array_agg(
                w.id
                order by
                  case
                    when w.evidence_type in('FINAL_PHOTO','AFTER_PHOTO') then 0
                    when w.evidence_type='BEFORE_PHOTO' then 1
                    else 2
                  end,
                  w.created_at desc
              )
              filter (
                where w.evidence_type in('BEFORE_PHOTO','AFTER_PHOTO','FINAL_PHOTO')
                  and w.drive_file_id is not null
              )
            )[1] preview_evidence_id,
            (
              array_agg(
                w.drive_file_id
                order by
                  case
                    when w.evidence_type in('FINAL_PHOTO','AFTER_PHOTO') then 0
                    when w.evidence_type='BEFORE_PHOTO' then 1
                    else 2
                  end,
                  w.created_at desc
              )
              filter (
                where w.evidence_type in('BEFORE_PHOTO','AFTER_PHOTO','FINAL_PHOTO')
                  and w.drive_file_id is not null
              )
            )[1] preview_drive_file_id
          from erp_supply.work_evidence w
          where w.execution_id=e.id
        ) ev on true
        where e.organization_id=v_org
          and e.started_at<v_end
          and coalesce(e.ended_at,now())>=v_start
          and (
            e.profile_id=v_actor
            or (
              v_can_team
              and (
                v_is_super
                or v_is_management
                or erp_supply.can_manage_work_profile(e.profile_id,c.activity_kind)
              )
            )
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
          and h.holiday_date between v_from-14 and v_to+14
      )
    ),
    'permissions',jsonb_build_object(
      'scope',case when v_can_team then 'TEAM' else 'SELF' end,
      'canViewTeam',v_can_team,
      'canPlanTeam',v_can_team,
      'logistics',v_can_logistics,
      'management',v_is_management or v_is_super,
      'deliverables',v_is_management or v_is_super,
      'approvals',erp_supply.work_can_approve_scope('LOGISTICS') or erp_supply.work_can_approve_scope('MANAGEMENT'),
      'all',v_is_super
    ),
    'serverTime',now(),
    'version','11.36.0'
  );
end;
$$;

revoke all on function public.erp_x_work_planner(date,date) from public,anon;
grant execute on function public.erp_x_work_planner(date,date) to authenticated;

comment on function public.erp_x_work_planner(date,date)
is 'V11.36.0: feed compacto del cronograma con referencia mínima de primera evidencia para precarga inmediata; sin archivos ni metadata pesada.';

notify pgrst,'reload schema';
commit;
