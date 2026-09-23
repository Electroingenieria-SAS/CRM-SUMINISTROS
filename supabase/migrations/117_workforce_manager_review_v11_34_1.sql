-- CRM Suministros V11.34.1
-- Mi jornada sin aprobación previa + cola gerencial de tiempos > 1 h.
-- Versionada únicamente. NO aplicar a producción mientras V11.34.x siga en preview Pages.
begin;

-- ---------------------------------------------------------------------------
-- 1. RETIRAR FLUJO LEGADO DE APROBACIÓN PARA AUTOACTIVIDADES
-- ---------------------------------------------------------------------------
-- Las solicitudes antiguas que quedaron DRAFT/PENDING dejan de ser accionables.
update erp_supply.work_assignments
set status='CANCELLED',
    approval_status='REJECTED',
    decision_note='Flujo de aprobación previa retirado en V11.34.1',
    decided_at=coalesce(decided_at,now()),
    metadata=metadata||jsonb_build_object(
      'approvalFlowRetired',true,
      'approvalFlowRetiredAt',now(),
      'version','11.34.1'
    )
where status='DRAFT'
  and approval_status='PENDING'
  and request_origin='SELF_PROPOSED';

update erp_supply.work_assignment_members m
set status='CANCELLED',
    cancelled_at=coalesce(cancelled_at,now()),
    metadata=m.metadata||jsonb_build_object('approvalFlowRetired',true,'version','11.34.1')
where exists(
  select 1
  from erp_supply.work_assignments a
  where a.id=m.assignment_id
    and a.status='CANCELLED'
    and coalesce((a.metadata->>'approvalFlowRetired')::boolean,false)
);

