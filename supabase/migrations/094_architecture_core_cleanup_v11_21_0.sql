-- CRM Suministros V11.21.0
-- Saneamiento arquitectónico: los contratos públicos permanecen estables y las
-- implementaciones históricas versionadas pasan a ser núcleos privados versionless.

begin;

-- 1) Mover implementaciones históricas al dominio privado conservando OID y lógica.
alter function public.erp_x_confirm_picking_round_v10_8(uuid,jsonb) set schema erp_supply;
alter function erp_supply.erp_x_confirm_picking_round_v10_8(uuid,jsonb) rename to confirm_picking_round_core;

alter function public.erp_x_execute_cut_group_v1018(text,jsonb) set schema erp_supply;
alter function erp_supply.erp_x_execute_cut_group_v1018(text,jsonb) rename to execute_cut_group_core;

alter function public.erp_x_resolve_cut_requirement_v1018(uuid,text,jsonb) set schema erp_supply;
alter function erp_supply.erp_x_resolve_cut_requirement_v1018(uuid,text,jsonb) rename to resolve_cut_requirement_core;

alter function public.erp_x_work_my_day_v10_24_base(date) set schema erp_supply;
alter function erp_supply.erp_x_work_my_day_v10_24_base(date) rename to work_my_day_core;

alter function public.erp_x_vsm_people_core_v11130(date,date,uuid) set schema erp_supply;
alter function erp_supply.erp_x_vsm_people_core_v11130(date,date,uuid) rename to vsm_people_core;

-- 2) Los núcleos privados no son API PostgREST.
revoke all on function erp_supply.confirm_picking_round_core(uuid,jsonb) from public,anon,authenticated;
revoke all on function erp_supply.execute_cut_group_core(text,jsonb) from public,anon,authenticated;
revoke all on function erp_supply.resolve_cut_requirement_core(uuid,text,jsonb) from public,anon,authenticated;
revoke all on function erp_supply.work_my_day_core(date) from public,anon,authenticated;
revoke all on function erp_supply.vsm_people_core(date,date,uuid) from public,anon,authenticated;

