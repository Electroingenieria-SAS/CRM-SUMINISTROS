-- CRM Suministros V11.34.1
-- Bandeja gerencial de tiempos > 1h + solicitud rápida sin formulario.
-- Versionada únicamente. NO aplicar a producción mientras V11.34.x siga en preview Pages.
begin;

create or replace function public.erp_x_work_quick_request(p_catalog_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=erp_supply,public,auth,pg_catalog
as $$
declare
  v_actor uuid:=erp_supply.require_profile();
  v_org uuid:=erp_supply.current_org_id();
  v_catalog erp_supply.work_activity_catalog%rowtype;
  v_start timestamptz:=now();
  v_end timestamptz;
begin
  select * into v_catalog
  from erp_supply.work_activity_catalog
  where id=p_catalog_id
    and organization_id=v_org
    and active
    and activity_kind='ACTIVITY';

  if not found or not erp_supply.work_catalog_allowed(p_catalog_id,v_actor) then
    raise exception 'Actividad no disponible para tu perfil' using errcode='42501';
  end if;

  v_end:=v_start+(greatest(1,coalesce(v_catalog.standard_minutes,60))||' minutes')::interval;

  return public.erp_x_work_propose_assignment(
    jsonb_build_object(
      'catalogId',p_catalog_id,
      'plannedStart',v_start,
      'plannedEnd',v_end,
      'priority','MEDIUM',
      'estimatedMinutes',greatest(1,coalesce(v_catalog.standard_minutes,60)),
      'reason','Solicitud rápida desde Mi jornada',
      'startMode','NOW'
    )
  );
end;
$$;

revoke all on function public.erp_x_work_quick_request(uuid) from public,anon;
grant execute on function public.erp_x_work_quick_request(uuid) to authenticated;

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
  v_approvals jsonb;
begin
  if not (
    erp_supply.has_role('super_admin')
    or erp_supply.has_role('gerencia')
    or erp_supply.work_can_approve_scope('LOGISTICS')
    or erp_supply.work_can_approve_scope('MANAGEMENT')
  ) then
    raise exception 'No autorizado para revisar la jornada del equipo' using errcode='42501';
  end if;

  v_approvals:=public.erp_x_work_pending_approvals();

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
    limit 50
  ) q;

  return jsonb_build_object(
    'assignmentApprovals',coalesce(v_approvals,'[]'::jsonb),
    'timeReviews',coalesce(v_time_reviews,'[]'::jsonb),
    'summary',jsonb_build_object(
      'assignmentApprovals',jsonb_array_length(coalesce(v_approvals,'[]'::jsonb)),
      'timeReviews',jsonb_array_length(coalesce(v_time_reviews,'[]'::jsonb)),
      'limit',v_limit
    ),
    'version','11.34.1',
    'serverTime',now()
  );
end;
$$;

revoke all on function public.erp_x_work_manager_queue(integer) from public,anon;
grant execute on function public.erp_x_work_manager_queue(integer) to authenticated;

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

  if not found then raise exception 'Actividad no disponible'; end if;
  if v_exec.profile_id=v_actor and not erp_supply.has_role('super_admin') then
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
    organization_id,execution_id,assignment_id,profile_id,actor_profile_id,event_type,payload
  ) values(
    v_exec.organization_id,v_exec.id,v_exec.assignment_id,v_exec.profile_id,v_actor,'TIME_REVIEWED',
    jsonb_build_object('decision',v_decision,'note',v_note,'version','11.34.1')
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
