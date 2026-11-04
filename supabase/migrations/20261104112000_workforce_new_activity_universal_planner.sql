-- CRM SUMINISTROS v11.47.2 - permisos universales coherentes en asistente de cronograma.
-- Las actividades quedan disponibles para cualquier perfil activo de la organización.
-- La edición/planificación de terceros sigue limitada por alcance y rol.
CREATE OR REPLACE FUNCTION erp_supply.work_catalog_allowed(p_catalog_id uuid, p_profile_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'erp_supply', 'public', 'auth', 'pg_catalog'
AS $function$
  select exists(
    select 1
    from erp_supply.work_activity_catalog c
    join erp_supply.profiles p on p.id=coalesce(p_profile_id,erp_supply.current_profile_id())
    where c.id=p_catalog_id
      and c.organization_id=p.organization_id
      and c.active
      and p.active
      and (
        c.activity_kind='ACTIVITY'
        or coalesce(array_length(c.allowed_roles,1),0)=0
        or exists(
          select 1 from erp_supply.profile_roles pr
          where pr.profile_id=p.id and pr.role_code=any(c.allowed_roles)
        )
      )
  )
$function$;
CREATE OR REPLACE FUNCTION public.erp_x_work_create_catalog_item(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'erp_supply', 'public', 'auth', 'pg_catalog'
AS $function$
declare
  v_actor uuid:=erp_supply.require_profile();
  v_org uuid:=erp_supply.current_org_id();
  v_kind text:=upper(coalesce(nullif(trim(p_payload->>'kind'),''),'ACTIVITY'));
  v_scope text:=upper(coalesce(nullif(trim(p_payload->>'scope'),''),case when v_kind='DELIVERABLE' then 'MANAGEMENT' else 'LOGISTICS' end));
  v_name text:=regexp_replace(trim(coalesce(p_payload->>'name','')),'\s+',' ','g');
  v_description text:=nullif(trim(p_payload->>'description'),'');
  v_group text:=upper(coalesce(nullif(trim(p_payload->>'activityGroup'),''),case when v_scope='MANAGEMENT' then 'MANAGEMENT' else 'LOGISTICS' end));
  v_minutes integer:=greatest(1,least(coalesce(erp_supply.safe_numeric(p_payload->>'standardMinutes')::integer,60),1440));
  v_evidence text:=upper(coalesce(nullif(trim(p_payload->>'evidencePolicy'),''),case when v_kind='DELIVERABLE' then 'FILE' else 'FINAL_PHOTO' end));
  v_acceptance boolean:=coalesce((p_payload->>'acceptanceRequired')::boolean,v_kind='DELIVERABLE');
  v_team boolean:=coalesce((p_payload->>'teamAllowed')::boolean,v_kind='ACTIVITY');
  v_roles text[];
  v_existing erp_supply.work_activity_catalog%rowtype;
  v_created erp_supply.work_activity_catalog%rowtype;
  v_code text;
begin
  if v_kind not in('ACTIVITY','DELIVERABLE') then raise exception 'Tipo de actividad inválido'; end if;
  if v_scope not in('LOGISTICS','MANAGEMENT') then raise exception 'Ámbito de actividad inválido'; end if;
  if v_kind='DELIVERABLE' and v_scope<>'MANAGEMENT' then raise exception 'Los entregables pertenecen al ámbito de Gerencia'; end if;
  -- Cualquier perfil operativo activo puede crear actividades ordinarias.
  -- Los entregables y la categoría gerencial siguen sometidos a permisos específicos.
  if v_scope='MANAGEMENT' and not (erp_supply.has_role('super_admin') or erp_supply.has_role('gerencia')) then
    raise exception 'Solo Gerencia puede crear actividades para áreas administrativas' using errcode='42501';
  end if;
  if char_length(v_name)<3 or char_length(v_name)>120 then raise exception 'El nombre de la actividad debe tener entre 3 y 120 caracteres'; end if;
  if v_evidence not in('NONE','FINAL_PHOTO','BEFORE_AFTER','FILE','LINK','ERP_REFERENCE') then raise exception 'Política de evidencia inválida'; end if;
  if v_scope='LOGISTICS' and v_group not in('LOGISTICS','GENERAL','IMPROVEMENT') then raise exception 'Categoría no habilitada para logística'; end if;
  if v_scope='MANAGEMENT' and v_group not in('COMMERCIAL','FINANCE','PURCHASING','MANAGEMENT','GENERAL','IMPROVEMENT') then raise exception 'Categoría no habilitada para Gerencia'; end if;

  v_roles:=case when v_kind='ACTIVITY' then array[]::text[]
                else erp_supply.work_manager_catalog_roles(v_kind,v_scope) end;
  if v_kind='DELIVERABLE' and coalesce(array_length(v_roles,1),0)=0 then
    raise exception 'No fue posible resolver los roles para este entregable';
  end if;

  select * into v_existing
  from erp_supply.work_activity_catalog c
  where c.organization_id=v_org and c.activity_kind=v_kind and c.active
    and lower(regexp_replace(trim(c.name),'\s+',' ','g'))=lower(v_name)
  order by c.created_at limit 1;
  if found then
    return jsonb_build_object('success',true,'alreadyExists',true,'item',jsonb_build_object(
      'id',v_existing.id,'code',v_existing.code,'name',v_existing.name,'description',v_existing.description,
      'activityGroup',v_existing.activity_group,'activityKind',v_existing.activity_kind,'standardMinutes',v_existing.standard_minutes,
      'evidencePolicy',v_existing.evidence_policy,'acceptanceRequired',v_existing.acceptance_required,'teamAllowed',v_existing.team_allowed,
      'catalogOrigin',v_existing.catalog_origin),'version','11.47.2');
  end if;

  v_code:='CUSTOM_'||upper(substr(md5(v_org::text||':'||v_actor::text||':'||clock_timestamp()::text||':'||v_name),1,16));
  insert into erp_supply.work_activity_catalog(
    organization_id,code,name,description,activity_group,activity_kind,standard_minutes,evidence_policy,
    acceptance_required,team_allowed,allowed_roles,active,sort_order,metadata,created_by,catalog_origin
  ) values(
    v_org,v_code,v_name,v_description,v_group,v_kind,v_minutes,v_evidence,v_acceptance,v_team,v_roles,true,80,
    jsonb_build_object('custom',true,'createdFromPlanner',true,'managerScope',v_scope,'createdVersion','11.47.2','createdAt',now()),
    v_actor,'MANAGER_CREATED'
  ) returning * into v_created;

  insert into erp_supply.work_activity_events(organization_id,actor_profile_id,event_type,payload)
  values(v_org,v_actor,'CATALOG_ACTIVITY_CREATED',jsonb_build_object(
    'catalogId',v_created.id,'code',v_created.code,'name',v_created.name,'kind',v_created.activity_kind,'group',v_created.activity_group,
    'scope',v_scope,'standardMinutes',v_created.standard_minutes,'evidencePolicy',v_created.evidence_policy,'allowedRoles',to_jsonb(v_roles),'version','11.47.2'));

  return jsonb_build_object('success',true,'alreadyExists',false,'item',jsonb_build_object(
    'id',v_created.id,'code',v_created.code,'name',v_created.name,'description',v_created.description,
    'activityGroup',v_created.activity_group,'activityKind',v_created.activity_kind,'standardMinutes',v_created.standard_minutes,
    'evidencePolicy',v_created.evidence_policy,'acceptanceRequired',v_created.acceptance_required,'teamAllowed',v_created.team_allowed,
    'catalogOrigin',v_created.catalog_origin,'createdBy',v_created.created_by,'createdAt',v_created.created_at),'version','11.47.2');
end;
$function$;
CREATE OR REPLACE FUNCTION public.erp_x_work_save_assignment(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'erp_supply', 'public', 'auth', 'pg_catalog'
AS $function$
declare
  v_actor uuid:=erp_supply.require_profile();
  v_org uuid:=erp_supply.current_org_id();
  v_kind text:=upper(coalesce(nullif(trim(p_payload->>'kind'),''),'ACTIVITY'));
  v_catalog erp_supply.work_activity_catalog%rowtype;
  v_catalog_id uuid:=erp_supply.safe_uuid(p_payload->>'catalogId');
  v_title text:=trim(coalesce(p_payload->>'title',''));
  v_description text:=nullif(trim(p_payload->>'description'),'');
  v_priority text:=upper(coalesce(nullif(trim(p_payload->>'priority'),''),'MEDIUM'));
  v_base_start timestamptz:=nullif(trim(p_payload->>'plannedStart'),'')::timestamptz;
  v_base_end timestamptz:=nullif(trim(p_payload->>'plannedEnd'),'')::timestamptz;
  v_base_due timestamptz:=nullif(trim(p_payload->>'dueAt'),'')::timestamptz;
  v_estimated integer:=nullif(trim(p_payload->>'estimatedMinutes'),'')::integer;
  v_evidence text:=upper(nullif(trim(p_payload->>'evidencePolicy'),''));
  v_acceptance boolean:=coalesce((p_payload->>'acceptanceRequired')::boolean,v_kind='DELIVERABLE');
  v_force boolean:=coalesce((p_payload->>'force')::boolean,false);
  v_frequency text:=upper(coalesce(nullif(trim(p_payload#>>'{recurrence,frequency}'),''),'NONE'));
  v_until date:=nullif(trim(p_payload#>>'{recurrence,until}'),'')::date;
  v_series uuid:=case when v_frequency='NONE' then null else gen_random_uuid() end;
  v_occurrence integer:=0;
  v_occurrence_start timestamptz;
  v_occurrence_end timestamptz;
  v_occurrence_due timestamptz;
  v_anchor_date date;
  v_conflicts jsonb:='[]'::jsonb;
  v_created jsonb:='[]'::jsonb;
  v_assignment_id uuid;
  v_profile_id uuid;
  v_roles text[]:=erp_supply.current_roles();
begin
  if v_kind not in('ACTIVITY','DELIVERABLE') then raise exception 'Tipo de asignación inválido'; end if;
  if v_kind='DELIVERABLE' and not (erp_supply.has_role('super_admin') or erp_supply.has_role('gerencia')) then raise exception 'Solo Gerencia puede asignar entregables con fecha límite'; end if;
  if v_priority not in('LOW','MEDIUM','HIGH','URGENT','CRITICAL') then raise exception 'Prioridad inválida'; end if;
  if coalesce(jsonb_typeof(p_payload->'profileIds'),'')<>'array' or coalesce(jsonb_array_length(p_payload->'profileIds'),0)=0 then raise exception 'Selecciona al menos una persona'; end if;
  if v_frequency not in('NONE','DAILY','WEEKLY','MONTHLY') then raise exception 'Recurrencia inválida'; end if;

  if v_catalog_id is not null then
    select * into v_catalog from erp_supply.work_activity_catalog where id=v_catalog_id and organization_id=v_org and active;
    if not found then raise exception 'Tipo de actividad no disponible'; end if;
    if v_kind<>v_catalog.activity_kind and not (v_kind='ACTIVITY' and v_catalog.activity_kind='ACTIVITY') then raise exception 'El catálogo no corresponde al tipo de asignación'; end if;
  end if;
  if v_title='' then v_title:=coalesce(v_catalog.name,'Actividad programada'); end if;
  v_estimated:=coalesce(v_estimated,v_catalog.standard_minutes,60);
  v_evidence:=coalesce(v_evidence,v_catalog.evidence_policy,case when v_kind='DELIVERABLE' then 'FILE' else 'FINAL_PHOTO' end);
  if v_evidence not in('NONE','FINAL_PHOTO','BEFORE_AFTER','FILE','LINK','ERP_REFERENCE') then raise exception 'Política de evidencia inválida'; end if;
  if v_kind='DELIVERABLE' and v_base_due is null then raise exception 'El entregable necesita una fecha límite'; end if;
  if v_base_end is not null and (v_base_start is null or v_base_end<=v_base_start) then raise exception 'El horario de finalización debe ser posterior al inicio'; end if;
  if v_kind='ACTIVITY' and (v_base_start is null or v_base_end is null) then raise exception 'La actividad programada necesita fecha y hora de inicio y finalización'; end if;
  if v_frequency<>'NONE' and v_until is null then raise exception 'La recurrencia necesita una fecha final'; end if;

  for v_profile_id in select (value#>>'{}')::uuid from jsonb_array_elements(p_payload->'profileIds') loop
    if not exists(select 1 from erp_supply.profiles where id=v_profile_id and organization_id=v_org and active) then raise exception 'Uno de los usuarios no está disponible'; end if;
    -- Autoprogramación: todos pueden registrarse a sí mismos. Asignar a terceros
    -- exige rol responsable y el alcance gerencial autorizado.
    if v_profile_id<>v_actor and (
      not (v_roles && array['super_admin','jefe_logistica','lider_logistica','coordinador_logistico','gerencia']::text[])
      or not erp_supply.can_manage_work_profile(v_profile_id,v_kind)
    ) then
      raise exception 'No tienes permiso para planificar a una de las personas seleccionadas' using errcode='42501';
    end if;
    if v_catalog_id is not null and not erp_supply.work_catalog_allowed(v_catalog_id,v_profile_id) then
      raise exception 'La actividad seleccionada no está disponible para el usuario';
    end if;
  end loop;

  -- Primera pasada: detectar conflictos en toda la serie antes de escribir.
  loop
    exit when v_occurrence>=120;
    v_occurrence_start:=case v_frequency
      when 'DAILY' then v_base_start+(v_occurrence||' days')::interval
      when 'WEEKLY' then v_base_start+(v_occurrence*7||' days')::interval
      when 'MONTHLY' then v_base_start+(v_occurrence||' months')::interval
      else v_base_start end;
    v_occurrence_end:=case when v_base_end is null then null else case v_frequency
      when 'DAILY' then v_base_end+(v_occurrence||' days')::interval
      when 'WEEKLY' then v_base_end+(v_occurrence*7||' days')::interval
      when 'MONTHLY' then v_base_end+(v_occurrence||' months')::interval
      else v_base_end end end;
    v_occurrence_due:=case when v_base_due is null then null else case v_frequency
      when 'DAILY' then v_base_due+(v_occurrence||' days')::interval
      when 'WEEKLY' then v_base_due+(v_occurrence*7||' days')::interval
      when 'MONTHLY' then v_base_due+(v_occurrence||' months')::interval
      else v_base_due end end;
    v_anchor_date:=coalesce(v_occurrence_start::date,v_occurrence_due::date);
    exit when v_frequency<>'NONE' and v_anchor_date>v_until;

    if v_occurrence_start is not null and v_occurrence_end is not null then
      for v_profile_id in select (value#>>'{}')::uuid from jsonb_array_elements(p_payload->'profileIds') loop
        if v_kind='ACTIVITY' and v_profile_id=v_actor then
          -- La autoprogramación nunca se bloquea por superposición o horario.
          continue;
        end if;
        if exists(
          select 1 from erp_supply.work_assignment_members m join erp_supply.work_assignments a on a.id=m.assignment_id
          where m.profile_id=v_profile_id and a.status='PUBLISHED'
            and a.planned_start is not null and a.planned_end is not null
            and tstzrange(a.planned_start,a.planned_end,'[)') && tstzrange(v_occurrence_start,v_occurrence_end,'[)')
        ) then
          v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object(
            'profileId',v_profile_id,'plannedStart',v_occurrence_start,'plannedEnd',v_occurrence_end,'conflictType','OVERLAP','message','Ya existe una actividad en ese horario'
          ));
        end if;
        if erp_supply.business_seconds_between(v_org,v_occurrence_start,v_occurrence_end)
             < greatest(0,extract(epoch from(v_occurrence_end-v_occurrence_start))::bigint)-60 then
          v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object(
            'profileId',v_profile_id,'plannedStart',v_occurrence_start,'plannedEnd',v_occurrence_end,
            'conflictType','OUTSIDE_WORKING_TIME','message','El bloque invade tiempo no laborable, almuerzo, fin de semana o festivo'
          ));
        end if;
      end loop;
    end if;

    exit when v_frequency='NONE';
    v_occurrence:=v_occurrence+1;
  end loop;

  if jsonb_array_length(v_conflicts)>0 and not v_force then
    return jsonb_build_object('success',false,'requiresConfirmation',true,'conflicts',v_conflicts,'createdIds','[]'::jsonb);
  end if;

  v_occurrence:=0;
  loop
    exit when v_occurrence>=120;
    v_occurrence_start:=case v_frequency
      when 'DAILY' then v_base_start+(v_occurrence||' days')::interval
      when 'WEEKLY' then v_base_start+(v_occurrence*7||' days')::interval
      when 'MONTHLY' then v_base_start+(v_occurrence||' months')::interval
      else v_base_start end;
    v_occurrence_end:=case when v_base_end is null then null else case v_frequency
      when 'DAILY' then v_base_end+(v_occurrence||' days')::interval
      when 'WEEKLY' then v_base_end+(v_occurrence*7||' days')::interval
      when 'MONTHLY' then v_base_end+(v_occurrence||' months')::interval
      else v_base_end end end;
    v_occurrence_due:=case when v_base_due is null then null else case v_frequency
      when 'DAILY' then v_base_due+(v_occurrence||' days')::interval
      when 'WEEKLY' then v_base_due+(v_occurrence*7||' days')::interval
      when 'MONTHLY' then v_base_due+(v_occurrence||' months')::interval
      else v_base_due end end;
    v_anchor_date:=coalesce(v_occurrence_start::date,v_occurrence_due::date);
    exit when v_frequency<>'NONE' and v_anchor_date>v_until;

    insert into erp_supply.work_assignments(
      organization_id,catalog_id,series_id,title,description,assignment_kind,status,priority,
      planned_start,planned_end,due_at,estimated_minutes,evidence_policy,acceptance_required,assigned_by,
      related_entity_type,related_entity_id,recurrence,metadata,request_origin,approval_status,requested_by,requested_at
    ) values(
      v_org,v_catalog_id,v_series,v_title,v_description,v_kind,'PUBLISHED',v_priority,
      v_occurrence_start,v_occurrence_end,v_occurrence_due,v_estimated,v_evidence,v_acceptance,v_actor,
      nullif(trim(p_payload->>'relatedEntityType'),''),nullif(trim(p_payload->>'relatedEntityId'),''),
      coalesce(p_payload->'recurrence','{}'::jsonb),
      coalesce(p_payload->'metadata','{}'::jsonb)||jsonb_build_object('createdVersion','11.47.2','forcedConflict',v_force),
      'MANAGER_ASSIGNED','NOT_REQUIRED',v_actor,now()
    ) returning id into v_assignment_id;

    insert into erp_supply.work_assignment_members(assignment_id,profile_id,status)
    select v_assignment_id,(value#>>'{}')::uuid,'PLANNED'
    from jsonb_array_elements(p_payload->'profileIds');

    insert into erp_supply.work_activity_events(organization_id,assignment_id,actor_profile_id,event_type,payload)
    values(v_org,v_assignment_id,v_actor,'ASSIGNMENT_PUBLISHED',jsonb_build_object('kind',v_kind,'profileIds',p_payload->'profileIds','plannedStart',v_occurrence_start,'dueAt',v_occurrence_due,'seriesId',v_series));

    v_created:=v_created||jsonb_build_array(v_assignment_id);
    exit when v_frequency='NONE';
    v_occurrence:=v_occurrence+1;
  end loop;

  return jsonb_build_object('success',true,'requiresConfirmation',false,'conflicts',v_conflicts,'createdIds',v_created,'seriesId',v_series,'version','11.47.2');
end;
$function$;
revoke all on function public.erp_x_work_create_catalog_item(jsonb) from public,anon;
revoke all on function public.erp_x_work_save_assignment(jsonb) from public,anon;
grant execute on function public.erp_x_work_create_catalog_item(jsonb) to authenticated;
grant execute on function public.erp_x_work_save_assignment(jsonb) to authenticated;
