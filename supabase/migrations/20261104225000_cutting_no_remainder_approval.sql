-- CRM Suministros · 2026-11-04
-- Retira EXCLUSIVAMENTE la aprobación de remanentes inferiores a 50 m en Corte.
-- Conserva disponibilidad física, conciliación del carreto, plan de cortes, merma,
-- trazabilidad e integridad de inventario. No modifica aprobaciones de otros procesos.

CREATE OR REPLACE FUNCTION public.erp_x_cutting_batch_plan(p_group_key text, p_inventory_lot_id uuid, p_reel_length numeric, p_scrap_length numeric DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'erp_supply', 'public', 'auth', 'pg_catalog'
AS $function$
declare
  v_actor uuid:=erp_supply.require_profile();
  v_org uuid:=erp_supply.current_org_id();
  v_override boolean:=erp_supply.has_role('super_admin') or erp_supply.has_role('jefe_logistica');
  v_material uuid;v_variant uuid;v_inventory_item uuid;v_lot_variant uuid;v_system_length numeric;
  v_capacity numeric;v_used numeric;v_cuts numeric;v_group_before numeric;v_group_after numeric;v_reel_remaining numeric;
  v_plan jsonb;
begin
  if not (erp_supply.can_access_module('cutting','read') or erp_supply.has_role('auxiliar_corte') or v_override) then
    raise exception 'No autorizado para planear Corte' using errcode='42501';
  end if;
  if p_inventory_lot_id is null then raise exception 'Selecciona el carreto o lote físico'; end if;
  if p_reel_length is null or p_reel_length<=0 then raise exception 'Indica la cantidad real disponible en el carreto'; end if;
  if coalesce(p_scrap_length,0)<0 then raise exception 'La merma no puede ser negativa'; end if;

  select min(r.material_master_id::text)::uuid,min(r.material_variant_id::text)::uuid,
    coalesce(sum(greatest(r.total_length-coalesce(r.length_completed,0),0)),0)
  into v_material,v_variant,v_group_before
  from erp_supply.cut_requirements r
  join erp_supply.orders o on o.id=r.order_id and o.status not in('CLOSED','CANCELLED')
  where r.organization_id=v_org and r.group_key=p_group_key and r.process_status<>'READY'
    and not exists(select 1 from erp_supply.order_issues oi where oi.order_id=o.id and oi.blocking and oi.status='OPEN')
    and (v_override or r.assigned_profile_id is null or r.assigned_profile_id=v_actor);
  if v_group_before<=0 or v_material is null then raise exception 'El grupo ya no tiene cortes pendientes'; end if;

  select l.inventory_item_id,l.material_variant_id,l.quantity_available
  into v_inventory_item,v_lot_variant,v_system_length
  from erp_supply.inventory_lots l
  join erp_supply.inventory_items ii on ii.id=l.inventory_item_id
  where l.id=p_inventory_lot_id and ii.organization_id=v_org and ii.active and ii.material_master_id=v_material
    and l.source_active and l.material_variant_id is not distinct from v_variant;
  if not found then raise exception 'El carreto seleccionado no corresponde a esta referencia y variante'; end if;

  v_capacity:=p_reel_length-coalesce(p_scrap_length,0);
  if v_capacity<=0 then raise exception 'La merma no puede consumir todo el carreto'; end if;

  select coalesce(sum(x.length_to_cut),0),coalesce(sum(x.units_to_cut),0),
    coalesce(jsonb_agg(jsonb_build_object(
      'requirementId',x.requirement_id,'orderId',x.order_id,'orderNumber',o.order_number,'clientName',o.client_name,
      'orderItemId',x.order_item_id,'unitsToCut',x.units_to_cut,'lengthEach',x.length_each,'lengthToCut',x.length_to_cut,
      'unitsRemainingBefore',x.units_remaining_before,'unitsRemainingAfter',x.units_remaining_after,
      'completesRequirement',(x.units_remaining_after<=0)
    ) order by case upper(o.priority) when 'CRITICAL' then 1 when 'URGENT' then 2 when 'HIGH' then 3 when 'MEDIUM' then 4 else 5 end,o.order_number),'[]'::jsonb)
  into v_used,v_cuts,v_plan
  from erp_supply.cut_plan_rows(v_org,p_group_key,v_capacity,v_actor,v_override) x
  join erp_supply.orders o on o.id=x.order_id;

  if v_used<=0 then
    return jsonb_build_object(
      'canExecute',false,'reason','Ningún corte completo cabe en la cantidad indicada para este carreto.',
      'systemLength',v_system_length,'confirmedLength',p_reel_length,'discrepancy',p_reel_length-v_system_length,
      'groupRemainingBefore',v_group_before,'groupRemainingAfter',v_group_before,'plannedLength',0,'plannedCuts',0,
      'plan','[]'::jsonb
    );
  end if;

  v_reel_remaining:=p_reel_length-v_used-coalesce(p_scrap_length,0);
  v_group_after:=greatest(v_group_before-v_used,0);

  return jsonb_build_object(
    'canExecute',true,
    'inventoryLotId',p_inventory_lot_id,
    'systemLength',v_system_length,
    'confirmedLength',p_reel_length,
    'discrepancy',round((p_reel_length-v_system_length)::numeric,4),
    'plannedLength',v_used,
    'plannedCuts',v_cuts,
    'scrapLength',coalesce(p_scrap_length,0),
    'reelRemaining',v_reel_remaining,
    'groupRemainingBefore',v_group_before,
    'groupRemainingAfter',v_group_after,
    'groupCompleted',(v_group_after<=0),
    'partialBatch',(v_group_after>0),
    'plan',v_plan
  );
end;
$function$;

CREATE OR REPLACE FUNCTION erp_supply.execute_cut_group_core(p_group_key text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'erp_supply', 'public', 'auth', 'pg_catalog'
AS $function$
declare
  v_actor uuid:=erp_supply.require_profile();
  v_org uuid:=erp_supply.current_org_id();
  v_override boolean:=erp_supply.has_role('super_admin') or erp_supply.has_role('jefe_logistica');
  v_reel numeric:=erp_supply.safe_numeric(p_payload->>'reelLength');
  v_scrap numeric:=coalesce(erp_supply.safe_numeric(p_payload->>'scrapLength'),0);
  v_lot_id uuid:=erp_supply.safe_uuid(p_payload->>'inventoryLotId');
  v_expected_planned numeric:=erp_supply.safe_numeric(p_payload->>'expectedPlannedLength');
  v_material uuid;v_variant uuid;v_reference text;v_description text;
  v_group_before numeric;v_group_after numeric;v_used numeric;v_cuts numeric;v_reel_remaining numeric;
  v_inventory_item erp_supply.inventory_items%rowtype;
  v_lot erp_supply.inventory_lots%rowtype;
  v_system_length numeric;v_difference numeric;
  v_batch erp_supply.cut_batches%rowtype;
  v_plan record;
  v_req erp_supply.cut_requirements%rowtype;
  v_job erp_supply.cut_jobs%rowtype;
  v_new_units numeric;v_new_length numeric;
  v_orders uuid[]:='{}'::uuid[];
  v_order_id uuid;
  v_count integer:=0;
  v_remaining_cuts numeric;
begin
  if not (erp_supply.can_access_module('cutting','update') or erp_supply.has_role('auxiliar_corte') or v_override) then
    raise exception 'No autorizado para ejecutar cortes' using errcode='42501';
  end if;
  if nullif(trim(p_group_key),'') is null then raise exception 'Grupo de corte requerido'; end if;
  if v_lot_id is null then raise exception 'Selecciona el carreto o lote físico del que vas a cortar'; end if;
  if v_reel is null or v_reel<=0 then raise exception 'Indica la cantidad real disponible en el carreto'; end if;
  if v_scrap<0 then raise exception 'La merma no puede ser negativa'; end if;

  -- Bloquea todos los requerimientos del grupo antes de calcular el plan definitivo.
  perform 1
  from erp_supply.cut_requirements r
  join erp_supply.orders o on o.id=r.order_id and o.status not in('CLOSED','CANCELLED')
  where r.organization_id=v_org and r.group_key=p_group_key and r.process_status<>'READY'
    and not exists(select 1 from erp_supply.order_issues oi where oi.order_id=o.id and oi.blocking and oi.status='OPEN')
    and (v_override or r.assigned_profile_id is null or r.assigned_profile_id=v_actor)
  for update of r;

  select min(r.material_master_id::text)::uuid,min(r.material_variant_id::text)::uuid,max(r.reference),max(r.description),
    coalesce(sum(greatest(r.total_length-coalesce(r.length_completed,0),0)),0)
  into v_material,v_variant,v_reference,v_description,v_group_before
  from erp_supply.cut_requirements r
  join erp_supply.orders o on o.id=r.order_id and o.status not in('CLOSED','CANCELLED')
  where r.organization_id=v_org and r.group_key=p_group_key and r.process_status<>'READY'
    and not exists(select 1 from erp_supply.order_issues oi where oi.order_id=o.id and oi.blocking and oi.status='OPEN')
    and (v_override or r.assigned_profile_id is null or r.assigned_profile_id=v_actor);
  if v_group_before<=0 or v_material is null then raise exception 'El grupo ya no tiene cortes pendientes'; end if;

  select ii.* into v_inventory_item
  from erp_supply.inventory_items ii
  where ii.organization_id=v_org and ii.active and ii.material_master_id=v_material
  for update;
  if not found then raise exception 'No existe inventario oficial para esta referencia'; end if;

  select l.* into v_lot
  from erp_supply.inventory_lots l
  where l.id=v_lot_id and l.inventory_item_id=v_inventory_item.id and l.source_active
    and l.material_variant_id is not distinct from v_variant
  for update;
  if not found then raise exception 'El carreto seleccionado no corresponde a la misma referencia y variante'; end if;

  v_system_length:=v_lot.quantity_available;

  select coalesce(sum(x.length_to_cut),0),coalesce(sum(x.units_to_cut),0)
  into v_used,v_cuts
  from erp_supply.cut_plan_rows(v_org,p_group_key,v_reel-v_scrap,v_actor,v_override) x;

  if v_used<=0 then raise exception 'Ningún corte completo cabe en la cantidad real indicada para este carreto'; end if;
  if v_expected_planned is not null and abs(v_expected_planned-v_used)>0.0001 then
    raise exception 'El plan de corte cambió desde la vista previa. Vuelve a revisar antes de confirmar.';
  end if;

  v_reel_remaining:=v_reel-v_used-v_scrap;
  if v_reel_remaining<0 then raise exception 'La cantidad del carreto no alcanza para el plan calculado'; end if;

  -- Recuento físico: el auxiliar confirma cuánto hay realmente antes de cortar.
  v_difference:=v_reel-v_system_length;
  if abs(v_difference)>0.0001 then
    update erp_supply.inventory_lots
    set quantity_available=v_reel,
        metadata=metadata||jsonb_build_object('lastPhysicalCountAt',now(),'lastPhysicalCountBy',v_actor,'previousSystemLength',v_system_length,'confirmedPhysicalLength',v_reel)
    where id=v_lot.id
    returning * into v_lot;

    insert into erp_supply.inventory_movements(
      organization_id,inventory_item_id,lot_id,movement_type,quantity,unit,from_location,to_location,
      actor_profile_id,reference,metadata
    ) values(
      v_org,v_inventory_item.id,v_lot.id,
      case when v_difference>0 then 'ADJUSTMENT_IN' else 'ADJUSTMENT_OUT' end,
      abs(v_difference),'M',v_lot.location,v_lot.location,v_actor,'RECUENTO-CARRETO',
      jsonb_build_object('previousLength',v_system_length,'confirmedLength',v_reel,'difference',v_difference,'groupKey',p_group_key,'source','CUT_MULTI_REEL_V10_18')
    );

    insert into erp_supply.order_events(
      organization_id,order_id,event_type,action_code,from_step_code,to_step_code,actor_profile_id,actor_role_code,payload
    )
    select distinct v_org,r.order_id,'DOMAIN_RECORD','CUT_REEL_RECOUNT','ALISTAMIENTO','ALISTAMIENTO',v_actor,(erp_supply.current_roles())[1],
      jsonb_build_object('groupKey',p_group_key,'inventoryLotId',v_lot.id,'lotNumber',v_lot.lot_number,'previousLength',v_system_length,'confirmedLength',v_reel,'difference',v_difference,'nonBlocking',true)
    from erp_supply.cut_requirements r
    where r.organization_id=v_org and r.group_key=p_group_key and r.process_status<>'READY';
  end if;

  v_group_after:=greatest(v_group_before-v_used,0);

  insert into erp_supply.cut_batches(
    organization_id,group_key,reference,description,inventory_item_id,inventory_lot_id,
    resolution_code,reel_initial_length,requested_length,scrap_length,remaining_length,executed_by,metadata
  ) values(
    v_org,p_group_key,v_reference,v_description,v_inventory_item.id,v_lot.id,'CUT',
    v_reel,v_used,v_scrap,v_reel_remaining,v_actor,
    jsonb_build_object(
      'lotNumber',v_lot.lot_number,'serialNumber',v_lot.serial_number,'warehouseCode',v_lot.warehouse_code,
      'location',v_lot.location,'locationName',v_lot.source_location_name,'version','10.18',
      'groupRemainingBefore',v_group_before,'groupRemainingAfter',v_group_after,'partialBatch',(v_group_after>0),
      'systemLengthBefore',v_system_length,'confirmedPhysicalLength',v_reel,'inventoryDifference',v_difference
    )
  ) returning * into v_batch;

  for v_plan in
    select * from erp_supply.cut_plan_rows(v_org,p_group_key,v_reel-v_scrap,v_actor,v_override)
  loop
    select * into v_req from erp_supply.cut_requirements where id=v_plan.requirement_id for update;
    if not found or v_req.process_status='READY' then continue; end if;

    insert into erp_supply.cut_batch_allocations(
      organization_id,cut_batch_id,cut_requirement_id,order_id,order_item_id,
      units_cut,length_each,total_length,inventory_lot_id
    ) values(
      v_org,v_batch.id,v_req.id,v_req.order_id,v_req.order_item_id,
      v_plan.units_to_cut,v_plan.length_each,v_plan.length_to_cut,v_lot.id
    );

    insert into erp_supply.order_item_allocations(
      organization_id,order_id,order_item_id,inventory_item_id,inventory_lot_id,quantity,unit,
      allocation_type,status,actor_profile_id,metadata
    ) values(
      v_org,v_req.order_id,v_req.order_item_id,v_inventory_item.id,v_lot.id,v_plan.length_to_cut,'M',
      'CUTTING','CONSUMED',v_actor,jsonb_build_object(
        'cutBatchId',v_batch.id,'cutRequirementId',v_req.id,'groupKey',p_group_key,
        'unitsCut',v_plan.units_to_cut,'lengthEach',v_plan.length_each,'version','10.18'
      )
    );

    insert into erp_supply.cut_jobs(
      order_id,order_item_id,inventory_lot_id,requested_length,actual_length,scrap_length,
      status,assigned_profile_id,started_at,completed_at,metadata
    ) values(
      v_req.order_id,v_req.order_item_id,v_lot.id,v_plan.length_to_cut,v_plan.length_to_cut,0,
      'COMPLETED',v_actor,now(),now(),jsonb_build_object(
        'mode','CUT','batchId',v_batch.id,'units',v_plan.units_to_cut,'lengthEach',v_plan.length_each,
        'partialRequirement',(v_plan.units_remaining_after>0),'cutFlowVersion','10.18'
      )
    ) returning * into v_job;

    v_new_units:=least(v_req.units_required,coalesce(v_req.units_completed,0)+v_plan.units_to_cut);
    v_new_length:=least(v_req.total_length,coalesce(v_req.length_completed,0)+v_plan.length_to_cut);

    update erp_supply.cut_requirements
    set units_completed=v_new_units,
        length_completed=v_new_length,
        process_status=case when v_new_length>=total_length-0.0001 then 'READY' else 'IN_PROGRESS' end,
        resolution_code=case when v_new_length>=total_length-0.0001 then 'CUT' else resolution_code end,
        collection_status=case when v_new_length>=total_length-0.0001 then 'PENDING' else collection_status end,
        cut_batch_id=v_batch.id,cut_job_id=v_job.id,inventory_lot_id=v_lot.id,
        ready_at=case when v_new_length>=total_length-0.0001 then now() else ready_at end,
        ready_by=case when v_new_length>=total_length-0.0001 then v_actor else ready_by end,
        assigned_profile_id=v_actor,
        metadata=metadata||jsonb_build_object(
          'lastCutBatchId',v_batch.id,'lastInventoryLotId',v_lot.id,'lastCutAt',now(),
          'unitsCompleted',v_new_units,'lengthCompleted',v_new_length,
          'remainingUnits',greatest(units_required-v_new_units,0),'remainingLength',greatest(total_length-v_new_length,0),
          'cutOrigins',coalesce(metadata->'cutOrigins','[]'::jsonb)||jsonb_build_array(jsonb_build_object(
            'batchId',v_batch.id,'inventoryLotId',v_lot.id,'lotNumber',v_lot.lot_number,'location',v_lot.location,
            'unitsCut',v_plan.units_to_cut,'length',v_plan.length_to_cut
          )),
          'multiReel',true,'cutFlowVersion','10.18'
        ),
        updated_at=now()
    where id=v_req.id
    returning * into v_req;

    if v_req.process_status='READY' then
      update erp_supply.order_items
      set metadata=metadata||jsonb_build_object(
        'cutStatus','READY','cutResolution','CUT','cutRequirementId',v_req.id,
        'cutBatchId',v_batch.id,'cutReadyAt',now(),'cutReadyBy',v_actor,
        'cutLengthCompleted',v_req.length_completed,'cutUnitsCompleted',v_req.units_completed,'multiReel',true
      ),updated_at=now()
      where id=v_req.order_item_id;
    else
      update erp_supply.order_items
      set metadata=metadata||jsonb_build_object(
        'cutStatus','IN_PROGRESS','cutRequirementId',v_req.id,'lastCutBatchId',v_batch.id,
        'cutLengthCompleted',v_req.length_completed,'cutUnitsCompleted',v_req.units_completed,
        'cutLengthRemaining',greatest(v_req.total_length-v_req.length_completed,0),'multiReel',true
      ),updated_at=now()
      where id=v_req.order_item_id;

      -- La reserva lógica conserva únicamente lo que todavía falta consumir físicamente.
      update erp_supply.material_reservations
      set quantity=greatest(v_req.total_length-v_req.length_completed,0),
          shortage_quantity=least(shortage_quantity,greatest(v_req.total_length-v_req.length_completed,0)),
          metadata=metadata||jsonb_build_object(
            'originalQuantity',coalesce(metadata->'originalQuantity',to_jsonb(quantity)),
            'partialConsumedBy','CORTE','lastCutBatchId',v_batch.id,'remainingQuantity',greatest(v_req.total_length-v_req.length_completed,0)
          ),
          updated_at=now()
      where order_item_id=v_req.order_item_id and status='ACTIVE';
    end if;

    if not (v_req.order_id=any(v_orders)) then v_orders:=array_append(v_orders,v_req.order_id); end if;
    v_count:=v_count+1;
  end loop;

  update erp_supply.inventory_lots
  set quantity_available=v_reel_remaining,
      metadata=metadata||jsonb_build_object('lastCutBatchId',v_batch.id,'lastCutAt',now(),'lastCutGroupKey',p_group_key)
  where id=v_lot.id;

  insert into erp_supply.inventory_movements(
    organization_id,inventory_item_id,lot_id,movement_type,quantity,unit,from_location,
    actor_profile_id,reference,metadata
  ) values(
    v_org,v_inventory_item.id,v_lot.id,'CUT_CONSUMPTION',v_used+v_scrap,'M',v_lot.location,
    v_actor,v_batch.id::text,jsonb_build_object(
      'cutLength',v_used,'scrapLength',v_scrap,'remainingLength',v_reel_remaining,
      'groupKey',p_group_key,'batchId',v_batch.id,'version','10.18'
    )
  );

  foreach v_order_id in array v_orders loop
    perform erp_supply.advance_cut_order_if_ready(v_order_id,v_actor);
  end loop;

  select coalesce(sum(greatest(r.total_length-coalesce(r.length_completed,0),0)),0),
         coalesce(sum(greatest(r.units_required-coalesce(r.units_completed,0),0)),0)
  into v_group_after,v_remaining_cuts
  from erp_supply.cut_requirements r
  join erp_supply.orders o on o.id=r.order_id and o.status not in('CLOSED','CANCELLED')
  where r.organization_id=v_org and r.group_key=p_group_key and r.process_status<>'READY';

  update erp_supply.orders o
  set metadata=metadata||jsonb_build_object('cutFlow',coalesce(metadata->'cutFlow','{}'::jsonb)||jsonb_build_object(
    'version','10.18','parallel',true,'multiReel',true,'lastBatchId',v_batch.id,'lastBatchAt',now()
  )),updated_at=now()
  where o.id=any(v_orders);

  return jsonb_build_object(
    'success',true,'batchId',v_batch.id,'processedRequirements',v_count,'processedCuts',v_cuts,
    'cutLength',v_used,'scrapLength',v_scrap,'reelRemaining',v_reel_remaining,
    'inventoryLotId',v_lot.id,'lotNumber',v_lot.lot_number,'inventoryDifference',v_difference,
    'groupRemainingLength',v_group_after,'remainingCuts',v_remaining_cuts,'groupCompleted',(v_group_after<=0)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.erp_x_cutting_optimizer(p_group_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'erp_supply', 'public', 'auth', 'pg_catalog'
AS $function$
declare
  v_actor uuid:=erp_supply.require_profile();v_org uuid:=erp_supply.current_org_id();
  v_override boolean:=erp_supply.has_role('jefe_logistica') or erp_supply.has_role('super_admin') or erp_supply.has_role('gerencia');
  v_needed numeric;v_reference text;v_sku text;v_description text;v_material uuid;v_variant uuid;v_variant_label text;
  v_candidates jsonb;v_recommended jsonb;
begin
  if not (erp_supply.can_access_module('cutting','read') or erp_supply.has_role('auxiliar_corte') or v_override) then
    raise exception 'No autorizado para consultar el optimizador de Corte' using errcode='42501';
  end if;
  if nullif(trim(p_group_key),'') is null then raise exception 'Grupo de corte requerido'; end if;

  select coalesce(sum(greatest(r.total_length-coalesce(r.length_completed,0),0)),0),max(r.reference),max(r.sku),max(r.description),
    min(r.material_master_id::text)::uuid,min(r.material_variant_id::text)::uuid
  into v_needed,v_reference,v_sku,v_description,v_material,v_variant
  from erp_supply.cut_requirements r
  join erp_supply.orders o on o.id=r.order_id and o.status not in('CLOSED','CANCELLED')
  where r.organization_id=v_org and r.group_key=p_group_key and r.process_status<>'READY'
    and not exists(select 1 from erp_supply.order_issues oi where oi.order_id=o.id and oi.blocking and oi.status='OPEN')
    and (v_override or r.assigned_profile_id is null or r.assigned_profile_id=v_actor);
  if v_needed<=0 then raise exception 'El grupo ya no tiene cortes pendientes'; end if;
  if v_material is null then raise exception 'El grupo no tiene identidad oficial Siesa'; end if;
  select variant_label into v_variant_label from erp_supply.material_variants where id=v_variant;

  with candidates as (
    select l.id lot_id,l.lot_number,l.serial_number,l.location,l.source_location_name,l.warehouse_code,l.source_system,
      l.quantity_available usable_length,
      (select coalesce(sum(p.length_to_cut),0) from erp_supply.cut_plan_rows(v_org,p_group_key,l.quantity_available,v_actor,v_override) p) planned_length,
      (select coalesce(sum(p.units_to_cut),0) from erp_supply.cut_plan_rows(v_org,p_group_key,l.quantity_available,v_actor,v_override) p) planned_cuts
    from erp_supply.inventory_items ii
    join erp_supply.inventory_lots l on l.inventory_item_id=ii.id
    where ii.organization_id=v_org and ii.active and ii.material_master_id=v_material
      and l.source_active and l.quantity_available>0 and l.material_variant_id is not distinct from v_variant
  ), ranked as (
    select c.*,
      c.usable_length-c.planned_length projected_remaining,
      (c.planned_length>=v_needed-0.0001) sufficient,
      row_number() over(order by
        case when c.planned_length>=v_needed-0.0001 then 0 else 1 end,
        case when c.planned_length>=v_needed-0.0001 then c.usable_length-c.planned_length else -c.planned_length end,
        c.usable_length desc
      ) operational_rank
    from candidates c
    where c.planned_length>0
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'lotId',lot_id,'lotNumber',lot_number,'serialNumber',serial_number,'location',location,'locationName',source_location_name,
    'warehouseCode',warehouse_code,'sourceSystem',source_system,'usableLength',usable_length,
    'plannedLength',planned_length,'plannedCuts',planned_cuts,'projectedRemaining',projected_remaining,
    'sufficient',sufficient,'operationalRank',operational_rank
  ) order by operational_rank),'[]'::jsonb),
  (select jsonb_build_object(
    'lotId',r2.lot_id,'lotNumber',r2.lot_number,'serialNumber',r2.serial_number,'location',r2.location,'locationName',r2.source_location_name,
    'warehouseCode',r2.warehouse_code,'sourceSystem',r2.source_system,'usableLength',r2.usable_length,
    'plannedLength',r2.planned_length,'plannedCuts',r2.planned_cuts,'projectedRemaining',r2.projected_remaining,
    'sufficient',r2.sufficient
  ) from ranked r2 order by r2.operational_rank limit 1)
  into v_candidates,v_recommended
  from (select * from ranked order by operational_rank limit 10) r;

  return jsonb_build_object(
    'groupKey',p_group_key,'reference',v_reference,'sku',v_sku,'description',v_description,
    'materialMasterId',v_material,'materialVariantId',v_variant,'variantLabel',v_variant_label,
    'requiredLength',v_needed,'recommended',v_recommended,'bestMaterialUse',v_recommended,
    'candidates',v_candidates,'generatedAt',now(),
    'rule',jsonb_build_object('strategy','Completar la referencia con uno o varios carretos; nunca mezclar material o variante')
  );
end;
$function$;

-- La RPC especializada ya no tiene consumidores en el frontend.
-- Los registros históricos de aprobación se conservan (0 solicitudes al verificar).
DROP FUNCTION IF EXISTS public.erp_x_request_cut_remainder_approval(text,jsonb);
