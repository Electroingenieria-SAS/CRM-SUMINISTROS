-- Ocupación simultánea real en Jornada, PACO y planificación del equipo.
-- Las horas y los registros quedan asociados al cortador y al auxiliar polivalente sin duplicarse para una misma persona.

CREATE OR REPLACE FUNCTION erp_supply.work_my_day_core(p_day date DEFAULT CURRENT_DATE)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'erp_supply', 'public', 'auth', 'pg_catalog'
AS $function$
declare
  v_actor uuid:=erp_supply.require_profile();
  v_org uuid:=erp_supply.current_org_id();
  v_tz text:=coalesce((select timezone from erp_supply.organizations where id=v_org),'America/Bogota');
  v_day date:=coalesce(p_day,current_date);
  v_start timestamptz:=(v_day::timestamp at time zone v_tz);
  v_end timestamptz:=((v_day+1)::timestamp at time zone v_tz);
  v_active jsonb;
  v_erp_active jsonb;
  v_sched bigint;v_fixed bigint;v_misc bigint;v_total bigint;
begin
  select to_jsonb(x) into v_active from(
    select e.id,e.status,e.source,e.title_snapshot "title",e.started_at "startedAt",e.ended_at "endedAt",
           e.assignment_id "assignmentId",e.catalog_id "catalogId",c.name "catalogName",coalesce(a.evidence_policy,c.evidence_policy) "evidencePolicy",
           coalesce(a.estimated_minutes,c.standard_minutes) "estimatedMinutes",a.planned_start "plannedStart",a.planned_end "plannedEnd",a.due_at "dueAt",
           erp_supply.work_execution_metrics(e.id) metrics,
           (select coalesce(jsonb_agg(jsonb_build_object('id',w.id,'type',w.evidence_type,'fileName',w.file_name,'webViewLink',w.web_view_link,'value',w.external_value,'createdAt',w.created_at) order by w.created_at),'[]'::jsonb) from erp_supply.work_evidence w where w.execution_id=e.id) evidence
    from erp_supply.work_executions e join erp_supply.work_activity_catalog c on c.id=e.catalog_id left join erp_supply.work_assignments a on a.id=e.assignment_id
    where e.profile_id=v_actor and e.status in('IN_PROGRESS','PAUSED') order by (e.status='IN_PROGRESS') desc,e.started_at desc limit 1
  ) x;

  select to_jsonb(x) into v_erp_active from(
    select * from(
      select 'CUTTING' type,(case when c.started_by=v_actor then 'Corte por referencia · ' else 'Apoyo en Corte · ' end)||coalesce(c.reference,c.description) title,c.started_at "startedAt",c.status
      from erp_supply.cut_executions c where (c.started_by=v_actor or c.metadata->>'cutPickupProfileId'=v_actor::text) and c.status in('IN_PROGRESS','PAUSED','WAITING_EVIDENCE')
      union all
      select 'ERP_TASK',o.order_number||' · '||ws.name,s.started_at,t.status
      from erp_supply.task_sessions s join erp_supply.order_tasks t on t.id=s.task_id join erp_supply.orders o on o.id=t.order_id join erp_supply.workflow_steps ws on ws.code=t.step_code
      where s.profile_id=v_actor and s.ended_at is null
    ) q order by "startedAt" desc limit 1
  ) x;

  v_sched:=erp_supply.business_seconds_between(v_org,v_start,v_end);
  v_fixed:=erp_supply.work_source_business_seconds(v_actor,v_start,v_end,'ERP');
  v_misc:=erp_supply.work_source_business_seconds(v_actor,v_start,v_end,'ACTIVITY');
  v_total:=erp_supply.work_classified_business_seconds(v_actor,v_start,v_end);

  return jsonb_build_object(
    'day',v_day,'active',v_active,'erpActive',v_erp_active,'catalog',public.erp_x_work_catalog(),
    'today',(
      select coalesce(jsonb_agg(to_jsonb(x) order by x."plannedStart" nulls last,x."dueAt" nulls last,x.priority),'[]'::jsonb) from(
        select a.id,m.id "memberId",a.title,a.description,a.assignment_kind "kind",a.priority,a.planned_start "plannedStart",a.planned_end "plannedEnd",a.due_at "dueAt",
               a.estimated_minutes "estimatedMinutes",a.evidence_policy "evidencePolicy",a.acceptance_required "acceptanceRequired",m.status "memberStatus",
               c.name "catalogName",c.code "catalogCode",c.id "catalogId",a.request_origin "requestOrigin",a.request_reason "requestReason",a.approval_status "approvalStatus"
        from erp_supply.work_assignment_members m join erp_supply.work_assignments a on a.id=m.assignment_id left join erp_supply.work_activity_catalog c on c.id=a.catalog_id
        where m.profile_id=v_actor and a.organization_id=v_org and a.status='PUBLISHED' and m.status not in('COMPLETED','CANCELLED')
          and ((a.planned_start>=v_start and a.planned_start<v_end) or (a.planned_start is null and a.due_at>=v_start and a.due_at<v_end))
      ) x
    ),
    'overdue',(
      select coalesce(jsonb_agg(to_jsonb(x) order by x."dueAt"),'[]'::jsonb) from(
        select a.id,m.id "memberId",a.title,a.assignment_kind "kind",a.priority,a.due_at "dueAt",a.planned_start "plannedStart",a.planned_end "plannedEnd",
               a.estimated_minutes "estimatedMinutes",m.status "memberStatus",c.name "catalogName",c.id "catalogId",a.approval_status "approvalStatus"
        from erp_supply.work_assignment_members m join erp_supply.work_assignments a on a.id=m.assignment_id left join erp_supply.work_activity_catalog c on c.id=a.catalog_id
        where m.profile_id=v_actor and a.organization_id=v_org and a.status='PUBLISHED' and m.status not in('COMPLETED','CANCELLED','SUBMITTED')
          and coalesce(a.due_at,a.planned_end)<v_start
      ) x
    ),
    'upcoming',(
      select coalesce(jsonb_agg(to_jsonb(x) order by x."nextAt"),'[]'::jsonb) from(
        select a.id,a.title,a.assignment_kind "kind",a.priority,a.planned_start "plannedStart",a.planned_end "plannedEnd",a.due_at "dueAt",coalesce(a.planned_start,a.due_at) "nextAt",m.status "memberStatus",c.name "catalogName"
        from erp_supply.work_assignment_members m join erp_supply.work_assignments a on a.id=m.assignment_id left join erp_supply.work_activity_catalog c on c.id=a.catalog_id
        where m.profile_id=v_actor and a.organization_id=v_org and a.status='PUBLISHED' and m.status not in('COMPLETED','CANCELLED')
          and coalesce(a.planned_start,a.due_at)>=v_end and coalesce(a.planned_start,a.due_at)<v_end+interval '7 days'
        order by coalesce(a.planned_start,a.due_at) limit 12
      ) x
    ),
    'pendingRequests',(
      select coalesce(jsonb_agg(to_jsonb(x) order by x."plannedStart"),'[]'::jsonb) from(
        select a.id,a.title,a.request_reason "reason",a.priority,a.planned_start "plannedStart",a.planned_end "plannedEnd",a.approval_scope "approvalScope",
               a.approval_status "approvalStatus",a.requested_at "requestedAt",c.name "catalogName"
        from erp_supply.work_assignments a join erp_supply.work_assignment_members m on m.assignment_id=a.id left join erp_supply.work_activity_catalog c on c.id=a.catalog_id
        where m.profile_id=v_actor and a.request_origin='SELF_PROPOSED' and a.approval_status='PENDING' and a.status='DRAFT'
      ) x
    ),
    'requestHistory',(
      select coalesce(jsonb_agg(to_jsonb(x) order by x."decidedAt" desc),'[]'::jsonb) from(
        select a.id,a.title,a.approval_status "approvalStatus",a.decision_note "decisionNote",a.decided_at "decidedAt",
               a.planned_start "plannedStart",a.planned_end "plannedEnd",d.display_name "decidedBy"
        from erp_supply.work_assignments a
        left join erp_supply.profiles d on d.id=a.decided_by
        where a.requested_by=v_actor and a.request_origin='SELF_PROPOSED' and a.approval_status in('APPROVED','REJECTED')
          and a.decided_at>=now()-interval '7 days'
        order by a.decided_at desc limit 6
      ) x
    ),
    'history',(
      select coalesce(jsonb_agg(to_jsonb(x) order by x."startedAt" desc),'[]'::jsonb) from(
        select e.id,e.title_snapshot "title",e.status,e.started_at "startedAt",e.ended_at "endedAt",e.active_seconds "activeSeconds",e.business_seconds "businessSeconds",e.paused_seconds "pausedSeconds",
               c.name "catalogName",c.activity_group "activityGroup",e.result_note "resultNote",coalesce(a.evidence_policy,c.evidence_policy) "evidencePolicy",
               coalesce(a.acceptance_required,c.acceptance_required,false) "acceptanceRequired",
               (select coalesce(jsonb_agg(jsonb_build_object('id',w.id,'type',w.evidence_type,'fileName',w.file_name,'webViewLink',w.web_view_link,'value',w.external_value,'createdAt',w.created_at) order by w.created_at),'[]'::jsonb) from erp_supply.work_evidence w where w.execution_id=e.id) evidence
        from erp_supply.work_executions e join erp_supply.work_activity_catalog c on c.id=e.catalog_id left join erp_supply.work_assignments a on a.id=e.assignment_id
        where e.profile_id=v_actor and e.started_at>=v_start and e.started_at<v_end order by e.started_at desc limit 30
      ) x
    ),
    'summary',jsonb_build_object(
      'completed',(select count(*) from erp_supply.work_executions e where e.profile_id=v_actor and e.status='COMPLETED' and e.ended_at>=v_start and e.ended_at<v_end),
      'scheduledBusinessSeconds',v_sched,'fixedProcessSeconds',v_fixed,'miscActivitySeconds',v_misc,'classifiedSeconds',v_total,
      'overlapSeconds',greatest(v_fixed+v_misc-v_total,0),'unclassifiedSeconds',greatest(v_sched-v_total,0),
      'occupationPct',case when v_sched=0 then 0 else round((100.0*v_total/v_sched)::numeric,1) end,
      'plannedMinutes',(select coalesce(sum(a.estimated_minutes),0) from erp_supply.work_assignment_members m join erp_supply.work_assignments a on a.id=m.assignment_id where m.profile_id=v_actor and a.status='PUBLISHED' and a.planned_start>=v_start and a.planned_start<v_end),
      'pendingApproval',(select count(*) from erp_supply.work_assignments a where a.requested_by=v_actor and a.approval_status='PENDING'),
      'pendingEvidence',(select count(*) from erp_supply.work_executions e where e.profile_id=v_actor and e.status='WAITING_EVIDENCE'),
      'pendingReview',(select count(*) from erp_supply.work_executions e where e.profile_id=v_actor and e.status='SUBMITTED')
    ),
    'permissions',jsonb_build_object(
      'canPropose',true,
      'approvalScope',erp_supply.work_approval_scope_for_profile(v_actor),
      'canDirectStart',erp_supply.has_role('super_admin') or erp_supply.has_role('gerencia') or erp_supply.has_role('jefe_logistica') or erp_supply.has_role('lider_logistica'),
      'canPlanLogistics',erp_supply.has_role('jefe_logistica') or erp_supply.has_role('lider_logistica') or erp_supply.has_role('super_admin'),
      'canPlanManagement',erp_supply.has_role('gerencia') or erp_supply.has_role('super_admin'),
      'canPlanDeliverables',erp_supply.has_role('gerencia') or erp_supply.has_role('super_admin'),
      'canApproveActivities',erp_supply.work_can_approve_scope('LOGISTICS') or erp_supply.work_can_approve_scope('MANAGEMENT'),
      'canViewTeam',erp_supply.has_role('jefe_logistica') or erp_supply.has_role('lider_logistica') or erp_supply.has_role('gerencia') or erp_supply.has_role('super_admin')
    ),
    'serverTime',now(),'version','10.24.0'
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.erp_x_work_start(p_catalog_id uuid, p_assignment_id uuid DEFAULT NULL::uuid, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'erp_supply', 'public', 'auth', 'pg_catalog'
AS $function$
declare
  v_actor uuid:=erp_supply.require_profile();
  v_org uuid:=erp_supply.current_org_id();
  v_roles text[]:=erp_supply.current_roles();
  v_is_manager boolean:=v_roles && array['super_admin','gerencia','jefe_logistica','lider_logistica','coordinador_logistico']::text[];
  v_is_auxiliary boolean:=(v_roles && array['aux_logistica','auxiliar_corte']::text[]) and not v_is_manager;
  v_catalog erp_supply.work_activity_catalog%rowtype;
  v_assignment erp_supply.work_assignments%rowtype;
  v_member erp_supply.work_assignment_members%rowtype;
  v_exec erp_supply.work_executions%rowtype;
  v_title text;
  v_delay bigint:=0;
  v_previous uuid;
begin
  -- No imponer un número máximo de actividades: solo una cuenta tiempo a la vez.
  -- Al comenzar otra, la actual se pausa automáticamente y puede retomarse más tarde.
  select e.id into v_previous from erp_supply.work_executions e
  where e.profile_id=v_actor and e.organization_id=v_org and e.status='IN_PROGRESS'
  for update;
  if v_previous is not null then
    perform public.erp_x_work_pause(v_previous,'OTHER','Pausa automática al iniciar otra actividad');
  end if;
  if exists(select 1 from erp_supply.cut_executions where (started_by=v_actor or metadata->>'cutPickupProfileId'=v_actor::text) and status='IN_PROGRESS') then
    raise exception 'Tienes un corte en ejecución. Pausa o termina Corte antes de iniciar otra actividad.';
  end if;

  select * into v_catalog
  from erp_supply.work_activity_catalog
  where id=p_catalog_id and organization_id=v_org and active and activity_kind='ACTIVITY';
  if not found then
    raise exception 'Actividad no disponible para tu perfil' using errcode='42501';
  end if;

  if p_assignment_id is not null then
    select * into v_assignment
    from erp_supply.work_assignments
    where id=p_assignment_id and organization_id=v_org and status='PUBLISHED'
    for update;
    if not found then raise exception 'La actividad programada ya no está disponible'; end if;
    if v_assignment.request_origin='SELF_PROPOSED' and v_assignment.requested_by is distinct from v_actor and v_assignment.approval_status<>'APPROVED' then
      raise exception 'La actividad aún no ha sido aprobada' using errcode='42501';
    end if;

    select * into v_member
    from erp_supply.work_assignment_members
    where assignment_id=v_assignment.id and profile_id=v_actor
    for update;
    if not found then raise exception 'Esta actividad no está asignada a tu perfil' using errcode='42501'; end if;
    if v_member.status in('COMPLETED','CANCELLED') then raise exception 'Esta actividad ya fue cerrada'; end if;
    if v_assignment.catalog_id is not null and v_assignment.catalog_id<>p_catalog_id then
      raise exception 'El tipo de actividad no coincide con la programación';
    end if;
    v_title:=v_assignment.title;
    if v_assignment.planned_start is not null then
      v_delay:=abs(extract(epoch from(now()-v_assignment.planned_start))::bigint);
    end if;
  else
    v_title:=coalesce(nullif(trim(p_payload->>'title'),''),v_catalog.name);
  end if;

  insert into erp_supply.work_executions(
    organization_id,assignment_id,assignment_member_id,catalog_id,profile_id,source,status,title_snapshot,
    started_at,start_delay_seconds,related_entity_type,related_entity_id,metadata
  ) values(
    v_org,p_assignment_id,case when p_assignment_id is null then null else v_member.id end,v_catalog.id,v_actor,
    case when p_assignment_id is null then 'MANUAL' else 'PLANNED' end,'IN_PROGRESS',v_title,now(),v_delay,
    nullif(trim(p_payload->>'relatedEntityType'),''),nullif(trim(p_payload->>'relatedEntityId'),''),
    coalesce(p_payload->'metadata','{}'::jsonb)||jsonb_build_object(
      'startedVersion','11.47.0','approvalRequired',false,'photoRequired',true,'timeReviewThresholdSeconds',3600
    )
  ) returning * into v_exec;

  if p_assignment_id is not null then
    update erp_supply.work_assignment_members
    set status='IN_PROGRESS',first_started_at=coalesce(first_started_at,now())
    where id=v_member.id;
  end if;

  insert into erp_supply.work_activity_events(
    organization_id,execution_id,assignment_id,profile_id,actor_profile_id,event_type,payload
  ) values(
    v_org,v_exec.id,p_assignment_id,v_actor,v_actor,'STARTED',
    jsonb_build_object('title',v_title,'catalogId',v_catalog.id,'source',case when p_assignment_id is null then 'MANUAL' else 'PLANNED' end,
      'approvalRequired',false,'version','11.47.0')
  );

  return jsonb_build_object('success',true,'executionId',v_exec.id,'status',v_exec.status,'startedAt',v_exec.started_at,
    'title',v_title,'approvalRequired',false,'version','11.47.0');
end;
$function$;

CREATE OR REPLACE FUNCTION public.erp_x_work_planner(p_from date, p_to date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'erp_supply', 'public', 'auth', 'pg_catalog'
AS $function$
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
            and (c.started_by=p.id or c.metadata->>'cutPickupProfileId'=p.id::text)
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
          ('cut-execution:'||c.id::text||':'||p.id::text) id,
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
          p.id "profileId",
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
        join lateral (values(c.started_by),(erp_supply.safe_uuid(c.metadata->>'cutPickupProfileId'))) cp(profile_id) on cp.profile_id is not null
        join erp_supply.profiles p on p.id=cp.profile_id
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
          and not erp_supply.workforce_special_treatment(p.id)
          and c.started_at<v_end
          and coalesce(c.completed_at,now())>=v_start
          and (
            p.id=v_actor
            or (
              v_can_team
              and (
                v_is_super
                or v_is_management
                or erp_supply.can_manage_work_profile(p.id,'ACTIVITY')
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
$function$;

CREATE OR REPLACE FUNCTION public.erp_x_paco_snapshot()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'erp_supply', 'public', 'auth', 'pg_catalog'
AS $function$
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
                and (c.started_by=p.id or c.metadata->>'cutPickupProfileId'=p.id::text)
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
                and (c.started_by=p.id or c.metadata->>'cutPickupProfileId'=p.id::text)
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
          ('cut-execution:'||c.id::text||':'||p.id::text) id,
          p.id "profileId",
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
        join lateral (values(c.started_by),(erp_supply.safe_uuid(c.metadata->>'cutPickupProfileId'))) cp(profile_id) on cp.profile_id is not null
        join erp_supply.profiles p on p.id=cp.profile_id
        where c.organization_id=v_org
          and c.status<>'CANCELLED'
          and c.started_by is not null
          and not erp_supply.workforce_special_treatment(p.id)
          and c.started_at>=current_date::timestamp-interval '1 day'
          and (p.id=v_actor or v_manager)
        order by "startedAt" desc
        limit 160
      ) x
    ),

    'version','11.38.0'
  );
end;
$function$;
