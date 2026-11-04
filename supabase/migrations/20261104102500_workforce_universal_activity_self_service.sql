-- CRM Suministros: autoservicio universal de actividades (2026-11-04)
-- Sin límite de actividades registradas; los cambios pausan el cronómetro anterior.
-- La propiedad del registro, aislamiento organizacional y control de asignaciones ajenas permanecen.
-- Mantiene evidencia, revisión de tiempos y trazabilidad.
drop index if exists erp_supply.uq_work_open_execution_per_profile;
create unique index if not exists uq_work_running_execution_per_profile
  on erp_supply.work_executions(profile_id) where status='IN_PROGRESS';

CREATE OR REPLACE FUNCTION public.erp_x_work_catalog()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'erp_supply', 'public', 'auth', 'pg_catalog'
AS $function$
declare
  v_actor uuid:=erp_supply.require_profile();
  v_org uuid:=erp_supply.current_org_id();
begin
  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x."uiCategoryLabel",x."uiSubcategory",x."sortOrder",x.name)
    from(
      select
        c.id,
        c.code,
        c.name,
        c.description,
        c.activity_group "activityGroup",
        c.activity_kind "activityKind",
        c.standard_minutes "standardMinutes",
        c.evidence_policy "evidencePolicy",
        c.acceptance_required "acceptanceRequired",
        c.team_allowed "teamAllowed",
        c.sort_order "sortOrder",
        coalesce(nullif(c.metadata->>'uiCategory',''),c.activity_group) "uiCategory",
        coalesce(nullif(c.metadata->>'uiCategoryLabel',''),initcap(replace(coalesce(c.metadata->>'uiCategory',c.activity_group),'_',' '))) "uiCategoryLabel",
        coalesce(nullif(c.metadata->>'uiSubcategory',''),'Otras actividades') "uiSubcategory",
        nullif(c.metadata->>'procedureHint','') "procedureHint",
        nullif(c.metadata->>'evidenceHint','') "evidenceHint",
        0::integer samples,
        null::numeric "medianMinutes",
        null::numeric "p80Minutes"
      from erp_supply.work_activity_catalog c
      where c.organization_id=v_org
        and c.active
        and (
          c.activity_kind='ACTIVITY'
          or erp_supply.work_catalog_allowed(c.id,v_actor)
          or erp_supply.has_role('super_admin')
          or (erp_supply.has_role('gerencia') and c.activity_kind='DELIVERABLE')
          or (erp_supply.has_role('jefe_logistica') and c.activity_kind='ACTIVITY' and c.activity_group in('LOGISTICS','IMPROVEMENT','GENERAL'))
        )
    ) x
  ),'[]'::jsonb);
end;
$function$;

CREATE OR REPLACE FUNCTION public.erp_x_work_schedule(p_payload jsonb)
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
  v_catalog_id uuid:=erp_supply.safe_uuid(p_payload->>'catalogId');
  v_catalog erp_supply.work_activity_catalog%rowtype;
  v_start timestamptz:=nullif(trim(p_payload->>'plannedStart'),'')::timestamptz;
  v_end timestamptz:=nullif(trim(p_payload->>'plannedEnd'),'')::timestamptz;
  v_open_ended boolean:=coalesce((p_payload->>'openEnded')::boolean,false);
  v_priority text:=upper(coalesce(nullif(trim(p_payload->>'priority'),''),'MEDIUM'));
  v_minutes integer:=greatest(1,least(coalesce(erp_supply.safe_numeric(p_payload->>'estimatedMinutes')::integer,60),1440));
  v_profile uuid;
  v_assignment uuid;
  v_created jsonb:='[]'::jsonb;
