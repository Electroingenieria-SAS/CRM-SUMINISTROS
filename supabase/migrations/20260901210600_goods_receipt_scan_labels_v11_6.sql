create or replace function public.erp_x_goods_receipt_detail(p_receipt_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'erp_supply','public','auth','pg_catalog'
as $$
declare v_org uuid:=erp_supply.current_org_id(); v_actor uuid:=erp_supply.require_profile(); v_receipt erp_supply.warehouse_receipts%rowtype;
begin
  if not (erp_supply.can_access_module('receiving','read') or erp_supply.has_role('super_admin')) then raise exception 'No autorizado para consultar recepción' using errcode='42501'; end if;
  select * into v_receipt from erp_supply.warehouse_receipts where id=p_receipt_id and organization_id=v_org;
  if not found then raise exception 'Recepción no encontrada'; end if;
  return jsonb_build_object(
    'receipt',to_jsonb(v_receipt),
    'linkedPve',(select jsonb_build_object('id',o.id,'orderNumber',o.order_number,'clientName',o.client_name,'currentStep',o.current_step_code,'status',o.status) from erp_supply.orders o where o.id=v_receipt.linked_pve_id),
    'receivedBy',(select display_name from erp_supply.profiles where id=v_receipt.received_by),
    'verifiedBy',(select display_name from erp_supply.profiles where id=v_receipt.verified_by),
    'lines',(select coalesce(jsonb_agg(jsonb_build_object(
      'id',l.id,'orderItemId',l.linked_order_item_id,'materialMasterId',l.material_master_id,'materialVariantId',l.material_variant_id,
      'inventoryLotId',l.inventory_lot_id,'scanCode',il.scan_code,'sku',l.sku,'reference',l.reference,'description',l.description,
      'expectedQuantity',l.expected_quantity,'receivedQuantity',l.received_quantity,'acceptedQuantity',l.accepted_quantity,
      'rejectedQuantity',l.rejected_quantity,'unit',l.unit,'location',l.location,'lotNumber',coalesce(il.lot_number,l.lot_number),
      'serialNumber',coalesce(il.serial_number,l.serial_number),'qualityStatus',l.quality_status
    ) order by l.created_at),'[]'::jsonb)
    from erp_supply.warehouse_receipt_lines l
    left join erp_supply.inventory_lots il on il.id=l.inventory_lot_id
    where l.receipt_id=v_receipt.id),
    'version','11.6.0'
  );
end;
$$;

create or replace function public.erp_x_goods_receipt_labels(p_receipt_number text)
returns jsonb
language plpgsql
stable security definer
set search_path to 'erp_supply','public','auth','pg_catalog'
as $$
declare
  v_org uuid:=erp_supply.current_org_id();
  v_receipt erp_supply.warehouse_receipts%rowtype;
begin
  perform erp_supply.require_profile();
  if not (erp_supply.can_access_module('receiving','read') or erp_supply.can_access_module('inventory','read') or erp_supply.has_role('super_admin')) then
    raise exception 'No autorizado para consultar etiquetas de recepción' using errcode='42501';
  end if;
  select * into v_receipt
  from erp_supply.warehouse_receipts
  where organization_id=v_org and receipt_number=upper(btrim(p_receipt_number))
  limit 1;
  if not found then raise exception 'Recepción no encontrada'; end if;
  return jsonb_build_object(
    'receipt',jsonb_build_object('id',v_receipt.id,'receiptNumber',v_receipt.receipt_number,'receivedAt',v_receipt.received_at,'supplierName',v_receipt.supplier_name,'purchaseOrderNumber',v_receipt.purchase_order_number),
    'lines',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'lineId',l.id,'inventoryLotId',il.id,'scanCode',il.scan_code,'reference',l.reference,'description',l.description,'unit',l.unit,
        'acceptedQuantity',l.accepted_quantity,'lotNumber',il.lot_number,'serialNumber',il.serial_number,'location',il.location,
        'warehouseCode',il.warehouse_code,'locationName',il.source_location_name
      ) order by l.created_at),'[]'::jsonb)
      from erp_supply.warehouse_receipt_lines l
      join erp_supply.inventory_lots il on il.id=l.inventory_lot_id
      join erp_supply.inventory_items ii on ii.id=il.inventory_item_id and ii.organization_id=v_org
      where l.receipt_id=v_receipt.id and l.accepted_quantity>0
    ),
    'version','11.6.0'
  );
end;
$$;

grant execute on function public.erp_x_goods_receipt_labels(text) to authenticated;
