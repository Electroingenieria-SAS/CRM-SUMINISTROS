-- CRM Suministros V11.35.0
-- Cronograma unificado y detalle de evidencia bajo demanda.
-- Optimización: cero tablas nuevas; reutiliza assignments, executions y evidence.
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
          a.status,
          a.priority,
          a.planned_start "plannedStart",
          a.planned_end "plannedEnd",
          a.due_at "dueAt",
          a.estimated_minutes "estimatedMinutes",
          a.catalog_id "catalogId",
          c.name "catalogName",
          p.id "profileId",
          p.display_name "profileName",
          m.id "memberId",
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
          coalesce(ev.has_photo,false) "hasPhoto"
        from erp_supply.work_executions e
        join erp_supply.profiles p on p.id=e.profile_id
        join erp_supply.work_activity_catalog c on c.id=e.catalog_id
        left join lateral(
          select
            count(*)::integer evidence_count,
            bool_or(w.evidence_type in('BEFORE_PHOTO','AFTER_PHOTO','FINAL_PHOTO')) has_photo
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
      'logistics',v_can_logistics,
      'management',v_is_management or v_is_super,
      'deliverables',v_is_management or v_is_super,
      'approvals',erp_supply.work_can_approve_scope('LOGISTICS') or erp_supply.work_can_approve_scope('MANAGEMENT'),
      'all',v_is_super
    ),
    'serverTime',now(),
    'version','11.35.0'
  );
end;
$$;

revoke all on function public.erp_x_work_planner(date,date) from public,anon;
grant execute on function public.erp_x_work_planner(date,date) to authenticated;

