-- CRM Suministros V11.44.0
-- Las actividades sin hora final usan la hora de inicio como vencimiento operativo.
-- Así continúan visibles como pendientes si no se iniciaron el día programado.
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
    if not erp_supply.work_catalog_allowed(v_catalog_id,v_profile) then raise exception 'Actividad no habilitada para el perfil'; end if;
    if v_end is not null and exists(
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
      jsonb_build_object('openEnded',v_open_ended,'selfScheduled',(v_profile=v_actor),'createdVersion','11.44.0','startsAutomatically',false)
    ) returning id into v_assignment;
    insert into erp_supply.work_assignment_members(assignment_id,profile_id,status) values(v_assignment,v_profile,'PLANNED');
    insert into erp_supply.work_activity_events(organization_id,assignment_id,profile_id,actor_profile_id,event_type,payload)
    values(v_org,v_assignment,v_profile,v_actor,'ASSIGNMENT_PUBLISHED',jsonb_build_object(
      'plannedStart',v_start,'plannedEnd',v_end,'openEnded',v_open_ended,'startsAutomatically',false,'version','11.44.0'));
    v_created:=v_created||jsonb_build_array(v_assignment);
  end loop;
  return jsonb_build_object('success',true,'createdIds',v_created,'openEnded',v_open_ended,'startsAutomatically',false,'version','11.44.0');
end;
$$;

create or replace function public.erp_x_work_propose_assignment(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=erp_supply,public,auth,pg_catalog
as $$
declare
  v_actor uuid:=erp_supply.require_profile();
  v_org uuid:=erp_supply.current_org_id();
  v_catalog_id uuid:=erp_supply.safe_uuid(p_payload->>'catalogId');
  v_catalog erp_supply.work_activity_catalog%rowtype;
  v_reason text:=regexp_replace(trim(coalesce(p_payload->>'reason','')),'\s+',' ','g');
  v_priority text:=upper(coalesce(nullif(trim(p_payload->>'priority'),''),'MEDIUM'));
  v_start timestamptz:=nullif(trim(p_payload->>'plannedStart'),'')::timestamptz;
  v_end timestamptz:=nullif(trim(p_payload->>'plannedEnd'),'')::timestamptz;
  v_open_ended boolean:=coalesce((p_payload->>'openEnded')::boolean,false);
  v_minutes integer:=greatest(1,least(coalesce(erp_supply.safe_numeric(p_payload->>'estimatedMinutes')::integer,60),720));
  v_scope text:=erp_supply.work_approval_scope_for_profile(v_actor);
  v_assignment uuid;
  v_overlap boolean:=false;
  v_outside boolean:=false;
begin
  if v_catalog_id is null then raise exception 'Selecciona una actividad del catálogo'; end if;
  select * into v_catalog from erp_supply.work_activity_catalog
  where id=v_catalog_id and organization_id=v_org and active and activity_kind='ACTIVITY';
  if not found or not erp_supply.work_catalog_allowed(v_catalog_id,v_actor) then
    raise exception 'Actividad no disponible para tu perfil' using errcode='42501';
  end if;
  if char_length(v_reason)<10 then raise exception 'La justificación debe tener al menos 10 caracteres'; end if;
  if v_priority not in('LOW','MEDIUM','HIGH','URGENT','CRITICAL') then raise exception 'Prioridad inválida'; end if;
  if v_start is null then raise exception 'Indica cuándo deseas realizar la actividad'; end if;
  if v_open_ended then v_end:=null; end if;
  if not v_open_ended and v_end is null then raise exception 'Indica una hora final o marca sin hora final estimada'; end if;
  if v_end is not null and v_end<=v_start then raise exception 'La hora final debe ser posterior al inicio'; end if;
  if v_end is not null then
    v_minutes:=greatest(1,round(extract(epoch from(v_end-v_start))/60.0)::integer);
    select exists(
      select 1 from erp_supply.work_assignment_members m
      join erp_supply.work_assignments a on a.id=m.assignment_id
      where m.profile_id=v_actor and a.status='PUBLISHED' and a.planned_start is not null and a.planned_end is not null
        and tstzrange(a.planned_start,a.planned_end,'[)') && tstzrange(v_start,v_end,'[)')
    ) into v_overlap;
    v_outside:=erp_supply.business_seconds_between(v_org,v_start,v_end)
      <greatest(0,extract(epoch from(v_end-v_start))::bigint)-60;
  end if;

  insert into erp_supply.work_assignments(
    organization_id,catalog_id,title,description,assignment_kind,status,priority,planned_start,planned_end,due_at,
    estimated_minutes,evidence_policy,acceptance_required,assigned_by,request_origin,request_reason,approval_status,
    approval_scope,requested_by,requested_at,metadata
  ) values(
    v_org,v_catalog.id,v_catalog.name,v_catalog.description,'ACTIVITY','DRAFT',v_priority,v_start,v_end,
    case when v_open_ended then v_start else null end,v_minutes,v_catalog.evidence_policy,false,v_actor,
    'SELF_PROPOSED',v_reason,'PENDING',v_scope,v_actor,now(),jsonb_build_object(
      'openEnded',v_open_ended,'requestedOverlap',v_overlap,'requestedOutsideWorkingTime',v_outside,
      'startsAutomatically',false,'createdVersion','11.44.0')
  ) returning id into v_assignment;
  insert into erp_supply.work_assignment_members(assignment_id,profile_id,status) values(v_assignment,v_actor,'PLANNED');
  insert into erp_supply.work_activity_events(organization_id,assignment_id,profile_id,actor_profile_id,event_type,payload)
  values(v_org,v_assignment,v_actor,v_actor,'ASSIGNMENT_APPROVAL_REQUESTED',jsonb_build_object(
    'catalogId',v_catalog.id,'reason',v_reason,'approvalScope',v_scope,'plannedStart',v_start,'plannedEnd',v_end,
    'openEnded',v_open_ended,'startsAutomatically',false,'version','11.44.0'));
  return jsonb_build_object('success',true,'assignmentId',v_assignment,'approvalStatus','PENDING',
    'approvalScope',v_scope,'openEnded',v_open_ended,'startsAutomatically',false,'version','11.44.0');
end;
$$;

revoke all on function public.erp_x_work_schedule(jsonb) from public,anon;
revoke all on function public.erp_x_work_propose_assignment(jsonb) from public,anon;
grant execute on function public.erp_x_work_schedule(jsonb) to authenticated,service_role;
grant execute on function public.erp_x_work_propose_assignment(jsonb) to authenticated,service_role;
select pg_notify('pgrst','reload schema');
commit;