-- ---------------------------------------------------------------------------
-- 2. INICIO DIRECTO PARA TODO PERFIL AUTORIZADO POR CATÁLOGO
-- ---------------------------------------------------------------------------
create or replace function public.erp_x_work_start(
  p_catalog_id uuid,
  p_assignment_id uuid default null,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=erp_supply,public,auth,pg_catalog
as $$
declare
  v_actor uuid:=erp_supply.require_profile();
  v_org uuid:=erp_supply.current_org_id();
  v_catalog erp_supply.work_activity_catalog%rowtype;
  v_assignment erp_supply.work_assignments%rowtype;
  v_member erp_supply.work_assignment_members%rowtype;
  v_exec erp_supply.work_executions%rowtype;
  v_title text;
  v_delay bigint:=0;
begin
  if exists(
    select 1
    from erp_supply.work_executions
    where profile_id=v_actor
      and status in('IN_PROGRESS','PAUSED')
  ) then
    raise exception 'Ya tienes una actividad cronometrada. Finalízala antes de iniciar otra.';
  end if;

  if exists(
    select 1
    from erp_supply.cut_executions
    where started_by=v_actor
      and status='IN_PROGRESS'
  ) then
    raise exception 'Tienes un corte en ejecución. Pausa o termina Corte antes de iniciar otra actividad.';
  end if;

  select * into v_catalog
  from erp_supply.work_activity_catalog
  where id=p_catalog_id
    and organization_id=v_org
    and active
    and activity_kind='ACTIVITY';

  if not found or not erp_supply.work_catalog_allowed(p_catalog_id,v_actor) then
    raise exception 'Actividad no disponible para tu perfil' using errcode='42501';
  end if;

  if p_assignment_id is not null then
    select * into v_assignment
    from erp_supply.work_assignments
    where id=p_assignment_id
      and organization_id=v_org
      and status='PUBLISHED'
    for update;

    if not found then
      raise exception 'La actividad programada ya no está disponible';
    end if;

    select * into v_member
    from erp_supply.work_assignment_members
    where assignment_id=v_assignment.id
      and profile_id=v_actor
    for update;

    if not found then
      raise exception 'Esta actividad no está asignada a tu perfil' using errcode='42501';
    end if;

    if v_member.status in('COMPLETED','CANCELLED') then
      raise exception 'Esta actividad ya fue cerrada';
    end if;

    if v_assignment.catalog_id is not null and v_assignment.catalog_id<>p_catalog_id then
      raise exception 'El tipo de actividad no coincide con la programación';
    end if;

    if v_assignment.planned_start is not null and now()<v_assignment.planned_start-interval '15 minutes' then
      raise exception 'Esta actividad estará disponible 15 minutos antes del horario programado';
    end if;

    v_title:=v_assignment.title;
    if v_assignment.planned_start is not null then
      v_delay:=abs(extract(epoch from(now()-v_assignment.planned_start))::bigint);
    end if;
  else
    -- V11.34.1: no existe aprobación previa para Mi jornada.
    -- El control es catálogo permitido + foto final + revisión > 60 min.
    v_title:=coalesce(nullif(trim(p_payload->>'title'),''),v_catalog.name);
  end if;

  insert into erp_supply.work_executions(
    organization_id,
    assignment_id,
    assignment_member_id,
    catalog_id,
    profile_id,
    source,
    status,
    title_snapshot,
    started_at,
    start_delay_seconds,
    related_entity_type,
    related_entity_id,
    metadata
  ) values(
    v_org,
    p_assignment_id,
    case when p_assignment_id is null then null else v_member.id end,
    v_catalog.id,
    v_actor,
    case when p_assignment_id is null then 'MANUAL' else 'PLANNED' end,
    'IN_PROGRESS',
    v_title,
    now(),
    v_delay,
    nullif(trim(p_payload->>'relatedEntityType'),''),
    nullif(trim(p_payload->>'relatedEntityId'),''),
    coalesce(p_payload->'metadata','{}'::jsonb)||jsonb_build_object(
      'startedVersion','11.34.1',
      'approvalRequired',false,
      'photoRequired',true,
      'timeReviewThresholdSeconds',3600
    )
  ) returning * into v_exec;

  if p_assignment_id is not null then
    update erp_supply.work_assignment_members
    set status='IN_PROGRESS',
        first_started_at=coalesce(first_started_at,now())
    where id=v_member.id;
  end if;

  insert into erp_supply.work_activity_events(
    organization_id,
    execution_id,
    assignment_id,
    profile_id,
    actor_profile_id,
    event_type,
    payload
  ) values(
    v_org,
    v_exec.id,
    p_assignment_id,
    v_actor,
    v_actor,
    'STARTED',
    jsonb_build_object(
      'title',v_title,
      'catalogId',v_catalog.id,
      'source',case when p_assignment_id is null then 'MANUAL' else 'PLANNED' end,
      'approvalRequired',false,
      'version','11.34.1'
    )
  );

  return jsonb_build_object(
    'success',true,
    'executionId',v_exec.id,
    'status',v_exec.status,
    'startedAt',v_exec.started_at,
    'title',v_title,
    'approvalRequired',false,
    'version','11.34.1'
  );
end;
$$;

revoke all on function public.erp_x_work_start(uuid,uuid,jsonb) from public,anon;
grant execute on function public.erp_x_work_start(uuid,uuid,jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. UNA SOLA COLA GERENCIAL, SOLO PARA EXCEPCIONES DE TIEMPO
-- ---------------------------------------------------------------------------
create or replace function public.erp_x_work_manager_queue(p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path=erp_supply,public,auth,pg_catalog
as $$
declare
  v_actor uuid:=erp_supply.require_profile();
  v_org uuid:=erp_supply.current_org_id();
  v_limit integer:=greatest(1,least(coalesce(p_limit,50),50));
  v_time_reviews jsonb;
  v_recent_reviews jsonb;
begin
  if not (
    erp_supply.has_role('super_admin')
    or erp_supply.has_role('gerencia')
    or erp_supply.work_can_approve_scope('LOGISTICS')
    or erp_supply.work_can_approve_scope('MANAGEMENT')
  ) then
    raise exception 'No autorizado para revisar la jornada del equipo' using errcode='42501';
  end if;

  select coalesce(jsonb_agg(to_jsonb(q) order by q."endedAt" desc),'[]'::jsonb)
  into v_time_reviews
  from(
    select
      e.id "executionId",
      e.assignment_id "assignmentId",
      e.profile_id "profileId",
      p.display_name "profileName",
      coalesce(a.title,e.title_snapshot,c.name) title,
      c.name "catalogName",
      c.activity_group "activityGroup",
      e.started_at "startedAt",
      e.ended_at "endedAt",
      coalesce(e.active_seconds,0) "activeSeconds",
      coalesce(e.paused_seconds,0) "pausedSeconds",
      coalesce(e.business_seconds,0) "businessSeconds",
      coalesce(e.metadata->>'timeReviewStatus','PENDING') "timeReviewStatus",
      coalesce(m.submitted_at,e.ended_at) "submittedAt",
      (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'type',w.evidence_type,
              'fileName',w.file_name,
              'webViewLink',w.web_view_link,
              'createdAt',w.created_at
            )
            order by
              case when w.evidence_type in('FINAL_PHOTO','AFTER_PHOTO') then 0 else 1 end,
              w.created_at desc
          ),
          '[]'::jsonb
        )
        from erp_supply.work_evidence w
        where w.execution_id=e.id
      ) evidence
    from erp_supply.work_executions e
    join erp_supply.profiles p on p.id=e.profile_id
    join erp_supply.work_activity_catalog c on c.id=e.catalog_id
    left join erp_supply.work_assignments a on a.id=e.assignment_id
    left join erp_supply.work_assignment_members m on m.id=e.assignment_member_id
    where e.organization_id=v_org
      and e.status='SUBMITTED'
      and coalesce((e.metadata->>'timeReviewRequired')::boolean,false)
      and coalesce(e.metadata->>'timeReviewStatus','PENDING')='PENDING'
      and e.profile_id<>v_actor
      and (
        erp_supply.has_role('super_admin')
        or erp_supply.has_role('gerencia')
        or erp_supply.can_manage_work_profile(e.profile_id,'ACTIVITY')
      )
    order by e.ended_at desc
    limit v_limit
  ) q;

  select coalesce(jsonb_agg(to_jsonb(q) order by q."reviewedAt" desc),'[]'::jsonb)
  into v_recent_reviews
  from(
    select
      e.id "executionId",
      e.profile_id "profileId",
      p.display_name "profileName",
      coalesce(a.title,e.title_snapshot,c.name) title,
      coalesce(e.active_seconds,0) "activeSeconds",
      e.metadata->>'timeReviewStatus' "decision",
      e.metadata->>'timeReviewNote' "note",
      nullif(e.metadata->>'timeReviewedAt','')::timestamptz "reviewedAt",
      reviewer.display_name "reviewedBy"
    from erp_supply.work_executions e
    join erp_supply.profiles p on p.id=e.profile_id
    join erp_supply.work_activity_catalog c on c.id=e.catalog_id
    left join erp_supply.work_assignments a on a.id=e.assignment_id
    left join erp_supply.profiles reviewer
      on reviewer.id=erp_supply.safe_uuid(e.metadata->>'timeReviewedBy')
    where e.organization_id=v_org
      and e.metadata->>'timeReviewStatus' in('REVIEWED','OBSERVED')
      and (
        erp_supply.has_role('super_admin')
        or erp_supply.has_role('gerencia')
        or erp_supply.can_manage_work_profile(e.profile_id,'ACTIVITY')
      )
    order by nullif(e.metadata->>'timeReviewedAt','')::timestamptz desc nulls last
    limit 20
  ) q;

  return jsonb_build_object(
    'timeReviews',coalesce(v_time_reviews,'[]'::jsonb),
    'recentReviews',coalesce(v_recent_reviews,'[]'::jsonb),
    'summary',jsonb_build_object(
      'timeReviews',jsonb_array_length(coalesce(v_time_reviews,'[]'::jsonb)),
      'recentReviews',jsonb_array_length(coalesce(v_recent_reviews,'[]'::jsonb)),
      'limit',v_limit
    ),
    'version','11.34.1',
    'serverTime',now()
  );