-- 3) Contrato público estable: Picking.
create or replace function public.erp_x_confirm_picking_round(p_order_id uuid,p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=erp_supply.require_profile();
  v_org uuid:=erp_supply.current_org_id();
  v_row jsonb;
  v_item erp_supply.order_items%rowtype;
  v_id uuid;
  v_result text;
  v_origins jsonb;
  v_allocations jsonb:='[]'::jsonb;
  v_alloc jsonb;
  v_result_payload jsonb;
begin
  if jsonb_typeof(coalesce(p_payload->'items','[]'::jsonb))<>'array' then raise exception 'Resultados de Alistamiento inválidos'; end if;

  for v_row in select value from jsonb_array_elements(p_payload->'items') loop
    v_id:=erp_supply.safe_uuid(v_row->>'orderItemId');
    v_result:=upper(coalesce(v_row->>'result',''));
    v_origins:=coalesce(v_row->'origins','[]'::jsonb);
    select i.* into v_item
    from erp_supply.order_items i
    join erp_supply.orders o on o.id=i.order_id
    where i.id=v_id and i.order_id=p_order_id and o.organization_id=v_org
      and erp_supply.can_view_order(o.id) and i.item_status not in('FULFILLED','CANCELLED');
    if not found then raise exception 'Línea de Alistamiento no disponible'; end if;
    if v_result='FOUND' and not v_item.requires_cut then perform erp_supply.validate_picking_origins(v_item,v_origins,false); end if;
  end loop;

  for v_row in select value from jsonb_array_elements(p_payload->'items') loop
    v_id:=erp_supply.safe_uuid(v_row->>'orderItemId');
    v_result:=upper(coalesce(v_row->>'result',''));
    v_origins:=coalesce(v_row->'origins','[]'::jsonb);
    select * into v_item from erp_supply.order_items
    where id=v_id and order_id=p_order_id and item_status not in('FULFILLED','CANCELLED');
    if v_result='FOUND' and not v_item.requires_cut then
      v_alloc:=erp_supply.consume_picking_origins(v_item,v_origins,v_actor);
      v_allocations:=v_allocations||jsonb_build_array(jsonb_build_object('orderItemId',v_item.id,'origins',v_alloc));
    end if;
  end loop;

  v_result_payload:=erp_supply.confirm_picking_round_core(p_order_id,p_payload);
  return v_result_payload||jsonb_build_object('inventoryAllocations',v_allocations,'inventoryTraceVersion','10.15');
end;
$function$;

-- 4) Contrato público estable: Corte agrupado.
create or replace function public.erp_x_execute_cut_group(p_group_key text,p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_org uuid:=erp_supply.current_org_id();
  v_actor uuid:=erp_supply.require_profile();
  v_exec erp_supply.cut_executions%rowtype;
  v_result jsonb;
  v_remaining numeric;
  v_batch uuid;
  v_order uuid;
begin
  select * into v_exec
  from erp_supply.cut_executions
  where organization_id=v_org and group_key=p_group_key
    and status in('IN_PROGRESS','PAUSED','WAITING_EVIDENCE')
  order by started_at desc limit 1 for update;
  if not found then raise exception 'Primero debes iniciar el corte de esta referencia'; end if;
  if v_exec.status='PAUSED' then raise exception 'El corte está pausado. Reanúdalo antes de continuar.'; end if;
  if v_exec.status='WAITING_EVIDENCE' then raise exception 'El corte físico ya terminó. Sube la foto final para cerrar la referencia.'; end if;

  v_result:=erp_supply.execute_cut_group_core(p_group_key,p_payload);
  v_batch:=erp_supply.safe_uuid(v_result->>'batchId');
  if v_batch is not null then
    update erp_supply.cut_batches
    set execution_id=v_exec.id,
        metadata=metadata||jsonb_build_object('executionId',v_exec.id,'cutFlowVersion','10.20')
    where id=v_batch;
  end if;

  update erp_supply.cut_requirements r
  set process_status='IN_PROGRESS',ready_at=null,ready_by=null,
      metadata=r.metadata||jsonb_build_object('physicalComplete',true,'evidencePending',true,'executionId',v_exec.id,'cutFlowVersion','10.20'),
      updated_at=now()
  where exists(select 1 from erp_supply.cut_execution_requirements er where er.execution_id=v_exec.id and er.cut_requirement_id=r.id)
    and r.process_status='READY' and coalesce(r.length_completed,0)>=r.total_length-0.0001;

  update erp_supply.order_items i
  set metadata=(i.metadata||jsonb_build_object('cutStatus','WAITING_EVIDENCE','cutExecutionId',v_exec.id,'cutEvidencePending',true,'cutFlowVersion','10.20')),
      updated_at=now()
  where exists(select 1 from erp_supply.cut_execution_requirements er where er.execution_id=v_exec.id and er.order_item_id=i.id)
    and exists(select 1 from erp_supply.cut_requirements r where r.order_item_id=i.id and coalesce(r.length_completed,0)>=r.total_length-0.0001);

  select coalesce(sum(greatest(r.total_length-coalesce(r.length_completed,0),0)),0)
  into v_remaining
  from erp_supply.cut_execution_requirements er
  join erp_supply.cut_requirements r on r.id=er.cut_requirement_id
  where er.execution_id=v_exec.id;

  if v_remaining<=0 then
    update erp_supply.cut_executions
    set status='WAITING_EVIDENCE',updated_at=now(),
        metadata=metadata||jsonb_build_object('physicalCompletedAt',now(),'evidenceRequired',true)
    where id=v_exec.id;
    for v_order in select distinct er.order_id from erp_supply.cut_execution_requirements er where er.execution_id=v_exec.id loop
      update erp_supply.orders o
      set metadata=jsonb_set(o.metadata,'{cutFlow}',((coalesce(o.metadata->'cutFlow','{}'::jsonb)-'completedAt'-'completedBy')||jsonb_build_object('waitingEvidence',true,'cutExecutionId',v_exec.id,'physicalCompletedAt',now())),true),
          updated_at=now()
      where o.id=v_order;
    end loop;
  end if;

  return v_result||jsonb_build_object('executionId',v_exec.id,'groupRemainingLength',v_remaining,'groupCompleted',(v_remaining<=0),'waitingEvidence',(v_remaining<=0));
end;
$function$;

-- 5) Contrato público estable: resolución de requerimiento de Corte.
create or replace function public.erp_x_resolve_cut_requirement(p_requirement_id uuid,p_resolution text,p_payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_org uuid:=erp_supply.current_org_id();
  v_exec erp_supply.cut_executions%rowtype;
  v_result jsonb;
  v_remaining numeric;
  v_req erp_supply.cut_requirements%rowtype;
  v_batch uuid;
begin
  select e.* into v_exec
  from erp_supply.cut_executions e
  join erp_supply.cut_execution_requirements er on er.execution_id=e.id
  where er.cut_requirement_id=p_requirement_id and e.organization_id=v_org
    and e.status in('IN_PROGRESS','PAUSED','WAITING_EVIDENCE')
  order by e.started_at desc limit 1 for update;
  if not found then raise exception 'Primero debes iniciar el corte de esta referencia'; end if;
  if v_exec.status='PAUSED' then raise exception 'El corte está pausado. Reanúdalo antes de continuar.'; end if;
  if v_exec.status='WAITING_EVIDENCE' then raise exception 'El corte físico ya terminó. Sube la evidencia final.'; end if;

  v_result:=erp_supply.resolve_cut_requirement_core(p_requirement_id,p_resolution,p_payload);
  select * into v_req from erp_supply.cut_requirements where id=p_requirement_id for update;
  v_batch:=v_req.cut_batch_id;
  if v_batch is not null then
    update erp_supply.cut_batches
    set execution_id=v_exec.id,
        metadata=metadata||jsonb_build_object('executionId',v_exec.id,'cutFlowVersion','10.20')
    where id=v_batch;
  end if;

  if v_req.process_status='READY' then
    update erp_supply.cut_requirements
    set process_status='IN_PROGRESS',ready_at=null,ready_by=null,
        metadata=metadata||jsonb_build_object('physicalComplete',true,'evidencePending',true,'executionId',v_exec.id,'cutFlowVersion','10.20'),updated_at=now()
    where id=v_req.id;
    update erp_supply.order_items
    set metadata=metadata||jsonb_build_object('cutStatus','WAITING_EVIDENCE','cutExecutionId',v_exec.id,'cutEvidencePending',true,'cutFlowVersion','10.20'),updated_at=now()
    where id=v_req.order_item_id and requires_cut;
  end if;

  select coalesce(sum(greatest(r.total_length-coalesce(r.length_completed,0),0)),0)
  into v_remaining
  from erp_supply.cut_execution_requirements er
  join erp_supply.cut_requirements r on r.id=er.cut_requirement_id
  where er.execution_id=v_exec.id;
  if v_remaining<=0 then
    update erp_supply.cut_executions
    set status='WAITING_EVIDENCE',updated_at=now(),
        metadata=metadata||jsonb_build_object('physicalCompletedAt',now(),'evidenceRequired',true)
    where id=v_exec.id;
  end if;
  return v_result||jsonb_build_object('executionId',v_exec.id,'groupRemainingLength',v_remaining,'groupCompleted',(v_remaining<=0),'waitingEvidence',(v_remaining<=0));
end;
$function$;

-- 6) Contrato público estable: Jornada.
create or replace function public.erp_x_work_my_day(p_day date default current_date)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_result jsonb;
  v_can_view_team boolean;
  v_can_plan_logistics boolean;
