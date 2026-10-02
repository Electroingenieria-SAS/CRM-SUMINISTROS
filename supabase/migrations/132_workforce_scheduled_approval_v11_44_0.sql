-- CRM Suministros V11.44.0
-- Programación explícita de Jornada y aprobación obligatoria para auxiliares.
-- No crea un módulo paralelo: reutiliza catálogo, asignaciones, agenda y Centro de excepciones.
begin;

create or replace function public.erp_x_work_schedule(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=erp_supply,public,auth,pg_catalog
as $$
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
  if v_is_auxiliary then
    raise exception 'Auxiliares deben programar y obtener aprobación antes de iniciar' using errcode='42501';
  end if;
  if v_catalog_id is null or v_start is null then raise exception 'Actividad e inicio son obligatorios'; end if;
  if v_priority not in('LOW','MEDIUM','HIGH','URGENT','CRITICAL') then raise exception 'Prioridad inválida'; end if;
  if v_open_ended then v_end:=null; end if;
  if not v_open_ended and v_end is null then raise exception 'Indica una hora final o marca sin hora final estimada'; end if;
  if v_end is not null and v_end<=v_start then raise exception 'La hora final debe ser posterior al inicio'; end if;

  select * into v_catalog
  from erp_supply.work_activity_catalog
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
    if not erp_supply.work_catalog_allowed(v_catalog_id,v_profile) then
      raise exception 'Actividad no habilitada para el perfil';
    end if;
    if v_end is not null and exists(
      select 1
      from erp_supply.work_assignment_members m
      join erp_supply.work_assignments a on a.id=m.assignment_id
      where m.profile_id=v_profile and a.status='PUBLISHED'
        and a.planned_start is not null and a.planned_end is not null
        and tstzrange(a.planned_start,a.planned_end,'[)') && tstzrange(v_start,v_end,'[)')
    ) and not coalesce((p_payload->>'force')::boolean,false) then
      raise exception 'Ya existe una actividad en ese horario';
    end if;

    insert into erp_supply.work_assignments(
      organization_id,catalog_id,title,description,assignment_kind,status,priority,planned_start,planned_end,
      estimated_minutes,evidence_policy,acceptance_required,assigned_by,request_origin,approval_status,
      requested_by,requested_at,metadata
    ) values(
      v_org,v_catalog.id,coalesce(nullif(trim(p_payload->>'title'),''),v_catalog.name),
      nullif(trim(p_payload->>'description'),''),'ACTIVITY','PUBLISHED',v_priority,v_start,v_end,
      v_minutes,coalesce(nullif(trim(p_payload->>'evidencePolicy'),''),v_catalog.evidence_policy),false,
      v_actor,'MANAGER_ASSIGNED','NOT_REQUIRED',v_actor,now(),
      jsonb_build_object('openEnded',v_open_ended,'selfScheduled',(v_profile=v_actor),'createdVersion','11.44.0','startsAutomatically',false)
    ) returning id into v_assignment;

    insert into erp_supply.work_assignment_members(assignment_id,profile_id,status)
    values(v_assignment,v_profile,'PLANNED');

    insert into erp_supply.work_activity_events(organization_id,assignment_id,profile_id,actor_profile_id,event_type,payload)
    values(v_org,v_assignment,v_profile,v_actor,'ASSIGNMENT_PUBLISHED',
      jsonb_build_object('plannedStart',v_start,'plannedEnd',v_end,'openEnded',v_open_ended,'startsAutomatically',false,'version','11.44.0'));
    v_created:=v_created||jsonb_build_array(v_assignment);
  end loop;

  return jsonb_build_object('success',true,'createdIds',v_created,'openEnded',v_open_ended,'startsAutomatically',false,'version','11.44.0');
end;
$$;

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
  v_roles text[]:=erp_supply.current_roles();
  v_is_manager boolean:=v_roles && array['super_admin','gerencia','jefe_logistica','lider_logistica','coordinador_logistico']::text[];
  v_is_auxiliary boolean:=(v_roles && array['aux_logistica','auxiliar_corte']::text[]) and not v_is_manager;
  v_catalog erp_supply.work_activity_catalog%rowtype;
  v_assignment erp_supply.work_assignments%rowtype;
  v_member erp_supply.work_assignment_members%rowtype;
  v_exec erp_supply.work_executions%rowtype;
  v_title text;
  v_delay bigint:=0;
begin
  if exists(select 1 from erp_supply.work_executions where profile_id=v_actor and status in('IN_PROGRESS','PAUSED')) then
    raise exception 'Ya tienes una actividad cronometrada. Finalízala antes de iniciar otra.';
  end if;
  if exists(select 1 from erp_supply.cut_executions where started_by=v_actor and status='IN_PROGRESS') then
    raise exception 'Tienes un corte en ejecución. Pausa o termina Corte antes de iniciar otra actividad.';
  end if;

  select * into v_catalog
  from erp_supply.work_activity_catalog
  where id=p_catalog_id and organization_id=v_org and active and activity_kind='ACTIVITY';
  if not found or not erp_supply.work_catalog_allowed(p_catalog_id,v_actor) then
    raise exception 'Actividad no disponible para tu perfil' using errcode='42501';
  end if;

  if p_assignment_id is null and v_is_auxiliary then
    raise exception 'Auxiliares deben programar y obtener aprobación antes de iniciar' using errcode='42501';
  end if;

  if p_assignment_id is not null then
    select * into v_assignment
    from erp_supply.work_assignments
    where id=p_assignment_id and organization_id=v_org and status='PUBLISHED'
    for update;
    if not found then raise exception 'La actividad programada ya no está disponible'; end if;
    if v_assignment.request_origin='SELF_PROPOSED' and v_assignment.approval_status<>'APPROVED' then
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
    if v_assignment.planned_start is not null and now()<v_assignment.planned_start-interval '15 minutes' then
      raise exception 'Esta actividad estará disponible 15 minutos antes del horario programado';
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
      'startedVersion','11.44.0','approvalRequired',v_is_auxiliary,'photoRequired',true,'timeReviewThresholdSeconds',3600
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
      'approvalRequired',v_is_auxiliary,'version','11.44.0')
  );

  return jsonb_build_object('success',true,'executionId',v_exec.id,'status',v_exec.status,'startedAt',v_exec.started_at,
    'title',v_title,'approvalRequired',v_is_auxiliary,'version','11.44.0');
