-- CRM Suministros V11.38.0
-- Trazabilidad automática de trabajo operativo sin duplicar datos.
-- Fuente canónica:
--   * task_sessions para procesos de pedido;
--   * cut_executions para Corte;
--   * work_executions para actividades manuales/espontáneas.
-- No crea tablas ni índices nuevos.
begin;

update erp_supply.profiles
set preferences=coalesce(preferences,'{}'::jsonb)||jsonb_build_object(
  'workforceSpecialTreatment',true,
  'workforceSpecialTreatmentLabel','Tratamiento especial'
),
updated_at=now()
where lower(coalesce(email,''))='a.zorri@ei.com.co'
   or lower(regexp_replace(coalesce(display_name,''),'\\s+',' ','g'))='alexander zorrilla';

create or replace function erp_supply.workforce_special_treatment(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path=erp_supply,public,auth,pg_catalog
as $$
  select coalesce(lower(p.preferences->>'workforceSpecialTreatment')='true',false)
  from erp_supply.profiles p
  where p.id=p_profile_id
$$;

revoke all on function erp_supply.workforce_special_treatment(uuid) from public,anon;

create or replace function erp_supply.work_profile_occupation_summary(
  p_profile_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path=erp_supply,public,auth,pg_catalog
as $$
declare
  v_org uuid:=erp_supply.current_org_id();
  v_sched bigint:=0;
  v_fixed bigint:=0;
  v_misc bigint:=0;
  v_total bigint:=0;
  v_overlap bigint:=0;
begin
  if erp_supply.workforce_special_treatment(p_profile_id) then
    return jsonb_build_object(
      'scheduledBusinessSeconds',0,
      'fixedProcessSeconds',0,
      'miscActivitySeconds',0,
      'classifiedSeconds',0,
      'overlapSeconds',0,
      'unclassifiedSeconds',0,
      'occupationPct',0,
      'fixedPct',0,
      'miscPct',0,
      'specialTreatment',true,
      'specialTreatmentLabel','Tratamiento especial'
    );
  end if;

  v_sched:=erp_supply.business_seconds_between(v_org,p_start,p_end);
  v_fixed:=erp_supply.work_source_business_seconds(p_profile_id,p_start,p_end,'ERP');
  v_misc:=erp_supply.work_source_business_seconds(p_profile_id,p_start,p_end,'ACTIVITY');
  v_total:=erp_supply.work_classified_business_seconds(p_profile_id,p_start,p_end);
  v_overlap:=greatest(v_fixed+v_misc-v_total,0);

  return jsonb_build_object(
    'scheduledBusinessSeconds',v_sched,
    'fixedProcessSeconds',v_fixed,
    'miscActivitySeconds',v_misc,
    'classifiedSeconds',v_total,
    'overlapSeconds',v_overlap,
    'unclassifiedSeconds',greatest(v_sched-v_total,0),
    'occupationPct',case when v_sched=0 then 0 else round((100.0*v_total/v_sched)::numeric,1) end,
    'fixedPct',case when v_sched=0 then 0 else round((100.0*v_fixed/v_sched)::numeric,1) end,
    'miscPct',case when v_sched=0 then 0 else round((100.0*v_misc/v_sched)::numeric,1) end,
    'specialTreatment',false
  );
end;
$$;

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
          'specialTreatment',erp_supply.workforce_special_treatment(p.id),
          'specialTreatmentLabel',case when erp_supply.workforce_special_treatment(p.id) then 'Tratamiento especial' else null end,
          'activeTitle',case when erp_supply.workforce_special_treatment(p.id) then null else ae.title end,
          'activeStartedAt',case when erp_supply.workforce_special_treatment(p.id) then null else ae.started_at end,
          'activeStatus',case when erp_supply.workforce_special_treatment(p.id) then 'SPECIAL' else ae.status end,
          'activeSource',case when erp_supply.workforce_special_treatment(p.id) then 'SPECIAL' else ae.source end
        )
        order by p.display_name
      ),'[]'::jsonb)
      from erp_supply.profiles p
      left join lateral(
        select z.title,z.started_at,z.status,z.source
        from(
          select
            e.title_snapshot title,
            e.started_at,
            e.status,
            'ACTIVITY'::text source
          from erp_supply.work_executions e
          where e.organization_id=v_org
            and e.profile_id=p.id
            and e.status in('IN_PROGRESS','PAUSED')

          union all

          select
            'Pedido '||o.order_number||' · '||ws.name,
            s.started_at,
            case when t.status in('WAITING','BLOCKED') then 'PAUSED' else 'IN_PROGRESS' end,
            'ORDER_TASK'::text
          from erp_supply.task_sessions s
          join erp_supply.order_tasks t on t.id=s.task_id
          join erp_supply.orders o on o.id=t.order_id
          join erp_supply.workflow_steps ws on ws.code=t.step_code
          where o.organization_id=v_org
            and not coalesce(o.is_test,false)
            and s.profile_id=p.id
            and s.ended_at is null

          union all

          select
            'Corte · '||coalesce(nullif(c.reference,''),nullif(c.sku,''),'Referencia'),
            c.started_at,
            case when c.status='PAUSED' then 'PAUSED' else 'IN_PROGRESS' end,
            'CUT_EXECUTION'::text
          from erp_supply.cut_executions c
          where c.organization_id=v_org
            and c.started_by=p.id
            and c.completed_at is null
            and c.status not in('CANCELLED','COMPLETED')
        ) z
        order by z.started_at desc
        limit 1
      ) ae on not erp_supply.workforce_special_treatment(p.id)
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
          and not erp_supply.workforce_special_treatment(p.id)
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
          and not erp_supply.workforce_special_treatment(e.profile_id)
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

    'operationalExecutions',(
      select coalesce(jsonb_agg(to_jsonb(x) order by x."startedAt",x.title),'[]'::jsonb)
      from(
        select
          ('order-session:'||s.id::text) id,
          'ORDER_TASK'::text "sourceType",
          'ORDER_TASK'::text source,
          s.id "taskSessionId",
          null::uuid "cutExecutionId",
          t.id "orderTaskId",
          o.id "orderId",
          o.order_number "orderNumber",
          t.step_code "stepCode",
          ws.name "stepName",
          ('Pedido '||o.order_number||' · '||ws.name) title,
          'ORDER_PROCESS'::text kind,
          s.profile_id "profileId",
          p.display_name "profileName",
          case
            when s.ended_at is null then 'IN_PROGRESS'
            when t.status in('WAITING','BLOCKED') then 'PAUSED'
            else 'COMPLETED'
          end status,
          t.status "processStatus",
          s.started_at "startedAt",
          s.ended_at "endedAt",
          case
            when s.ended_at is null then greatest(0,erp_supply.business_seconds_between(v_org,s.started_at,now()))
            else coalesce(s.business_seconds,erp_supply.business_seconds_between(v_org,s.started_at,s.ended_at))
          end "activeSeconds",
          s.note description,
          o.current_step_code "currentStep",
          o.status "orderStatus"
        from erp_supply.task_sessions s
        join erp_supply.order_tasks t on t.id=s.task_id
        join erp_supply.orders o on o.id=t.order_id
        join erp_supply.workflow_steps ws on ws.code=t.step_code
        join erp_supply.profiles p on p.id=s.profile_id
        where o.organization_id=v_org
          and not coalesce(o.is_test,false)
          and not erp_supply.workforce_special_treatment(s.profile_id)
          and s.started_at<v_end
          and coalesce(s.ended_at,now())>=v_start
          and (
            s.profile_id=v_actor
            or (
              v_can_team
              and (
                v_is_super
                or v_is_management
                or erp_supply.can_manage_work_profile(s.profile_id,'ACTIVITY')
              )
            )
          )
          and not (
            t.step_code='CORTE'
            and exists(
              select 1
              from erp_supply.cut_requirements cr
              join erp_supply.cut_execution_requirements cer on cer.cut_requirement_id=cr.id
              where cr.task_id=t.id
            )
          )

        union all

        select
          ('cut-execution:'||c.id::text) id,
          'CUT_EXECUTION'::text "sourceType",
          'CUT_EXECUTION'::text source,
          null::uuid "taskSessionId",
          c.id "cutExecutionId",
          null::uuid "orderTaskId",
          ord.order_id "orderId",
          ord.order_numbers "orderNumber",
          'CORTE'::text "stepCode",
          'Corte'::text "stepName",
          case
            when coalesce(ord.order_count,0)=1
              then 'Pedido '||coalesce(ord.order_numbers,'—')||' · Corte'
            when coalesce(ord.order_count,0)>1
              then 'Corte · '||coalesce(nullif(c.reference,''),nullif(c.sku,''),'Referencia')||' · '||ord.order_count||' pedidos'
            else 'Corte · '||coalesce(nullif(c.reference,''),nullif(c.sku,''),'Referencia')
          end title,
          'ORDER_PROCESS'::text kind,
          c.started_by "profileId",
          p.display_name "profileName",
          case
            when c.completed_at is not null or c.status='COMPLETED' then 'COMPLETED'
            when c.status='PAUSED' then 'PAUSED'
            else 'IN_PROGRESS'
          end status,
          c.status "processStatus",
          c.started_at "startedAt",
          c.completed_at "endedAt",
          case
            when c.completed_at is null then greatest(0,erp_supply.business_seconds_between(v_org,c.started_at,now()))
            else greatest(0,erp_supply.business_seconds_between(v_org,c.started_at,c.completed_at))
          end "activeSeconds",
          c.description,
          'CORTE'::text "currentStep",
          c.status "orderStatus"
        from erp_supply.cut_executions c
        join erp_supply.profiles p on p.id=c.started_by
        left join lateral(
          select
            count(distinct cer.order_id)::integer order_count,
            case when count(distinct cer.order_id)=1 then min(cer.order_id::text)::uuid else null end order_id,
            string_agg(distinct o.order_number,', ' order by o.order_number) order_numbers
          from erp_supply.cut_execution_requirements cer
          join erp_supply.orders o on o.id=cer.order_id
          where cer.execution_id=c.id
        ) ord on true
        where c.organization_id=v_org
          and c.status<>'CANCELLED'
          and c.started_by is not null
          and not erp_supply.workforce_special_treatment(c.started_by)
          and c.started_at<v_end
          and coalesce(c.completed_at,now())>=v_start
          and (
            c.started_by=v_actor
            or (
              v_can_team
              and (
                v_is_super
                or v_is_management
                or erp_supply.can_manage_work_profile(c.started_by,'ACTIVITY')
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
    'version','11.38.0'
  );
end;
$$;

revoke all on function public.erp_x_work_planner(date,date) from public,anon;
grant execute on function public.erp_x_work_planner(date,date) to authenticated;

create or replace function public.erp_x_work_operational_detail(
  p_task_session_id uuid default null,
  p_cut_execution_id uuid default null
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
  v_can_team boolean:=v_roles && array['jefe_logistica','lider_logistica','coordinador_logistico','gerencia','super_admin','auditoria']::text[];
  v_profile uuid;
  v_order uuid;
begin
  if p_task_session_id is null and p_cut_execution_id is null then
    raise exception 'No se recibió el proceso operativo';
  end if;

  if p_task_session_id is not null then
    select s.profile_id,o.id
    into v_profile,v_order
    from erp_supply.task_sessions s
    join erp_supply.order_tasks t on t.id=s.task_id
    join erp_supply.orders o on o.id=t.order_id
    where s.id=p_task_session_id
      and o.organization_id=v_org;

    if not found then raise exception 'Proceso operativo no disponible'; end if;

    if erp_supply.workforce_special_treatment(v_profile) then
      raise exception 'Perfil con tratamiento especial' using errcode='42501';
    end if;

    if not (
      v_profile=v_actor
      or (
        v_can_team
        and (
          'super_admin'=any(v_roles)
          or 'gerencia'=any(v_roles)
          or 'auditoria'=any(v_roles)
          or erp_supply.can_manage_work_profile(v_profile,'ACTIVITY')
        )
      )
    ) then
      raise exception 'No autorizado para consultar este proceso' using errcode='42501';
    end if;

    return (
      select jsonb_build_object(
        'type','ORDER_PROCESS',
        'sourceType','ORDER_TASK',
        'id',s.id,
        'taskSessionId',s.id,
        'orderTaskId',t.id,
        'orderId',o.id,
        'orderNumber',o.order_number,
        'stepCode',t.step_code,
        'stepName',ws.name,
        'title','Pedido '||o.order_number||' · '||ws.name,
        'description',coalesce(s.note,t.result_detail),
        'profileId',p.id,
        'profileName',p.display_name,
        'status',case
          when s.ended_at is null then 'IN_PROGRESS'
          when t.status in('WAITING','BLOCKED') then 'PAUSED'
          else 'COMPLETED'
        end,
        'processStatus',t.status,
        'orderStatus',o.status,
        'currentStep',o.current_step_code,
        'startedAt',s.started_at,
        'endedAt',s.ended_at,
        'activeSeconds',case
          when s.ended_at is null then greatest(0,erp_supply.business_seconds_between(v_org,s.started_at,now()))
          else coalesce(s.business_seconds,erp_supply.business_seconds_between(v_org,s.started_at,s.ended_at))
        end,
        'rawSeconds',coalesce(s.raw_seconds,0),
        'evidence','[]'::jsonb,
        'events',(
          select coalesce(jsonb_agg(to_jsonb(z) order by z."createdAt" desc),'[]'::jsonb)
          from(
            select
              e.id,
              e.action_code "actionCode",
              e.event_type "eventType",
              e.from_status "fromStatus",
              e.to_status "toStatus",
              e.created_at "createdAt",
              e.payload->>'detail' detail
            from erp_supply.order_events e
            where e.task_id=t.id
            order by e.created_at desc
            limit 12
          ) z
        ),
        'version','11.38.0'
      )
      from erp_supply.task_sessions s
      join erp_supply.order_tasks t on t.id=s.task_id
      join erp_supply.orders o on o.id=t.order_id
      join erp_supply.workflow_steps ws on ws.code=t.step_code
      join erp_supply.profiles p on p.id=s.profile_id
      where s.id=p_task_session_id
    );
  end if;

  select c.started_by
  into v_profile
  from erp_supply.cut_executions c
  where c.id=p_cut_execution_id
    and c.organization_id=v_org;

  if not found then raise exception 'Ejecución de Corte no disponible'; end if;

  if erp_supply.workforce_special_treatment(v_profile) then
    raise exception 'Perfil con tratamiento especial' using errcode='42501';
  end if;

  if not (
    v_profile=v_actor
    or (
      v_can_team
      and (
        'super_admin'=any(v_roles)
        or 'gerencia'=any(v_roles)
        or 'auditoria'=any(v_roles)
        or erp_supply.can_manage_work_profile(v_profile,'ACTIVITY')
      )
    )
  ) then
    raise exception 'No autorizado para consultar esta ejecución' using errcode='42501';
  end if;

  return (
    select jsonb_build_object(
      'type','ORDER_PROCESS',
      'sourceType','CUT_EXECUTION',
      'id',c.id,
      'cutExecutionId',c.id,
      'orderId',ord.order_id,
      'orderNumber',ord.order_numbers,
      'stepCode','CORTE',
      'stepName','Corte',
      'title',case
        when coalesce(ord.order_count,0)=1 then 'Pedido '||coalesce(ord.order_numbers,'—')||' · Corte'
        when coalesce(ord.order_count,0)>1 then 'Corte · '||coalesce(nullif(c.reference,''),nullif(c.sku,''),'Referencia')||' · '||ord.order_count||' pedidos'
        else 'Corte · '||coalesce(nullif(c.reference,''),nullif(c.sku,''),'Referencia')
      end,
      'description',c.description,
      'profileId',p.id,
      'profileName',p.display_name,
      'status',case
        when c.completed_at is not null or c.status='COMPLETED' then 'COMPLETED'
        when c.status='PAUSED' then 'PAUSED'
        else 'IN_PROGRESS'
      end,
      'processStatus',c.status,
      'orderStatus',c.status,
      'currentStep','CORTE',
      'startedAt',c.started_at,
      'endedAt',c.completed_at,
      'activeSeconds',case
        when c.completed_at is null then greatest(0,erp_supply.business_seconds_between(v_org,c.started_at,now()))
        else greatest(0,erp_supply.business_seconds_between(v_org,c.started_at,c.completed_at))
      end,
      'evidence','[]'::jsonb,
      'events','[]'::jsonb,
      'version','11.38.0'
    )
    from erp_supply.cut_executions c
    join erp_supply.profiles p on p.id=c.started_by
    left join lateral(
      select
        count(distinct cer.order_id)::integer order_count,
        case when count(distinct cer.order_id)=1 then min(cer.order_id::text)::uuid else null end order_id,
        string_agg(distinct o.order_number,', ' order by o.order_number) order_numbers
      from erp_supply.cut_execution_requirements cer
      join erp_supply.orders o on o.id=cer.order_id
      where cer.execution_id=c.id
    ) ord on true
    where c.id=p_cut_execution_id
  );
end;
$$;

revoke all on function public.erp_x_work_operational_detail(uuid,uuid) from public,anon;
grant execute on function public.erp_x_work_operational_detail(uuid,uuid) to authenticated;

create or replace function public.erp_x_paco_snapshot()
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
  v_manager boolean:=v_roles && array[
    'super_admin','gerencia','jefe_logistica','lider_logistica','coordinador_logistico'
  ]::text[];
begin
  return jsonb_build_object(
    'serverTime',now(),
    'managerScope',v_manager,

    'orders',(
      select coalesce(jsonb_agg(to_jsonb(x) order by x."ageBusinessSeconds" desc),'[]'::jsonb)
      from(
        select
          o.id,
          o.order_number "orderNumber",
          o.current_step_code "currentStep",
          s.name "stepName",
          o.status,
          p.display_name "assigneeName",
          greatest(0,erp_supply.business_seconds_between(v_org,o.updated_at,now())) "ageBusinessSeconds",
          (s.sla_hours is not null and erp_supply.business_seconds_between(v_org,o.updated_at,now())>s.sla_hours*3600) "slaExceeded",
          o.updated_at "updatedAt"
        from erp_supply.orders o
        join erp_supply.workflow_steps s on s.code=o.current_step_code
        left join erp_supply.profiles p on p.id=o.current_assignee_id
        where o.organization_id=v_org
          and not o.is_test
          and erp_supply.can_view_order(o.id)
          and (
            o.status not in('CLOSED','CANCELLED')
            or o.updated_at>=now()-interval '4 hours'
          )
        order by o.updated_at desc
        limit 120
      ) x
    ),

    'team',(
      case when not v_manager then '[]'::jsonb else (
        select coalesce(jsonb_agg(to_jsonb(x) order by x.name),'[]'::jsonb)
        from(
          select
            p.id,
            p.display_name name,
            array(select distinct pr.role_code from erp_supply.profile_roles pr where pr.profile_id=p.id order by pr.role_code) roles,
            erp_supply.workforce_special_treatment(p.id) "specialTreatment",
            case when erp_supply.workforce_special_treatment(p.id) then 'Tratamiento especial' else ae.title end "activeTitle",
            case when erp_supply.workforce_special_treatment(p.id) then null else ae.started_at end "activeStartedAt",
            case when erp_supply.workforce_special_treatment(p.id) then 'SPECIAL' else ae.status end "activeStatus",
            case when erp_supply.workforce_special_treatment(p.id) then 'SPECIAL' else ae.source end "activeSource",
            case
              when erp_supply.workforce_special_treatment(p.id) then 0
              when ae.started_at is not null
                then greatest(0,erp_supply.business_seconds_between(v_org,ae.started_at,now()))
              else 0
            end "activeBusinessSeconds",
            case when erp_supply.workforce_special_treatment(p.id) then null else le.ended_at end "lastEndedAt",
            case
              when erp_supply.workforce_special_treatment(p.id) then 0
              when ae.started_at is not null then 0
              else greatest(
                0,
                erp_supply.business_seconds_between(
                  v_org,
                  coalesce(
                    le.ended_at,
                    ((current_date::text||' 07:00:00')::timestamp at time zone
                      coalesce((select timezone from erp_supply.organizations where id=v_org),'America/Bogota'))
                  ),
                  now()
                )
              )
            end "idleBusinessSeconds"
          from erp_supply.profiles p
          left join lateral(
            select z.title,z.started_at,z.status,z.source
            from(
              select e.title_snapshot title,e.started_at,e.status,'ACTIVITY'::text source
              from erp_supply.work_executions e
              where e.organization_id=v_org
                and e.profile_id=p.id
                and e.status in('IN_PROGRESS','PAUSED')

              union all

              select
                'Pedido '||o.order_number||' · '||ws.name,
                s.started_at,
                'IN_PROGRESS'::text,
                'ORDER_TASK'::text
              from erp_supply.task_sessions s
              join erp_supply.order_tasks t on t.id=s.task_id
              join erp_supply.orders o on o.id=t.order_id
              join erp_supply.workflow_steps ws on ws.code=t.step_code
              where o.organization_id=v_org
                and not coalesce(o.is_test,false)
                and s.profile_id=p.id
                and s.ended_at is null

              union all

              select
                'Corte · '||coalesce(nullif(c.reference,''),nullif(c.sku,''),'Referencia'),
                c.started_at,
                case when c.status='PAUSED' then 'PAUSED' else 'IN_PROGRESS' end,
                'CUT_EXECUTION'::text
              from erp_supply.cut_executions c
              where c.organization_id=v_org
                and c.started_by=p.id
                and c.completed_at is null
                and c.status not in('CANCELLED','COMPLETED')
            ) z
            order by z.started_at desc
            limit 1
          ) ae on not erp_supply.workforce_special_treatment(p.id)
          left join lateral(
            select max(z.ended_at) ended_at
            from(
              select e.ended_at
              from erp_supply.work_executions e
              where e.organization_id=v_org
                and e.profile_id=p.id
                and e.ended_at is not null
                and e.ended_at>=current_date::timestamp-interval '1 day'

              union all

              select s.ended_at
              from erp_supply.task_sessions s
              join erp_supply.order_tasks t on t.id=s.task_id
              join erp_supply.orders o on o.id=t.order_id
              where o.organization_id=v_org
                and s.profile_id=p.id
                and s.ended_at is not null
                and s.ended_at>=current_date::timestamp-interval '1 day'

              union all

              select c.completed_at
              from erp_supply.cut_executions c
              where c.organization_id=v_org
                and c.started_by=p.id
                and c.completed_at is not null
                and c.completed_at>=current_date::timestamp-interval '1 day'
            ) z
          ) le on not erp_supply.workforce_special_treatment(p.id)
          where p.organization_id=v_org
            and p.active
            and exists(
              select 1
              from erp_supply.profile_roles pr
              where pr.profile_id=p.id
                and pr.role_code in('aux_logistica','auxiliar_corte')
            )
        ) x
      ) end
    ),

    'executions',(
      select coalesce(jsonb_agg(to_jsonb(x) order by x."startedAt" desc),'[]'::jsonb)
      from(
        select
          ('activity:'||e.id::text) id,
          e.profile_id "profileId",
          p.display_name "profileName",
          e.title_snapshot title,
          e.status,
          e.started_at "startedAt",
          e.ended_at "endedAt",
          coalesce(e.active_seconds,0) "activeSeconds",
          'ACTIVITY'::text source
        from erp_supply.work_executions e
        join erp_supply.profiles p on p.id=e.profile_id
        where e.organization_id=v_org
          and not erp_supply.workforce_special_treatment(e.profile_id)
          and e.started_at>=current_date::timestamp-interval '1 day'
          and (e.profile_id=v_actor or v_manager)

        union all

        select
          ('order-session:'||s.id::text) id,
          s.profile_id "profileId",
          p.display_name "profileName",
          'Pedido '||o.order_number||' · '||ws.name title,
          case when s.ended_at is null then 'IN_PROGRESS' else 'COMPLETED' end status,
          s.started_at "startedAt",
          s.ended_at "endedAt",
          case
            when s.ended_at is null then greatest(0,erp_supply.business_seconds_between(v_org,s.started_at,now()))
            else coalesce(s.business_seconds,0)
          end "activeSeconds",
          'ORDER_TASK'::text source
        from erp_supply.task_sessions s
        join erp_supply.order_tasks t on t.id=s.task_id
        join erp_supply.orders o on o.id=t.order_id
        join erp_supply.workflow_steps ws on ws.code=t.step_code
        join erp_supply.profiles p on p.id=s.profile_id
        where o.organization_id=v_org
          and not coalesce(o.is_test,false)
          and not erp_supply.workforce_special_treatment(s.profile_id)
          and s.started_at>=current_date::timestamp-interval '1 day'
          and (s.profile_id=v_actor or v_manager)
          and not (
            t.step_code='CORTE'
            and exists(
              select 1
              from erp_supply.cut_requirements cr
              join erp_supply.cut_execution_requirements cer on cer.cut_requirement_id=cr.id
              where cr.task_id=t.id
            )
          )

        union all

        select
          ('cut-execution:'||c.id::text) id,
          c.started_by "profileId",
          p.display_name "profileName",
          'Corte · '||coalesce(nullif(c.reference,''),nullif(c.sku,''),'Referencia') title,
          case
            when c.completed_at is not null or c.status='COMPLETED' then 'COMPLETED'
            when c.status='PAUSED' then 'PAUSED'
            else 'IN_PROGRESS'
          end status,
          c.started_at "startedAt",
          c.completed_at "endedAt",
          case
            when c.completed_at is null then greatest(0,erp_supply.business_seconds_between(v_org,c.started_at,now()))
            else greatest(0,erp_supply.business_seconds_between(v_org,c.started_at,c.completed_at))
          end "activeSeconds",
          'CUT_EXECUTION'::text source
        from erp_supply.cut_executions c
        join erp_supply.profiles p on p.id=c.started_by
        where c.organization_id=v_org
          and c.status<>'CANCELLED'
          and c.started_by is not null
          and not erp_supply.workforce_special_treatment(c.started_by)
          and c.started_at>=current_date::timestamp-interval '1 day'
          and (c.started_by=v_actor or v_manager)
        order by "startedAt" desc
        limit 160
      ) x
    ),

    'version','11.38.0'
  );
end;
$$;

revoke all on function public.erp_x_paco_snapshot() from public,anon;
grant execute on function public.erp_x_paco_snapshot() to authenticated;

comment on function erp_supply.workforce_special_treatment(uuid)
is 'V11.38.0: exclusión centralizada de trazabilidad y métricas para perfiles con tratamiento especial.';

comment on function public.erp_x_work_planner(date,date)
is 'V11.38.0: cronograma unificado de planificación, actividad manual y trabajo automático de pedidos usando task_sessions/cut_executions sin duplicar datos.';

comment on function public.erp_x_work_operational_detail(uuid,uuid)
is 'V11.38.0: detalle bajo demanda de sesiones automáticas de pedido o Corte.';

comment on function public.erp_x_paco_snapshot()
is 'V11.38.0: snapshot PACO coherente con ocupación real de task_sessions, Corte y actividades manuales; excluye tratamiento especial.';

notify pgrst,'reload schema';
commit;
