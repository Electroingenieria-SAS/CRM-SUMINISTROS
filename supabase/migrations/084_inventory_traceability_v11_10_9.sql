-- V11.10.9 · Trazabilidad operativa de inventario
-- Reproduce la migración productiva inventory_traceability_v11_10_9.

create index if not exists idx_inventory_movements_item_created_v11109
  on erp_supply.inventory_movements(inventory_item_id, created_at desc, id desc);

create index if not exists idx_inventory_movements_lot_created_v11109
  on erp_supply.inventory_movements(lot_id, created_at desc, id desc)
  where lot_id is not null;

create or replace function public.erp_x_inventory_movements(
  p_item_id uuid default null,
  p_lot_id uuid default null,
  p_page integer default 1,
  p_page_size integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'erp_supply','public','auth','pg_catalog'
as $function$
declare
  v_org uuid:=erp_supply.current_org_id();
  v_page integer:=greatest(coalesce(p_page,1),1);
  v_size integer:=least(greatest(coalesce(p_page_size,50),1),100);
  v_total bigint;
  v_items jsonb;
begin
  perform erp_supply.require_profile();

  if not erp_supply.can_access_module('inventory','read')
     and not erp_supply.can_access_module('cutting','read')
     and not erp_supply.has_role('super_admin') then
    raise exception 'No autorizado' using errcode='42501';
  end if;

  if p_item_id is not null and not exists(
    select 1
    from erp_supply.inventory_items i
    where i.id=p_item_id and i.organization_id=v_org and i.active
  ) then
    raise exception 'Material de inventario no disponible';
  end if;

  if p_lot_id is not null and not exists(
    select 1
    from erp_supply.inventory_lots l
    join erp_supply.inventory_items i on i.id=l.inventory_item_id
    where l.id=p_lot_id and i.organization_id=v_org
  ) then
    raise exception 'Lote de inventario no disponible';
  end if;

  select count(*) into v_total
  from erp_supply.inventory_movements im
  where im.organization_id=v_org
    and (p_item_id is null or im.inventory_item_id=p_item_id)
    and (p_lot_id is null or im.lot_id=p_lot_id);

  select coalesce(jsonb_agg(to_jsonb(x) order by x."createdAt" desc,x.id desc),'[]'::jsonb)
  into v_items
  from (
    select
      im.id,
      im.inventory_item_id "itemId",
      im.lot_id "lotId",
      im.movement_type "movementType",
      im.quantity,
      im.unit,
      im.from_location "fromLocation",
      im.to_location "toLocation",
      im.reference,
      im.metadata,
      im.created_at "createdAt",
      p.display_name "actorName",
      o.order_number "orderNumber",
      l.lot_number "lotNumber",
      l.serial_number "serialNumber",
      l.location,
      l.warehouse_code "warehouseCode",
      v.variant_label "variantLabel"
    from erp_supply.inventory_movements im
    left join erp_supply.profiles p on p.id=im.actor_profile_id and p.organization_id=v_org
    left join erp_supply.orders o on o.id=im.order_id and o.organization_id=v_org
    left join erp_supply.inventory_lots l on l.id=im.lot_id
    left join erp_supply.material_variants v on v.id=l.material_variant_id
    where im.organization_id=v_org
      and (p_item_id is null or im.inventory_item_id=p_item_id)
      and (p_lot_id is null or im.lot_id=p_lot_id)
    order by im.created_at desc,im.id desc
    offset (v_page-1)*v_size
    limit v_size
  ) x;

  return jsonb_build_object(
    'items',v_items,
    'pagination',jsonb_build_object(
      'page',v_page,
      'pageSize',v_size,
      'totalItems',v_total,
      'totalPages',case when v_total=0 then 0 else ceil(v_total::numeric/v_size)::integer end
    ),
    'version','11.10.9'
  );
end;
$function$;

revoke all on function public.erp_x_inventory_movements(uuid,uuid,integer,integer) from public;
grant execute on function public.erp_x_inventory_movements(uuid,uuid,integer,integer) to authenticated;
grant execute on function public.erp_x_inventory_movements(uuid,uuid,integer,integer) to service_role;