begin
  perform erp_supply.require_profile();
  v_result:=erp_supply.work_my_day_core(p_day);
  v_can_view_team:=erp_supply.has_role('jefe_logistica')
    or erp_supply.has_role('lider_logistica')
    or erp_supply.has_role('coordinador_logistico')
    or erp_supply.has_role('gerencia')
    or erp_supply.has_role('super_admin');
  v_can_plan_logistics:=erp_supply.has_role('jefe_logistica')
    or erp_supply.has_role('lider_logistica')
    or erp_supply.has_role('coordinador_logistico')
    or erp_supply.has_role('super_admin');

  return jsonb_set(
    jsonb_set(
      jsonb_set(v_result,'{permissions,canViewTeam}',to_jsonb(v_can_view_team),true),
      '{permissions,canPlanLogistics}',to_jsonb(v_can_plan_logistics),true
    ),
    '{version}',to_jsonb('11.3.0'::text),true
  );
end;
$function$;

-- 7) Contrato público estable: analítica de personas.
create or replace function public.erp_x_vsm_people(
  p_date_from date default (current_date-30),
  p_date_to date default current_date,
  p_profile_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=erp_supply.require_profile();
  v_org uuid:=erp_supply.current_org_id();
  v_result jsonb;
  v_profiles jsonb;
begin
  v_result:=erp_supply.vsm_people_core(p_date_from,p_date_to,p_profile_id);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',p.id,
      'name',p.display_name,
      'roles',coalesce(array(
        select pr.role_code from erp_supply.profile_roles pr
        where pr.profile_id=p.id order by pr.role_code
      ),'{}'::text[])
    ) order by p.display_name
  ),'[]'::jsonb)
  into v_profiles
  from erp_supply.profiles p
  where p.organization_id=v_org
    and p.active
    and not p.is_system
    and(
      p.id=v_actor
      or erp_supply.has_role('super_admin')
      or erp_supply.has_role('auditoria')
      or erp_supply.can_manage_work_profile(p.id,'ACTIVITY')
      or erp_supply.can_manage_work_profile(p.id,'DELIVERABLE')
    );

  return jsonb_set(v_result,'{profiles}',v_profiles,true);
