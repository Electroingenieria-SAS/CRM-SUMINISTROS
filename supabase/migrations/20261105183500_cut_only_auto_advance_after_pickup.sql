-- Finalizar automáticamente la espera de Corte solo después de recogida íntegra y validada.


CREATE OR REPLACE FUNCTION erp_supply.finish_cut_only_order_if_collected(p_order_id uuid,p_actor uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'erp_supply','public','auth','pg_catalog'
AS $function$
declare
 v_order erp_supply.orders%rowtype;
 v_task erp_supply.order_tasks%rowtype;
 v_ids jsonb:='[]'::jsonb;
begin
 if p_order_id is null or p_actor is null then return false; end if;
 select * into v_order from erp_supply.orders o where o.id=p_order_id for update;
 if not found or v_order.current_step_code<>'ALISTAMIENTO'
   or not coalesce((v_order.metadata#>>'{receptionAssignment,pickingNotRequired}')::boolean,false)
 then return false; end if;
 if not exists(select 1 from erp_supply.profiles p where p.id=p_actor
    and p.organization_id=v_order.organization_id and p.active) then return false; end if;

 -- Regla estricta: si existe una línea convencional, jamás se omite Alistamiento.
 if exists(select 1 from erp_supply.order_items i where i.order_id=p_order_id
    and coalesce(i.metadata->>'receptionActive','true')<>'false'
    and not i.requires_cut and i.item_status<>'CANCELLED') then return false; end if;
 if not exists(select 1 from erp_supply.order_items i where i.order_id=p_order_id
    and coalesce(i.metadata->>'receptionActive','true')<>'false'
    and i.requires_cut and i.item_status<>'CANCELLED') then return false; end if;

 -- No se avanza si falta cortar o recoger una referencia física.
 if exists(select 1 from erp_supply.order_items i
    where i.order_id=p_order_id and i.requires_cut and i.item_status<>'CANCELLED'
      and coalesce(i.metadata->>'receptionActive','true')<>'false'
      and not exists(select 1 from erp_supply.cut_requirements cr where cr.order_item_id=i.id
        and cr.order_id=p_order_id and cr.process_status='READY'
        and cr.collection_status='COLLECTED'
        and cr.units_completed>=cr.units_required)) then return false; end if;
 if exists(select 1 from erp_supply.cut_requirements cr where cr.order_id=p_order_id
    and (cr.process_status<>'READY' or cr.collection_status<>'COLLECTED'
         or cr.units_completed<cr.units_required)) then return false; end if;

 select * into v_task from erp_supply.order_tasks t
 where t.order_id=p_order_id and t.step_code='ALISTAMIENTO'
   and t.status in('QUEUED','ASSIGNED','IN_PROGRESS','WAITING','BLOCKED')
 order by t.sequence_no desc limit 1 for update;
 if not found then return false; end if;

 update erp_supply.order_items i
 set item_status='FULFILLED',
   metadata=coalesce(i.metadata,'{}'::jsonb)||jsonb_build_object(
     'fulfillmentStatus','FULFILLED','fulfilledAt',now(),
     'fulfilledBy',p_actor,'fulfillmentSource','CUT_ONLY_PICKUP',
     'lastNovelty',null),
   updated_at=now()
 where i.order_id=p_order_id and i.requires_cut
   and coalesce(i.metadata->>'receptionActive','true')<>'false'
   and i.item_status not in('FULFILLED','CANCELLED');

 select coalesce(jsonb_agg(to_jsonb(i.id)),'[]'::jsonb) into v_ids
 from erp_supply.order_items i where i.order_id=p_order_id and i.requires_cut
   and coalesce(i.metadata->>'receptionActive','true')<>'false'
   and i.item_status='FULFILLED';

 update erp_supply.task_checklist
 set completed=true,completed_by=p_actor,completed_at=now(),
   note='No aplica: todos los cortes ya fueron recogidos por el auxiliar polivalente',
   metadata=metadata||jsonb_build_object('source','CUT_ONLY_AUTO','pickingNotRequired',true)
 where task_id=v_task.id and required;

 update erp_supply.orders o
 set metadata=coalesce(o.metadata,'{}'::jsonb)||jsonb_build_object('fulfillment',
   coalesce(o.metadata->'fulfillment','{}'::jsonb)||jsonb_build_object(
     'status','COMPLETE','partialLabel',false,'pendingItemCount',0,
     'foundItemCount',jsonb_array_length(v_ids),
     'currentShipmentItemIds',v_ids,'currentShipmentRequiresCut',true,
     'pickingNotRequired',true,'lastPickingAt',now(),
     'lastPickingBy',p_actor,'completedAt',now()
   )),updated_at=now()
 where o.id=p_order_id;

 -- Sin sesión de Alistamiento general no deben contabilizarse horas ficticias.
 update erp_supply.order_tasks set started_at=coalesce(started_at,now())
 where id=v_task.id;

 insert into erp_supply.order_events(
   organization_id,order_id,task_id,event_type,action_code,from_step_code,to_step_code,
   actor_profile_id,actor_role_code,payload
 ) values(
   v_order.organization_id,p_order_id,v_task.id,'DOMAIN_RECORD','PICKING_NOT_APPLICABLE',
   'ALISTAMIENTO','ALISTAMIENTO',p_actor,
   (select pr.role_code from erp_supply.profile_roles pr
      where pr.profile_id=p_actor order by pr.is_primary desc,pr.role_code limit 1),
   jsonb_build_object('reason','ALL_LINES_REQUIRE_CUT',
     'collectedCutItems',jsonb_array_length(v_ids),
     'pickingProfileId',null,'cutPickupSource','CUT_ONLY_PICKUP')
 );

 perform erp_supply.execute_action_internal(
   p_order_id,'COMPLETE',
   jsonb_build_object('resultCode','PICKING_NOT_APPLICABLE',
     'detail','Sin alistamiento general: todos los cortes terminaron y fueron recogidos',
     'pickingNotRequired',true,'cutPickupAutoAdvance',true,
     'currentShipmentRequiresCut',true),
   p_actor,true,null,'CUT-ONLY-AUTO-'||p_order_id::text
 );
 return true;
end;
$function$;
REVOKE EXECUTE ON FUNCTION erp_supply.finish_cut_only_order_if_collected(uuid,uuid) FROM PUBLIC,anon,authenticated;


CREATE OR REPLACE FUNCTION public.erp_x_confirm_cut_pickup(p_order_id uuid,p_requirement_ids jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'erp_supply','public','auth','pg_catalog'
AS $function$
declare
  v_actor uuid:=erp_supply.require_profile();
  v_org uuid:=erp_supply.current_org_id();
  v_order erp_supply.orders%rowtype;
  v_task erp_supply.order_tasks%rowtype;
  v_id uuid;
  v_value jsonb;
  v_count integer:=0;
  v_remaining integer;
  v_remaining_person integer;
  v_override boolean:=erp_supply.has_role('super_admin') or erp_supply.has_role('jefe_logistica');
  v_is_picker boolean:=erp_supply.has_role('aux_logistica');
  v_picking_profile uuid;
  v_helper_allowed boolean:=false;
  v_legacy_allowed boolean:=false;
begin
  if jsonb_typeof(coalesce(p_requirement_ids,'[]'::jsonb))<>'array' or jsonb_array_length(coalesce(p_requirement_ids,'[]'::jsonb))=0 then
    raise exception 'Marca al menos un corte como recogido';
  end if;

  select * into v_order from erp_supply.orders
  where id=p_order_id and organization_id=v_org and current_step_code in('CORTE','ALISTAMIENTO') for update;
  if not found then raise exception 'El pedido ya no tiene cortes disponibles para recoger'; end if;
  v_picking_profile:=erp_supply.safe_uuid(v_order.metadata#>>'{receptionAssignment,pickingProfileId}');

  v_helper_allowed:=exists(
    select 1 from erp_supply.cut_requirements r
    where r.order_id=p_order_id and r.process_status='READY' and r.collection_status='PENDING'
      and r.metadata->>'cutPickupProfileId'=v_actor::text
  );

  if v_order.current_step_code='ALISTAMIENTO' then
    select * into v_task from erp_supply.order_tasks
    where order_id=p_order_id and step_code='ALISTAMIENTO' and status in('QUEUED','ASSIGNED','IN_PROGRESS','WAITING','BLOCKED')
    order by sequence_no desc limit 1 for update;
    if not found then raise exception 'No existe tarea activa de Alistamiento'; end if;
    v_legacy_allowed:=v_override or (v_task.status='IN_PROGRESS' and v_task.assigned_profile_id=v_actor);
    if not v_helper_allowed and not v_override then
      if v_task.status<>'IN_PROGRESS' then raise exception 'Primero debes tomar el pedido'; end if;
      if v_task.assigned_profile_id is distinct from v_actor then raise exception 'El pedido está siendo gestionado por otro auxiliar' using errcode='42501'; end if;
    end if;
  elsif not v_override then
    v_legacy_allowed:=v_is_picker and (v_picking_profile is null or v_picking_profile=v_actor);
    if not v_helper_allowed and not v_legacy_allowed then raise exception 'La recogida está asignada a otro auxiliar' using errcode='42501'; end if;
  end if;

  for v_value in select value from jsonb_array_elements(p_requirement_ids) loop
    v_id:=erp_supply.safe_uuid(trim(both '"' from v_value::text));
    if v_id is null then raise exception 'Identificador de corte inválido'; end if;
    update erp_supply.cut_requirements
    set collection_status='COLLECTED',collected_at=now(),collected_by=v_actor,updated_at=now(),
        metadata=metadata||jsonb_build_object('collectionSource',case when v_order.current_step_code='CORTE' then 'EARLY_PICKUP_V10_10' else 'ALISTAMIENTO_V10_10' end)
    where id=v_id and order_id=p_order_id and process_status='READY' and collection_status='PENDING'
      and (v_override or metadata->>'cutPickupProfileId'=v_actor::text
        or (metadata->>'cutPickupProfileId' is null and v_legacy_allowed));
    if not found then raise exception 'La recogida corresponde a otro auxiliar polivalente o ya fue confirmada' using errcode='42501'; end if;
    v_count:=v_count+1;
  end loop;

  if v_count=0 then raise exception 'Los cortes seleccionados ya habían sido recogidos'; end if;
  select count(*) into v_remaining from erp_supply.cut_requirements where order_id=p_order_id and process_status='READY' and collection_status='PENDING';

  select count(*) into v_remaining_person from erp_supply.cut_requirements r
  where r.order_id=p_order_id and r.process_status='READY' and r.collection_status='PENDING'
    and (v_override or r.metadata->>'cutPickupProfileId'=v_actor::text
      or (r.metadata->>'cutPickupProfileId' is null and v_legacy_allowed));

  update erp_supply.orders
  set metadata=metadata||jsonb_build_object('cutFlow',coalesce(metadata->'cutFlow','{}'::jsonb)||jsonb_build_object(
      'pendingCollection',v_remaining,'lastPickupAt',now(),'lastPickupBy',v_actor,
      'earlyPickup',(v_order.current_step_code='CORTE'),
      'allCollectedAt',case when v_remaining=0 then to_jsonb(now()) else metadata#>'{cutFlow,allCollectedAt}' end
    )),version=version+1,updated_at=now()
  where id=p_order_id;

  insert into erp_supply.order_events(organization_id,order_id,task_id,event_type,action_code,from_step_code,to_step_code,actor_profile_id,actor_role_code,payload)
  values(v_org,p_order_id,v_task.id,'DOMAIN_RECORD','CUT_PICKUP',v_order.current_step_code,v_order.current_step_code,v_actor,(erp_supply.current_roles())[1],jsonb_build_object('collected',v_count,'remaining',v_remaining,'earlyPickup',(v_order.current_step_code='CORTE')));

  -- La recogida final cierra la espera de los pedidos que no tienen Alistamiento general.
  if v_remaining=0 then
    perform erp_supply.finish_cut_only_order_if_collected(p_order_id,v_actor);
  end if;

  return jsonb_build_object('success',true,'collected',v_count,'remaining',v_remaining_person,'remainingOrder',v_remaining,'allCollected',(v_remaining=0),'stage',v_order.current_step_code);
end;
$function$;
