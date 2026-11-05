-- Recogida selectiva de materiales de Corte por el auxiliar polivalente designado.
-- Los cortes antiguos sin ayudante asignado conservan sus permisos previos.

CREATE OR REPLACE FUNCTION public.erp_x_confirm_cut_pickup(p_order_id uuid, p_requirement_ids jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'erp_supply', 'public', 'auth'
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

  update erp_supply.orders
  set metadata=metadata||jsonb_build_object('cutFlow',coalesce(metadata->'cutFlow','{}'::jsonb)||jsonb_build_object(
      'pendingCollection',v_remaining,'lastPickupAt',now(),'lastPickupBy',v_actor,
      'earlyPickup',(v_order.current_step_code='CORTE'),
      'allCollectedAt',case when v_remaining=0 then to_jsonb(now()) else metadata#>'{cutFlow,allCollectedAt}' end
    )),version=version+1,updated_at=now()
  where id=p_order_id;

  insert into erp_supply.order_events(organization_id,order_id,task_id,event_type,action_code,from_step_code,to_step_code,actor_profile_id,actor_role_code,payload)
  values(v_org,p_order_id,v_task.id,'DOMAIN_RECORD','CUT_PICKUP',v_order.current_step_code,v_order.current_step_code,v_actor,(erp_supply.current_roles())[1],jsonb_build_object('collected',v_count,'remaining',v_remaining,'earlyPickup',(v_order.current_step_code='CORTE')));

  return jsonb_build_object('success',true,'collected',v_count,'remaining',v_remaining,'allCollected',(v_remaining=0),'stage',v_order.current_step_code);
end;
$function$;

CREATE OR REPLACE FUNCTION public.erp_x_cut_pickup_detail(p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'erp_supply', 'public', 'auth', 'pg_catalog'
AS $function$
declare
  v_org uuid:=erp_supply.current_org_id();
  v_actor uuid:=erp_supply.require_profile();
  v_order erp_supply.orders%rowtype;
  v_task erp_supply.order_tasks%rowtype;
  v_override boolean:=erp_supply.has_role('super_admin') or erp_supply.has_role('jefe_logistica');
  v_is_picker boolean:=erp_supply.has_role('aux_logistica');
  v_picking_profile uuid;
  v_helper_allowed boolean:=false;
  v_legacy_allowed boolean:=false;
begin
  select * into v_order from erp_supply.orders where id=p_order_id and organization_id=v_org;
  if not found or v_order.current_step_code not in('CORTE','ALISTAMIENTO') then raise exception 'El pedido no tiene cortes disponibles para recoger'; end if;
  v_picking_profile:=erp_supply.safe_uuid(v_order.metadata#>>'{receptionAssignment,pickingProfileId}');

  v_helper_allowed:=exists(
    select 1 from erp_supply.cut_requirements r
    where r.order_id=p_order_id and r.process_status='READY' and r.collection_status='PENDING'
      and (v_override or r.metadata->>'cutPickupProfileId'=v_actor::text
        or (r.metadata->>'cutPickupProfileId' is null and v_legacy_allowed))
      and r.metadata->>'cutPickupProfileId'=v_actor::text
  );

  if v_order.current_step_code='ALISTAMIENTO' then
    select * into v_task from erp_supply.order_tasks
    where order_id=p_order_id and step_code='ALISTAMIENTO' and status in('QUEUED','ASSIGNED','IN_PROGRESS','WAITING','BLOCKED')
    order by sequence_no desc limit 1;
    if not found then raise exception 'No existe tarea activa de Alistamiento'; end if;
    v_legacy_allowed:=v_override or ((v_task.assigned_profile_id is null or v_task.assigned_profile_id=v_actor) and erp_supply.can_view_order(v_order.id));
    if not v_helper_allowed and not v_legacy_allowed then raise exception 'La recogida está asignada a otro auxiliar' using errcode='42501'; end if;
  elsif not v_override then
    v_legacy_allowed:=v_is_picker and (v_picking_profile is null or v_picking_profile=v_actor);
    if not v_helper_allowed and not v_legacy_allowed then raise exception 'La recogida está asignada a otro auxiliar' using errcode='42501'; end if;
  end if;

  if not exists(select 1 from erp_supply.cut_requirements r where r.order_id=p_order_id and r.process_status='READY' and r.collection_status='PENDING'
      and (v_override or r.metadata->>'cutPickupProfileId'=v_actor::text
        or (r.metadata->>'cutPickupProfileId' is null and v_legacy_allowed))) then
    raise exception 'No quedan cortes pendientes de recoger';
  end if;

  return jsonb_build_object(
    'order',jsonb_build_object('id',v_order.id,'orderNumber',v_order.order_number,'clientName',v_order.client_name,'priority',v_order.priority,'route',v_order.delivery_route_code,'currentStep',v_order.current_step_code),
    'task',case when v_task.id is null then null else to_jsonb(v_task) end,
    'pickupWhileCutting',(v_order.current_step_code='CORTE'),
    'cutsStillPending',(select count(*) from erp_supply.cut_requirements r where r.order_id=p_order_id and r.process_status<>'READY'),
    'items',(select coalesce(jsonb_agg(jsonb_build_object(
      'requirementId',r.id,'orderItemId',r.order_item_id,'lineNumber',i.line_number,
      'sku',r.sku,'reference',r.reference,'description',r.description,
      'unitsRequired',r.units_required,'lengthEach',r.length_each,'totalLength',r.total_length,
      'resolution',r.resolution_code,'readyAt',r.ready_at,
      'lotNumber',coalesce((select case when count(distinct a.inventory_lot_id)>1 then count(distinct a.inventory_lot_id)::text||' carretos' else max(l.lot_number) end from erp_supply.cut_batch_allocations a left join erp_supply.inventory_lots l on l.id=a.inventory_lot_id where a.cut_requirement_id=r.id),l_last.lot_number),
      'location',coalesce((select case when count(distinct a.inventory_lot_id)>1 then 'Varios orígenes' else max(l.location) end from erp_supply.cut_batch_allocations a left join erp_supply.inventory_lots l on l.id=a.inventory_lot_id where a.cut_requirement_id=r.id),l_last.location),
      'origins',(select coalesce(jsonb_agg(jsonb_build_object(
        'inventoryLotId',z.inventory_lot_id,'lotNumber',z.lot_number,'location',z.location,'warehouseCode',z.warehouse_code,
        'totalLength',z.total_length,'batches',z.batch_count
      ) order by z.lot_number),'[]'::jsonb) from (
        select a.inventory_lot_id,max(l.lot_number) lot_number,max(l.location) location,max(l.warehouse_code) warehouse_code,
          sum(a.total_length) total_length,count(distinct a.cut_batch_id) batch_count
        from erp_supply.cut_batch_allocations a
        left join erp_supply.inventory_lots l on l.id=a.inventory_lot_id
        where a.cut_requirement_id=r.id
        group by a.inventory_lot_id
      ) z)
    ) order by i.line_number),'[]'::jsonb)
      from erp_supply.cut_requirements r
      join erp_supply.order_items i on i.id=r.order_item_id
      left join erp_supply.inventory_lots l_last on l_last.id=r.inventory_lot_id
      where r.order_id=p_order_id and r.process_status='READY' and r.collection_status='PENDING'
      and (v_override or r.metadata->>'cutPickupProfileId'=v_actor::text
        or (r.metadata->>'cutPickupProfileId' is null and v_legacy_allowed))),
    'remaining',(select count(*) from erp_supply.cut_requirements r where r.order_id=p_order_id and r.process_status='READY' and r.collection_status='PENDING'
      and (v_override or r.metadata->>'cutPickupProfileId'=v_actor::text
        or (r.metadata->>'cutPickupProfileId' is null and v_legacy_allowed)))
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.erp_x_cut_pickups_pending(p_search text DEFAULT NULL::text, p_page integer DEFAULT 1, p_page_size integer DEFAULT 50)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'erp_supply', 'public', 'auth'
AS $function$
declare
  v_org uuid:=erp_supply.current_org_id();
  v_actor uuid:=erp_supply.require_profile();
  v_page integer:=greatest(coalesce(p_page,1),1);
  v_size integer:=least(greatest(coalesce(p_page_size,50),1),100);
  v_override boolean:=erp_supply.has_role('super_admin') or erp_supply.has_role('jefe_logistica');
  v_is_picker boolean:=erp_supply.has_role('aux_logistica');
  v_total bigint;
  v_items jsonb;
begin
  if not (erp_supply.can_access_module('picking','read') or v_is_picker or v_override) then
    raise exception 'No autorizado para consultar cortes por recoger' using errcode='42501';
  end if;

  with eligible as (
    select o.id
    from erp_supply.orders o
    left join lateral (
      select t.* from erp_supply.order_tasks t
      where t.order_id=o.id and t.step_code='ALISTAMIENTO'
        and t.status in('QUEUED','ASSIGNED','IN_PROGRESS','WAITING','BLOCKED')
      order by t.sequence_no desc limit 1
    ) pt on true
    where o.organization_id=v_org and o.current_step_code in('CORTE','ALISTAMIENTO')
      and exists(select 1 from erp_supply.cut_requirements r where r.order_id=o.id and r.process_status='READY' and r.collection_status='PENDING')
      and (
        v_override
        or exists(
          select 1 from erp_supply.cut_requirements rr
          where rr.order_id=o.id and rr.process_status='READY' and rr.collection_status='PENDING'
            and (rr.metadata->>'cutPickupProfileId'=v_actor::text
              or (rr.metadata->>'cutPickupProfileId' is null and (
          (o.current_step_code='ALISTAMIENTO' and pt.id is not null
             and (pt.assigned_profile_id is null or pt.assigned_profile_id=v_actor)
             and erp_supply.can_view_order(o.id))
          or (o.current_step_code='CORTE' and v_is_picker and (
             erp_supply.safe_uuid(o.metadata#>>'{receptionAssignment,pickingProfileId}') is null
             or erp_supply.safe_uuid(o.metadata#>>'{receptionAssignment,pickingProfileId}')=v_actor
          ))
        )))
        )
      )
      and (p_search is null or p_search='' or lower(o.order_number||' '||o.client_name) like '%'||lower(p_search)||'%')
  ) select count(*) into v_total from eligible;

  with eligible as (
    select o.*,
      coalesce(pt.assigned_profile_id,erp_supply.safe_uuid(o.metadata#>>'{receptionAssignment,pickingProfileId}')) pickup_assignee_id,
      coalesce(tp.display_name,rp.display_name) assignee_name,
      (select count(*) from erp_supply.cut_requirements r where r.order_id=o.id and r.process_status='READY' and r.collection_status='PENDING') pickup_count,
      (select coalesce(sum(r.total_length),0) from erp_supply.cut_requirements r where r.order_id=o.id and r.process_status='READY' and r.collection_status='PENDING') pickup_length,
      (select count(*) from erp_supply.cut_requirements r where r.order_id=o.id and r.process_status<>'READY') cuts_still_pending,
      erp_supply.business_seconds_between(v_org,o.updated_at,now()) age_seconds
    from erp_supply.orders o
    left join lateral (
      select t.* from erp_supply.order_tasks t
      where t.order_id=o.id and t.step_code='ALISTAMIENTO'
        and t.status in('QUEUED','ASSIGNED','IN_PROGRESS','WAITING','BLOCKED')
      order by t.sequence_no desc limit 1
    ) pt on true
    left join erp_supply.profiles tp on tp.id=pt.assigned_profile_id
    left join erp_supply.profiles rp on rp.id=erp_supply.safe_uuid(o.metadata#>>'{receptionAssignment,pickingProfileId}')
    where o.organization_id=v_org and o.current_step_code in('CORTE','ALISTAMIENTO')
      and exists(select 1 from erp_supply.cut_requirements r where r.order_id=o.id and r.process_status='READY' and r.collection_status='PENDING')
      and (
        v_override
        or exists(
          select 1 from erp_supply.cut_requirements rr
          where rr.order_id=o.id and rr.process_status='READY' and rr.collection_status='PENDING'
            and (rr.metadata->>'cutPickupProfileId'=v_actor::text
              or (rr.metadata->>'cutPickupProfileId' is null and (
          (o.current_step_code='ALISTAMIENTO' and pt.id is not null
             and (pt.assigned_profile_id is null or pt.assigned_profile_id=v_actor)
             and erp_supply.can_view_order(o.id))
          or (o.current_step_code='CORTE' and v_is_picker and (
             erp_supply.safe_uuid(o.metadata#>>'{receptionAssignment,pickingProfileId}') is null
             or erp_supply.safe_uuid(o.metadata#>>'{receptionAssignment,pickingProfileId}')=v_actor
          ))
        )))
        )
      )
      and (p_search is null or p_search='' or lower(o.order_number||' '||o.client_name) like '%'||lower(p_search)||'%')
    order by case o.priority when 'CRITICAL' then 1 when 'URGENT' then 2 when 'HIGH' then 3 else 4 end,o.updated_at
    offset (v_page-1)*v_size limit v_size
  ) select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'orderNumber',order_number,'clientName',client_name,'orderType',order_type_code,
    'paymentCondition',payment_condition_code,'route',delivery_route_code,'currentStep',current_step_code,
    'stepName',case when current_step_code='CORTE' then 'Recogida anticipada desde Corte' else 'Cortes por recoger' end,
    'status',status,'priority',priority,'assigneeName',assignee_name,'pickupAssigneeId',pickup_assignee_id,
    'ageBusinessSeconds',age_seconds,'cutPickupPendingCount',pickup_count,'cutPickupTotalLength',pickup_length,
    'cutsStillPending',cuts_still_pending,'cutPickupLabel',true,'pickupWhileCutting',(current_step_code='CORTE'),'version',version
  )),'[]'::jsonb) into v_items from eligible;

  return jsonb_build_object('items',v_items,'pagination',jsonb_build_object(
    'page',v_page,'pageSize',v_size,'totalItems',v_total,'totalPages',ceil(v_total::numeric/v_size)::integer
  ),'generatedAt',now());
end;
$function$;