create or replace function public.erp_x_work_planner_detail(
  p_assignment_id uuid default null,
  p_execution_id uuid default null,
  p_profile_id uuid default null
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
  v_can_team boolean:=v_roles && array['jefe_logistica','lider_logistica','coordinador_logistico','gerencia','super_admin']::text[];
  v_is_super boolean:='super_admin'=any(v_roles);
  v_is_management boolean:='gerencia'=any(v_roles);
  v_exec erp_supply.work_executions%rowtype;
  v_profile_id uuid;
  v_kind text;
  v_assignment erp_supply.work_assignments%rowtype;
begin
  if p_execution_id is null and p_assignment_id is null then
    raise exception 'No se recibió la actividad del cronograma';
  end if;

  if p_execution_id is not null then
    select * into v_exec
    from erp_supply.work_executions
    where id=p_execution_id
      and organization_id=v_org;

    if not found then
      raise exception 'Actividad no disponible';
    end if;

    select c.activity_kind into v_kind
    from erp_supply.work_activity_catalog c
    where c.id=v_exec.catalog_id;

    if not (
      v_exec.profile_id=v_actor
      or (
        v_can_team
        and (
          v_is_super
          or v_is_management
          or erp_supply.can_manage_work_profile(v_exec.profile_id,coalesce(v_kind,'ACTIVITY'))
        )
      )
    ) then
      raise exception 'No autorizado para consultar esta actividad' using errcode='42501';
    end if;

    if v_exec.assignment_id is not null then
      select * into v_assignment
      from erp_supply.work_assignments
      where id=v_exec.assignment_id
        and organization_id=v_org;
    end if;

    return (
      select jsonb_build_object(
        'type','EXECUTION',
        'id',e.id,
        'executionId',e.id,
        'assignmentId',e.assignment_id,
        'title',e.title_snapshot,
        'description',coalesce(a.description,c.description),
        'kind',c.activity_kind,
        'status',e.status,
        'source',e.source,
        'profileId',e.profile_id,
        'profileName',p.display_name,
        'catalogName',c.name,
        'plannedStart',a.planned_start,
        'plannedEnd',a.planned_end,
        'dueAt',a.due_at,
        'startedAt',e.started_at,
        'endedAt',e.ended_at,
        'activeSeconds',coalesce(e.active_seconds,0),
        'pausedSeconds',coalesce(e.paused_seconds,0),
        'resultNote',e.result_note,
        'evidence',(
          select coalesce(jsonb_agg(
            jsonb_build_object(
              'id',z.id,
              'type',z.evidence_type,
              'fileName',z.file_name,
              'mimeType',z.mime_type,
              'sizeBytes',z.size_bytes,
              'webViewLink',z.web_view_link,
              'externalValue',z.external_value,
              'note',z.note,
              'preview',case
                when jsonb_typeof(z.metadata->'preview')='object' then z.metadata->'preview'
                else null
              end,
              'createdAt',z.created_at
            )
            order by z.sort_order,z.created_at desc
          ),'[]'::jsonb)
          from(
            select
              w.*,
              case
                when w.evidence_type in('FINAL_PHOTO','AFTER_PHOTO') then 0
                when w.evidence_type='BEFORE_PHOTO' then 1
                else 2
              end sort_order
            from erp_supply.work_evidence w
            where w.execution_id=e.id
            order by sort_order,w.created_at desc
            limit 8
          ) z
        ),
        'version','11.35.0'
      )
      from erp_supply.work_executions e
      join erp_supply.profiles p on p.id=e.profile_id
      join erp_supply.work_activity_catalog c on c.id=e.catalog_id
      left join erp_supply.work_assignments a on a.id=e.assignment_id
      where e.id=v_exec.id
    );
  end if;

  select * into v_assignment
  from erp_supply.work_assignments
  where id=p_assignment_id
    and organization_id=v_org;

  if not found then
    raise exception 'Asignación no disponible';
  end if;

  v_profile_id:=coalesce(
    p_profile_id,
    (
      select m.profile_id
      from erp_supply.work_assignment_members m
      where m.assignment_id=v_assignment.id
        and m.profile_id=v_actor
      limit 1
    ),
    (
      select m.profile_id
      from erp_supply.work_assignment_members m
      where m.assignment_id=v_assignment.id
      order by m.assigned_at
      limit 1
    )
  );

  if v_profile_id is null then
    raise exception 'La asignación no tiene responsable';
  end if;

  if not (
    v_profile_id=v_actor
    or (
      v_can_team
      and (
        v_is_super
        or v_is_management
        or erp_supply.can_manage_work_profile(v_profile_id,v_assignment.assignment_kind)
      )
    )
  ) then
    raise exception 'No autorizado para consultar esta asignación' using errcode='42501';
  end if;

  return (
    select jsonb_build_object(
      'type','ASSIGNMENT',
      'id',a.id,
      'assignmentId',a.id,
      'executionId',e.id,
      'title',a.title,
      'description',a.description,
      'kind',a.assignment_kind,
      'status',coalesce(e.status,m.status),
      'priority',a.priority,
      'profileId',p.id,
      'profileName',p.display_name,
      'catalogName',c.name,
      'plannedStart',a.planned_start,
      'plannedEnd',a.planned_end,
      'dueAt',a.due_at,
      'estimatedMinutes',a.estimated_minutes,
      'evidencePolicy',a.evidence_policy,
      'requestOrigin',a.request_origin,
      'requestReason',a.request_reason,
      'approvalStatus',a.approval_status,
      'approvalScope',a.approval_scope,
      'startedAt',e.started_at,
      'endedAt',e.ended_at,
      'activeSeconds',coalesce(e.active_seconds,0),
      'pausedSeconds',coalesce(e.paused_seconds,0),
      'participants',(
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'profileId',mp.id,
            'profileName',mp.display_name,
            'status',mm.status
          )
          order by mp.display_name
        ),'[]'::jsonb)
        from erp_supply.work_assignment_members mm
        join erp_supply.profiles mp on mp.id=mm.profile_id
        where mm.assignment_id=a.id
      ),
      'evidence',case
        when e.id is null then '[]'::jsonb
        else (
          select coalesce(jsonb_agg(
            jsonb_build_object(
              'id',z.id,
              'type',z.evidence_type,
              'fileName',z.file_name,
              'mimeType',z.mime_type,
              'sizeBytes',z.size_bytes,
              'webViewLink',z.web_view_link,
              'externalValue',z.external_value,
              'note',z.note,
              'preview',case
                when jsonb_typeof(z.metadata->'preview')='object' then z.metadata->'preview'
                else null
              end,
              'createdAt',z.created_at
            )
            order by z.sort_order,z.created_at desc
          ),'[]'::jsonb)
          from(
            select
              w.*,
              case
                when w.evidence_type in('FINAL_PHOTO','AFTER_PHOTO') then 0
                when w.evidence_type='BEFORE_PHOTO' then 1
                else 2
              end sort_order
            from erp_supply.work_evidence w
            where w.execution_id=e.id
            order by sort_order,w.created_at desc
            limit 8
          ) z
        )
      end,
      'version','11.35.0'
    )
    from erp_supply.work_assignments a
    join erp_supply.work_assignment_members m
      on m.assignment_id=a.id
     and m.profile_id=v_profile_id
    join erp_supply.profiles p on p.id=m.profile_id
    left join erp_supply.work_activity_catalog c on c.id=a.catalog_id
    left join lateral(
      select x.*
      from erp_supply.work_executions x
      where x.assignment_id=a.id
        and x.profile_id=m.profile_id
      order by x.started_at desc
      limit 1
    ) e on true
    where a.id=v_assignment.id
  );
end;
$$;

revoke all on function public.erp_x_work_planner_detail(uuid,uuid,uuid) from public,anon;
grant execute on function public.erp_x_work_planner_detail(uuid,uuid,uuid) to authenticated;

comment on function public.erp_x_work_planner(date,date)
is 'V11.35.0: cronograma compacto, unifica asignaciones y ejecuciones sin tabla materializada adicional.';

comment on function public.erp_x_work_planner_detail(uuid,uuid,uuid)
is 'V11.35.0: detalle de cronograma bajo demanda para minimizar payload inicial y traer evidencia solo al abrir una tarjeta.';

notify pgrst,'reload schema';
commit;
