-- CRM Suministros V11.34.0
-- Mi jornada: cierre automático con foto final obligatoria y revisión por tiempo > 60 min.
-- Versionada únicamente. NO aplicar a producción en esta fase.
begin;

create or replace function erp_supply.work_evidence_complete(p_execution_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path=erp_supply,public,auth,pg_catalog
as $$
declare
  v_policy text;
  v_kind text;
  v_final_photo boolean:=false;
begin
  select c.activity_kind,coalesce(a.evidence_policy,c.evidence_policy,'NONE')
  into v_kind,v_policy
  from erp_supply.work_executions e
  join erp_supply.work_activity_catalog c on c.id=e.catalog_id
  left join erp_supply.work_assignments a on a.id=e.assignment_id
  where e.id=p_execution_id;

  if v_kind is null then return false; end if;

  -- V11.34.0: toda ACTIVIDAD de Mi jornada termina con evidencia fotográfica.
  -- BEFORE_AFTER conserva además la foto inicial.
  if v_kind='ACTIVITY' then
    v_final_photo:=exists(
      select 1
      from erp_supply.work_evidence
      where execution_id=p_execution_id
        and evidence_type in('FINAL_PHOTO','AFTER_PHOTO')
    );
    if v_policy='BEFORE_AFTER' then
      return v_final_photo and exists(
        select 1
        from erp_supply.work_evidence
        where execution_id=p_execution_id
          and evidence_type='BEFORE_PHOTO'
      );
    end if;
    return v_final_photo;
  end if;

  -- Entregables mantienen su política especializada.
  if v_policy='NONE' then return true; end if;
  if v_policy='FINAL_PHOTO' then
    return exists(select 1 from erp_supply.work_evidence where execution_id=p_execution_id and evidence_type in('FINAL_PHOTO','AFTER_PHOTO'));
  end if;
  if v_policy='BEFORE_AFTER' then
    return exists(select 1 from erp_supply.work_evidence where execution_id=p_execution_id and evidence_type='BEFORE_PHOTO')
       and exists(select 1 from erp_supply.work_evidence where execution_id=p_execution_id and evidence_type='AFTER_PHOTO');
  end if;
  if v_policy='FILE' then
    return exists(select 1 from erp_supply.work_evidence where execution_id=p_execution_id and evidence_type='FILE');
  end if;
  if v_policy='LINK' then
    return exists(select 1 from erp_supply.work_evidence where execution_id=p_execution_id and evidence_type='LINK' and nullif(trim(external_value),'') is not null);
  end if;
  if v_policy='ERP_REFERENCE' then
    return exists(select 1 from erp_supply.work_evidence where execution_id=p_execution_id and evidence_type='ERP_REFERENCE' and nullif(trim(external_value),'') is not null);
  end if;
  return false;
end;
$$;

revoke all on function erp_supply.work_evidence_complete(uuid) from public,anon,authenticated;

create or replace function erp_supply.sync_work_execution_completion(p_execution_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=erp_supply,public,auth,pg_catalog
as $$
declare
  v_exec erp_supply.work_executions%rowtype;
  v_assignment erp_supply.work_assignments%rowtype;
  v_catalog erp_supply.work_activity_catalog%rowtype;
  v_evidence_ok boolean:=false;
  v_acceptance boolean:=false;
  v_time_review boolean:=false;
  v_status text;
begin
  select * into v_exec
  from erp_supply.work_executions
  where id=p_execution_id
  for update;

  if not found then raise exception 'Actividad no disponible'; end if;
  if v_exec.ended_at is null then
    return jsonb_build_object('status',v_exec.status,'evidenceComplete',false,'timeReviewRequired',false);
  end if;
  if v_exec.status in('RETURNED','CANCELLED') then
    return jsonb_build_object('status',v_exec.status,'evidenceComplete',false,'timeReviewRequired',false);
  end if;

  select * into v_catalog from erp_supply.work_activity_catalog where id=v_exec.catalog_id;
  if v_exec.assignment_id is not null then
    select * into v_assignment from erp_supply.work_assignments where id=v_exec.assignment_id;
  end if;

  v_evidence_ok:=erp_supply.work_evidence_complete(v_exec.id);
  v_time_review:=v_catalog.activity_kind='ACTIVITY' and coalesce(v_exec.active_seconds,0)>3600;
  v_acceptance:=v_catalog.activity_kind='DELIVERABLE'
    and coalesce(v_assignment.acceptance_required,v_catalog.acceptance_required,false);

  v_status:=case
    when not v_evidence_ok then 'WAITING_EVIDENCE'
    when v_time_review or v_acceptance then 'SUBMITTED'
    else 'COMPLETED'
  end;

  update erp_supply.work_executions
  set status=v_status,
      metadata=metadata||jsonb_build_object(
        'timeReviewRequired',v_time_review,
        'timeReviewThresholdSeconds',3600,
        'timeReviewStatus',case when v_time_review then 'PENDING' else 'NOT_REQUIRED' end,
        'photoRequired',v_catalog.activity_kind='ACTIVITY',
        'completionVersion','11.34.0'
      )
  where id=v_exec.id;

  if v_exec.assignment_member_id is not null then
    update erp_supply.work_assignment_members
    set status=case
          when v_status='WAITING_EVIDENCE' then 'WAITING_EVIDENCE'
          when v_status='SUBMITTED' then 'SUBMITTED'
          else 'COMPLETED'
        end,
        submitted_at=case when v_status='SUBMITTED' then coalesce(submitted_at,now()) else submitted_at end,
        completed_at=case when v_status='COMPLETED' then coalesce(completed_at,now()) else completed_at end
    where id=v_exec.assignment_member_id;
  end if;

  return jsonb_build_object(
    'status',v_status,
    'evidenceComplete',v_evidence_ok,
    'acceptanceRequired',v_acceptance,
    'timeReviewRequired',v_time_review,
    'activeSeconds',coalesce(v_exec.active_seconds,0),
    'thresholdSeconds',3600
  );
end;
$$;

revoke all on function erp_supply.sync_work_execution_completion(uuid) from public,anon,authenticated;

create or replace function public.erp_x_work_finish(
  p_execution_id uuid,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=erp_supply,public,auth,pg_catalog
as $$
declare
  v_actor uuid:=erp_supply.require_profile();
  v_exec erp_supply.work_executions%rowtype;
  v_metrics jsonb;
  v_sync jsonb;
  v_time_review boolean:=false;
begin
  select * into v_exec
  from erp_supply.work_executions
  where id=p_execution_id
    and profile_id=v_actor
    and organization_id=erp_supply.current_org_id()
  for update;

  if not found then raise exception 'Actividad no disponible'; end if;
  if v_exec.status not in('IN_PROGRESS','PAUSED') then raise exception 'La actividad ya fue finalizada'; end if;

  -- La foto inicial sigue siendo obligatoria para actividades BEFORE_AFTER.
  if coalesce((
    select coalesce(a.evidence_policy,c.evidence_policy)
    from erp_supply.work_activity_catalog c
    left join erp_supply.work_assignments a on a.id=v_exec.assignment_id
    where c.id=v_exec.catalog_id
  ),'NONE')='BEFORE_AFTER' and not exists(
    select 1
    from erp_supply.work_evidence w
    where w.execution_id=v_exec.id
      and w.evidence_type='BEFORE_PHOTO'
  ) then
    raise exception 'Debes tomar la foto inicial antes de finalizar la actividad';
  end if;

  update erp_supply.work_execution_pauses
  set ended_at=now(),ended_by=v_actor
  where execution_id=v_exec.id and ended_at is null;

  update erp_supply.work_executions
  set ended_at=now()
  where id=v_exec.id;

  v_metrics:=erp_supply.work_execution_metrics(v_exec.id);
  v_time_review:=coalesce((v_metrics->>'activeSeconds')::bigint,0)>3600;

  update erp_supply.work_executions
  set elapsed_seconds=coalesce((v_metrics->>'elapsedSeconds')::bigint,0),
      active_seconds=coalesce((v_metrics->>'activeSeconds')::bigint,0),
      business_seconds=coalesce((v_metrics->>'businessSeconds')::bigint,0),
      paused_seconds=coalesce((v_metrics->>'pausedSeconds')::bigint,0),
      deviation_reason=null,
      result_note=null,
      metadata=metadata||jsonb_build_object(
        'finishedVersion','11.34.0',
        'finishedAt',now(),
        'completionMode','PHOTO_REQUIRED',
        'timeReviewRequired',v_time_review,
        'timeReviewThresholdSeconds',3600
      )
  where id=v_exec.id;

  v_sync:=erp_supply.sync_work_execution_completion(v_exec.id);

  insert into erp_supply.work_activity_events(
    organization_id,execution_id,assignment_id,profile_id,actor_profile_id,event_type,payload
  ) values(
    v_exec.organization_id,v_exec.id,v_exec.assignment_id,v_actor,v_actor,'FINISHED',
    jsonb_build_object(
      'metrics',v_metrics,
      'completion',v_sync,
      'timeReviewRequired',v_time_review,
      'completionMode','PHOTO_REQUIRED',
      'version','11.34.0'
    )
  );

  return jsonb_build_object(
    'success',true,
    'executionId',v_exec.id,
    'metrics',v_metrics,
    'completion',v_sync,
    'timeReviewRequired',v_time_review
  );
end;
$$;

revoke all on function public.erp_x_work_finish(uuid,jsonb) from public,anon;
grant execute on function public.erp_x_work_finish(uuid,jsonb) to authenticated;

-- Revisión liviana de tiempos > 1 hora. No crea tablas nuevas:
-- conserva trazabilidad en metadata + work_activity_events.
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
begin
  if not (
    erp_supply.has_role('super_admin')
    or erp_supply.has_role('jefe_logistica')
    or erp_supply.has_role('gerencia')
  ) then
    raise exception 'No autorizado para revisar tiempos' using errcode='42501';
  end if;

  if v_decision not in('REVIEWED','OBSERVED') then
    raise exception 'Decisión de revisión inválida';
  end if;
  if v_decision='OBSERVED' and nullif(trim(p_note),'') is null then
    raise exception 'Agrega una observación breve';
  end if;

  select * into v_exec
  from erp_supply.work_executions
  where id=p_execution_id
    and organization_id=erp_supply.current_org_id()
  for update;

  if not found then raise exception 'Actividad no disponible'; end if;
  if coalesce((v_exec.metadata->>'timeReviewRequired')::boolean,false) is not true
     or v_exec.status<>'SUBMITTED' then
    raise exception 'Esta actividad no tiene tiempo pendiente de revisión';
  end if;

  update erp_supply.work_executions
  set status='COMPLETED',
      metadata=metadata||jsonb_build_object(
        'timeReviewStatus',v_decision,
        'timeReviewedBy',v_actor,
        'timeReviewedAt',now(),
        'timeReviewNote',nullif(trim(p_note),''),
        'timeReviewVersion','11.34.0'
      )
  where id=v_exec.id;

  if v_exec.assignment_member_id is not null then
    update erp_supply.work_assignment_members
    set status='COMPLETED',completed_at=coalesce(completed_at,now())
    where id=v_exec.assignment_member_id;
  end if;

  insert into erp_supply.work_activity_events(
    organization_id,execution_id,assignment_id,profile_id,actor_profile_id,event_type,payload
  ) values(
    v_exec.organization_id,v_exec.id,v_exec.assignment_id,v_exec.profile_id,v_actor,'TIME_REVIEWED',
    jsonb_build_object('decision',v_decision,'note',nullif(trim(p_note),''),'version','11.34.0')
  );

  return jsonb_build_object('success',true,'executionId',v_exec.id,'status','COMPLETED','decision',v_decision);
end;
$$;

revoke all on function public.erp_x_work_review_time(uuid,text,text) from public,anon;
grant execute on function public.erp_x_work_review_time(uuid,text,text) to authenticated;

notify pgrst,'reload schema';
commit;