begin
  if v_catalog_id is null or v_start is null then raise exception 'Actividad e inicio son obligatorios'; end if;
  if v_priority not in('LOW','MEDIUM','HIGH','URGENT','CRITICAL') then raise exception 'Prioridad inválida'; end if;
  if v_open_ended then v_end:=null; end if;
  if not v_open_ended and v_end is null then raise exception 'Indica una hora final o marca sin hora final estimada'; end if;
  if v_end is not null and v_end<=v_start then raise exception 'La hora final debe ser posterior al inicio'; end if;

  select * into v_catalog from erp_supply.work_activity_catalog
  where id=v_catalog_id and organization_id=v_org and active and activity_kind='ACTIVITY';
  if not found then raise exception 'Actividad no disponible'; end if;
  if jsonb_typeof(coalesce(p_payload->'profileIds','[]'::jsonb))<>'array'
     or jsonb_array_length(coalesce(p_payload->'profileIds','[]'::jsonb))=0 then
    raise exception 'Selecciona al menos una persona';
  end if;

  for v_profile in select (value#>>'{}')::uuid from jsonb_array_elements(p_payload->'profileIds') loop
    if v_profile<>v_actor and not v_is_manager then
      raise exception 'Solo un responsable autorizado puede programar a otra persona' using errcode='42501';
    end if;
    if v_profile<>v_actor and not erp_supply.can_manage_work_profile(v_profile,'ACTIVITY') then
      raise exception 'No tienes permiso para programar a una de las personas seleccionadas' using errcode='42501';
    end if;
    -- La auto-programación no bloquea por solapamiento: el inicio real nunca es simultáneo.
    if v_profile<>v_actor and v_end is not null and exists(
      select 1 from erp_supply.work_assignment_members m
      join erp_supply.work_assignments a on a.id=m.assignment_id
      where m.profile_id=v_profile and a.status='PUBLISHED' and a.planned_start is not null and a.planned_end is not null
        and tstzrange(a.planned_start,a.planned_end,'[)') && tstzrange(v_start,v_end,'[)')
    ) and not coalesce((p_payload->>'force')::boolean,false) then raise exception 'Ya existe una actividad en ese horario'; end if;

    insert into erp_supply.work_assignments(
      organization_id,catalog_id,title,description,assignment_kind,status,priority,planned_start,planned_end,due_at,
      estimated_minutes,evidence_policy,acceptance_required,assigned_by,request_origin,approval_status,requested_by,requested_at,metadata
    ) values(
      v_org,v_catalog.id,coalesce(nullif(trim(p_payload->>'title'),''),v_catalog.name),nullif(trim(p_payload->>'description'),''),
      'ACTIVITY','PUBLISHED',v_priority,v_start,v_end,case when v_open_ended then v_start else null end,
      v_minutes,coalesce(nullif(trim(p_payload->>'evidencePolicy'),''),v_catalog.evidence_policy),false,v_actor,
      'MANAGER_ASSIGNED','NOT_REQUIRED',v_actor,now(),
      jsonb_build_object('openEnded',v_open_ended,'selfScheduled',(v_profile=v_actor),'createdVersion','11.47.0','startsAutomatically',false)
    ) returning id into v_assignment;
    insert into erp_supply.work_assignment_members(assignment_id,profile_id,status) values(v_assignment,v_profile,'PLANNED');
    insert into erp_supply.work_activity_events(organization_id,assignment_id,profile_id,actor_profile_id,event_type,payload)
    values(v_org,v_assignment,v_profile,v_actor,'ASSIGNMENT_PUBLISHED',jsonb_build_object(
      'plannedStart',v_start,'plannedEnd',v_end,'openEnded',v_open_ended,'startsAutomatically',false,'version','11.47.0'));
    v_created:=v_created||jsonb_build_array(v_assignment);
  end loop;
  return jsonb_build_object('success',true,'createdIds',v_created,'openEnded',v_open_ended,'startsAutomatically',false,'version','11.47.0');
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
  if exists(select 1 from erp_supply.cut_executions where started_by=v_actor and status='IN_PROGRESS') then
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

CREATE OR REPLACE FUNCTION public.erp_x_work_resume(p_execution_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'erp_supply', 'public', 'auth', 'pg_catalog'
AS $function$
declare
  v_actor uuid:=erp_supply.require_profile();
  v_exec erp_supply.work_executions%rowtype;
  v_previous uuid;
begin
  select * into v_exec from erp_supply.work_executions
  where id=p_execution_id and profile_id=v_actor and organization_id=erp_supply.current_org_id() for update;
  if not found then raise exception 'Actividad no disponible'; end if;
  if v_exec.status<>'PAUSED' then raise exception 'La actividad no está pausada'; end if;

  -- Cambiar entre actividades sin perder el avance ni generar dos cronómetros activos.
  select e.id into v_previous from erp_supply.work_executions e
  where e.profile_id=v_actor and e.organization_id=v_exec.organization_id
    and e.status='IN_PROGRESS' and e.id<>v_exec.id
  for update;
  if v_previous is not null then
    perform public.erp_x_work_pause(v_previous,'OTHER','Pausa automática al retomar otra actividad');
  end if;

  update erp_supply.work_execution_pauses set ended_at=now(),ended_by=v_actor
  where execution_id=v_exec.id and ended_at is null;
  update erp_supply.work_executions set status='IN_PROGRESS' where id=v_exec.id;
  insert into erp_supply.work_activity_events(organization_id,execution_id,assignment_id,profile_id,actor_profile_id,event_type,payload)
  values(v_exec.organization_id,v_exec.id,v_exec.assignment_id,v_actor,v_actor,'RESUMED','{}'::jsonb);
  return jsonb_build_object('success',true,'status','IN_PROGRESS','metrics',erp_supply.work_execution_metrics(v_exec.id));
end;
$function$;

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
      select 'CUTTING' type,'Corte por referencia · '||coalesce(c.reference,c.description) title,c.started_at "startedAt",c.status
      from erp_supply.cut_executions c where c.started_by=v_actor and c.status in('IN_PROGRESS','PAUSED','WAITING_EVIDENCE')
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

CREATE OR REPLACE FUNCTION public.erp_x_work_my_day(p_day date DEFAULT CURRENT_DATE)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_result jsonb;
  v_roles text[];
  v_is_manager boolean;
  v_is_auxiliary boolean;
  v_actor uuid;
begin
  v_actor:=erp_supply.require_profile();
  v_roles:=erp_supply.current_roles();
  v_result:=erp_supply.work_my_day_core(p_day);
  v_is_manager:=v_roles && array['super_admin','gerencia','jefe_logistica','lider_logistica','coordinador_logistico']::text[];
  v_is_auxiliary:=(v_roles && array['aux_logistica','auxiliar_corte']::text[]) and not v_is_manager;

  v_result:=jsonb_set(v_result,'{permissions,canViewTeam}',to_jsonb(v_is_manager),true);
  v_result:=jsonb_set(v_result,'{permissions,canPlanLogistics}',to_jsonb(v_is_manager),true);
  v_result:=jsonb_set(v_result,'{permissions,canDirectStart}','true'::jsonb,true);
  v_result:=jsonb_set(v_result,'{permissions,requiresActivityApproval}','false'::jsonb,true);

  v_result:=jsonb_set(v_result,'{pausedActivities}',coalesce((
    select jsonb_agg(to_jsonb(x) order by x."startedAt" desc)
    from (
      select e.id,e.title_snapshot "title",e.started_at "startedAt",
             c.name "catalogName",e.catalog_id "catalogId"
      from erp_supply.work_executions e
      join erp_supply.work_activity_catalog c on c.id=e.catalog_id
      where e.organization_id=erp_supply.current_org_id()
        and e.profile_id=v_actor and e.status='PAUSED'
      order by e.started_at desc
    ) x
  ),'[]'::jsonb),true);

  -- Agregar catalogId a futuras actividades para poder iniciarlas sin esperar la fecha.
  v_result:=jsonb_set(v_result,'{upcoming}',coalesce((
    select jsonb_agg(u.value||jsonb_build_object('catalogId',a.catalog_id))
    from jsonb_array_elements(coalesce(v_result->'upcoming','[]'::jsonb)) u
    join erp_supply.work_assignments a
      on a.id=(u.value->>'id')::uuid
     and a.organization_id=erp_supply.current_org_id()
  ),'[]'::jsonb),true);
  v_result:=jsonb_set(v_result,'{permissions,canApproveActivities}',to_jsonb(
    erp_supply.work_can_approve_scope('LOGISTICS') or erp_supply.work_can_approve_scope('MANAGEMENT')
  ),true);
  return jsonb_set(v_result,'{version}',to_jsonb('11.47.0'::text),true);
end;
$function$;

revoke all on function public.erp_x_work_catalog() from public,anon;
revoke all on function public.erp_x_work_start(uuid,uuid,jsonb) from public,anon;
revoke all on function public.erp_x_work_resume(uuid) from public,anon;
revoke all on function public.erp_x_work_schedule(jsonb) from public,anon;
revoke all on function public.erp_x_work_my_day(date) from public,anon;
grant execute on function public.erp_x_work_catalog() to authenticated;
grant execute on function public.erp_x_work_start(uuid,uuid,jsonb) to authenticated;
grant execute on function public.erp_x_work_resume(uuid) to authenticated;
grant execute on function public.erp_x_work_schedule(jsonb) to authenticated;
grant execute on function public.erp_x_work_my_day(date) to authenticated;
