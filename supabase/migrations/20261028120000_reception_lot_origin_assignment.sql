-- Recepción de pedidos: selección trazable del lote de origen para Alistamiento.
-- No reserva ni consume inventario; Alistamiento mantiene la validación física y el consumo.
-- Contratos existentes de Corte, Facturación y Despacho permanecen intactos.

create or replace function public.erp_x_reception_origin_plan(
  p_material_master_id uuid,
  p_material_variant_id uuid,
  p_quantity numeric
)
returns jsonb
language plpgsql
stable
security definer
set search_path = erp_supply, public, auth, pg_catalog
as $$
declare
  v_org uuid := erp_supply.current_org_id();
  v_total numeric := 0;
  v_remaining numeric := p_quantity;
  v_single uuid;
  v_row record;
  v_take numeric;
  v_candidates jsonb := '[]'::jsonb;
  v_plan jsonb := '[]'::jsonb;
begin
  perform erp_supply.require_profile();
  if not (erp_supply.can_access_module('receiving','update')
      or erp_supply.has_role('super_admin')
      or erp_supply.has_role('jefe_logistica')) then
    raise exception 'No autorizado para seleccionar lotes de recepción' using errcode='42501';
  end if;
  if p_material_master_id is null or p_quantity is null or p_quantity <= 0 then
    raise exception 'Material o cantidad no válidos para seleccionar origen';
  end if;

  select l.id into v_single
  from erp_supply.inventory_lots l
  join erp_supply.inventory_items i on i.id=l.inventory_item_id
  where i.organization_id=v_org and i.active and i.material_master_id=p_material_master_id
    and l.source_active and l.material_variant_id is not distinct from p_material_variant_id
    and l.quantity_available>=p_quantity
  order by l.quantity_available asc,l.received_at asc nulls last,l.id
  limit 1;

  for v_row in
    select l.id,l.inventory_item_id,l.lot_number,l.serial_number,l.location,
           l.quantity_available,l.warehouse_code,l.source_location_name,l.source_system
    from erp_supply.inventory_lots l
    join erp_supply.inventory_items i on i.id=l.inventory_item_id
    where i.organization_id=v_org and i.active and i.material_master_id=p_material_master_id
      and l.source_active and l.material_variant_id is not distinct from p_material_variant_id
      and l.quantity_available>0
    order by case when l.id=v_single then 0 else 1 end,
             case when v_single is null then l.quantity_available end desc,
             l.quantity_available asc,l.location,l.id
  loop
    v_total:=v_total+v_row.quantity_available;
    v_candidates:=v_candidates||jsonb_build_array(jsonb_build_object(
      'lotId',v_row.id,'inventoryItemId',v_row.inventory_item_id,
      'lotNumber',v_row.lot_number,'serialNumber',v_row.serial_number,
      'location',v_row.location,'locationName',v_row.source_location_name,
      'warehouseCode',v_row.warehouse_code,'available',v_row.quantity_available,
      'sourceSystem',v_row.source_system,'recommended',v_row.id=v_single
    ));
    if v_remaining>0 then
      v_take:=least(v_remaining,v_row.quantity_available);
      v_plan:=v_plan||jsonb_build_array(jsonb_build_object('lotId',v_row.id,'quantity',v_take));
      v_remaining:=v_remaining-v_take;
    end if;
  end loop;

  return jsonb_build_object(
    'required',p_quantity,'materialMasterId',p_material_master_id,
    'materialVariantId',p_material_variant_id,
    'totalAvailable',v_total,'shortage',greatest(p_quantity-v_total,0),
    'candidates',v_candidates,'suggestedPlan',v_plan
  );
end;
$$;

revoke all on function public.erp_x_reception_origin_plan(uuid,uuid,numeric) from public,anon;
grant execute on function public.erp_x_reception_origin_plan(uuid,uuid,numeric) to authenticated;

-- La recepción transaccional actual ya guarda metadata de cada línea; esta validación
-- exige que los lotes declarados sean del material/variante real y cubran la cantidad.
-- Actúa solo al confirmar una asignación, no en las operaciones posteriores del pedido.
create or replace function erp_supply.validate_reception_lot_origins()
returns trigger
language plpgsql
security invoker
set search_path = erp_supply, public, pg_catalog
as $$
declare
  v_origins jsonb;
  v_entry jsonb;
  v_lot uuid;
  v_qty numeric;
  v_sum numeric:=0;
  v_seen uuid[]:='{}'::uuid[];
  v_available numeric;
  v_org uuid;
begin
  if coalesce(new.metadata->>'receptionActive','false')<>'true'
     or not (coalesce(new.metadata,'{}'::jsonb) ? 'receptionOrigins') then
    return new;
  end if;
  if tg_op='UPDATE' then
    if coalesce(old.metadata->>'receptionActive','false')='true'
       and old.metadata->'receptionOrigins' is not distinct from new.metadata->'receptionOrigins' then
      return new;
    end if;
  end if;

  v_origins:=new.metadata->'receptionOrigins';
  if jsonb_typeof(v_origins)<>'array' then
    raise exception 'Los lotes de recepción deben ser un arreglo';
  end if;
  if new.requires_cut and jsonb_array_length(v_origins)>0 then
    raise exception 'Los materiales de Corte no admiten asignación de lotes desde Recepción';
  end if;
  if jsonb_array_length(v_origins)=0 then
    return new; -- Un faltante se reporta en Alistamiento, sin asignar un lote inexistente.
  end if;
  if new.material_master_id is null then
    raise exception 'Vincula el material al maestro oficial antes de asignar lotes';
  end if;
  select o.organization_id into v_org from erp_supply.orders o where o.id=new.order_id;
  if v_org is null then
    raise exception 'Pedido sin organización';
  end if;

  for v_entry in select value from jsonb_array_elements(v_origins) loop
    if jsonb_typeof(v_entry)<>'object' then
      raise exception 'Asignación de lote inválida';
    end if;
    begin
      v_lot:=(v_entry->>'lotId')::uuid;
      v_qty:=(v_entry->>'quantity')::numeric;
    exception when others then
      raise exception 'El lote o su cantidad no tienen formato válido';
    end;
    if v_lot is null or v_qty is null or v_qty<=0 or v_lot=any(v_seen) then
      raise exception 'La asignación contiene lotes duplicados o cantidades inválidas';
    end if;
    select l.quantity_available into v_available
    from erp_supply.inventory_lots l
    join erp_supply.inventory_items i on i.id=l.inventory_item_id
    where l.id=v_lot and i.organization_id=v_org and i.active
      and i.material_master_id=new.material_master_id
      and l.material_variant_id is not distinct from new.material_variant_id
      and l.source_active;
    if not found or v_qty>coalesce(v_available,0) then
      raise exception 'El lote asignado no corresponde al material o ya no tiene cantidad suficiente';
    end if;
    v_seen:=array_append(v_seen,v_lot);
    v_sum:=v_sum+v_qty;
  end loop;
  if abs(v_sum-new.quantity)>0.0001 then
    raise exception 'La suma de los lotes debe coincidir con la cantidad del material';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reception_lot_origins on erp_supply.order_items;
create trigger trg_reception_lot_origins
before insert or update of metadata on erp_supply.order_items
for each row execute function erp_supply.validate_reception_lot_origins();