end;
$function$;

-- 8) Contratos públicos solo para usuarios autenticados.
revoke all on function public.erp_x_confirm_picking_round(uuid,jsonb) from public,anon;
revoke all on function public.erp_x_execute_cut_group(text,jsonb) from public,anon;
revoke all on function public.erp_x_resolve_cut_requirement(uuid,text,jsonb) from public,anon;
revoke all on function public.erp_x_work_my_day(date) from public,anon;
revoke all on function public.erp_x_vsm_people(date,date,uuid) from public,anon;

grant execute on function public.erp_x_confirm_picking_round(uuid,jsonb) to authenticated;
grant execute on function public.erp_x_execute_cut_group(text,jsonb) to authenticated;
grant execute on function public.erp_x_resolve_cut_requirement(uuid,text,jsonb) to authenticated;
grant execute on function public.erp_x_work_my_day(date) to authenticated;
grant execute on function public.erp_x_vsm_people(date,date,uuid) to authenticated;

comment on function erp_supply.confirm_picking_round_core(uuid,jsonb) is 'V11.21 canonical private core for Picking confirmation.';
comment on function erp_supply.execute_cut_group_core(text,jsonb) is 'V11.21 canonical private core for grouped Cutting execution.';
comment on function erp_supply.resolve_cut_requirement_core(uuid,text,jsonb) is 'V11.21 canonical private core for Cutting requirement resolution.';
comment on function erp_supply.work_my_day_core(date) is 'V11.21 canonical private core for workforce daily workspace.';
comment on function erp_supply.vsm_people_core(date,date,uuid) is 'V11.21 canonical private core for people flow analytics.';

commit;