end;
$$;

create or replace function public.erp_x_work_my_day(p_day date default current_date)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_result jsonb;
  v_roles text[];
  v_is_manager boolean;
  v_is_auxiliary boolean;
begin
  perform erp_supply.require_profile();
  v_roles:=erp_supply.current_roles();
  v_result:=erp_supply.work_my_day_core(p_day);
  v_is_manager:=v_roles && array['super_admin','gerencia','jefe_logistica','lider_logistica','coordinador_logistico']::text[];
  v_is_auxiliary:=(v_roles && array['aux_logistica','auxiliar_corte']::text[]) and not v_is_manager;

  v_result:=jsonb_set(v_result,'{permissions,canViewTeam}',to_jsonb(v_is_manager),true);
  v_result:=jsonb_set(v_result,'{permissions,canPlanLogistics}',to_jsonb(v_is_manager),true);
  v_result:=jsonb_set(v_result,'{permissions,canDirectStart}',to_jsonb(not v_is_auxiliary),true);
  v_result:=jsonb_set(v_result,'{permissions,requiresActivityApproval}',to_jsonb(v_is_auxiliary),true);
  v_result:=jsonb_set(v_result,'{permissions,canApproveActivities}',to_jsonb(
    erp_supply.work_can_approve_scope('LOGISTICS') or erp_supply.work_can_approve_scope('MANAGEMENT')
  ),true);
  return jsonb_set(v_result,'{version}',to_jsonb('11.44.0'::text),true);
end;
$function$;

revoke all on function public.erp_x_work_schedule(jsonb) from public,anon;
revoke all on function public.erp_x_work_start(uuid,uuid,jsonb) from public,anon;
revoke all on function public.erp_x_work_my_day(date) from public,anon;
grant execute on function public.erp_x_work_schedule(jsonb) to authenticated,service_role;
grant execute on function public.erp_x_work_start(uuid,uuid,jsonb) to authenticated,service_role;
grant execute on function public.erp_x_work_my_day(date) to authenticated,service_role;

comment on function public.erp_x_work_schedule(jsonb) is 'V11.44 programs activities without starting them; auxiliary roles must use approval proposal flow.';
comment on function public.erp_x_work_start(uuid,uuid,jsonb) is 'V11.44 starts explicitly and blocks direct auxiliary starts without an approved assignment.';

select pg_notify('pgrst','reload schema');
commit;