end;
$$;

revoke all on function public.erp_x_work_manager_queue(integer) from public,anon;
grant execute on function public.erp_x_work_manager_queue(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. RESOLVER REVISIÓN DE TIEMPO CON SEGREGACIÓN DE FUNCIONES
-- ---------------------------------------------------------------------------
create or replace function public.erp_x_work_review_time(
  p_execution_id uuid,
  p_decision text default 'REVIEWED',
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=erp_supply,public,auth,pg_catalog
as $$
declare
  v_actor uuid:=erp_supply.require_profile();
  v_exec erp_supply.work_executions%rowtype;
  v_decision text:=upper(trim(coalesce(p_decision,'REVIEWED')));
  v_note text:=nullif(regexp_replace(trim(coalesce(p_note,'')),'\s+',' ','g'),'');
begin
  if not (
    erp_supply.has_role('super_admin')
    or erp_supply.has_role('gerencia')
    or erp_supply.work_can_approve_scope('LOGISTICS')
    or erp_supply.work_can_approve_scope('MANAGEMENT')
  ) then
    raise exception 'No autorizado para revisar tiempos' using errcode='42501';
  end if;

  if v_decision not in('REVIEWED','OBSERVED') then
    raise exception 'Decisión de revisión inválida';
  end if;

  if v_decision='OBSERVED' and coalesce(char_length(v_note),0)<5 then
    raise exception 'Agrega una observación breve';
  end if;

  select * into v_exec
  from erp_supply.work_executions
  where id=p_execution_id
    and organization_id=erp_supply.current_org_id()
  for update;

  if not found then
    raise exception 'Actividad no disponible';
  end if;

  if v_exec.profile_id=v_actor then
    raise exception 'No puedes revisar tu propio tiempo' using errcode='42501';
  end if;

  if not (
    erp_supply.has_role('super_admin')
    or erp_supply.has_role('gerencia')
    or erp_supply.can_manage_work_profile(v_exec.profile_id,'ACTIVITY')
  ) then
    raise exception 'No autorizado para este funcionario' using errcode='42501';
  end if;

  if coalesce((v_exec.metadata->>'timeReviewRequired')::boolean,false) is not true
     or coalesce(v_exec.metadata->>'timeReviewStatus','PENDING')<>'PENDING'
     or v_exec.status<>'SUBMITTED' then
    raise exception 'Esta actividad no tiene tiempo pendiente de revisión';
  end if;

  update erp_supply.work_executions
  set status='COMPLETED',
      metadata=metadata||jsonb_build_object(
        'timeReviewStatus',v_decision,
        'timeReviewedBy',v_actor,
        'timeReviewedAt',now(),
        'timeReviewNote',v_note,
        'timeReviewVersion','11.34.1'
      )
  where id=v_exec.id;

  if v_exec.assignment_member_id is not null then
    update erp_supply.work_assignment_members
    set status='COMPLETED',
        completed_at=coalesce(completed_at,now())
    where id=v_exec.assignment_member_id;
  end if;

  insert into erp_supply.work_activity_events(
    organization_id,
    execution_id,
    assignment_id,
    profile_id,
    actor_profile_id,
    event_type,
    payload
  ) values(
    v_exec.organization_id,
    v_exec.id,
    v_exec.assignment_id,
    v_exec.profile_id,
    v_actor,
    'TIME_REVIEWED',
    jsonb_build_object(
      'decision',v_decision,
      'note',v_note,
      'activeSeconds',v_exec.active_seconds,
      'version','11.34.1'
    )
  );

  return jsonb_build_object(
    'success',true,
    'executionId',v_exec.id,
    'status','COMPLETED',
    'decision',v_decision,
    'version','11.34.1'
  );
end;
$$;

revoke all on function public.erp_x_work_review_time(uuid,text,text) from public,anon;
grant execute on function public.erp_x_work_review_time(uuid,text,text) to authenticated;

notify pgrst,'reload schema';
commit;
