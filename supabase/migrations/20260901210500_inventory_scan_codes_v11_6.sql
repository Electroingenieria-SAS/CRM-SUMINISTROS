alter table erp_supply.inventory_lots add column if not exists scan_code text;

create unique index if not exists inventory_lots_scan_code_uidx
  on erp_supply.inventory_lots (upper(scan_code))
  where scan_code is not null;

create or replace function erp_supply.assign_inventory_lot_scan_code()
returns trigger
language plpgsql
set search_path to 'erp_supply','pg_catalog'
as $$
begin
  if new.scan_code is null or btrim(new.scan_code)='' then
    new.scan_code := 'EI-L-' || upper(replace(new.id::text,'-',''));
  else
    new.scan_code := upper(btrim(new.scan_code));
  end if;
  return new;
end;
$$;

drop trigger if exists inventory_lots_assign_scan_code on erp_supply.inventory_lots;
create trigger inventory_lots_assign_scan_code
before insert or update of scan_code on erp_supply.inventory_lots
for each row execute function erp_supply.assign_inventory_lot_scan_code();

update erp_supply.inventory_lots
set scan_code='EI-L-' || upper(replace(id::text,'-',''))
where scan_code is null or btrim(scan_code)='';

create or replace function public.erp_x_inventory_scan_resolve(p_code text)
returns jsonb
language plpgsql
stable security definer
set search_path to 'erp_supply','public','auth','pg_catalog'
as $$
declare
  v_org uuid:=erp_supply.current_org_id();
  v_raw text:=btrim(coalesce(p_code,''));
  v_code text;
  v_result jsonb;
begin
  perform erp_supply.require_profile();
  if not erp_supply.can_access_module('inventory','read')
     and not erp_supply.can_access_module('receiving','read')
     and not erp_supply.can_access_module('cutting','read')
     and not erp_supply.has_role('super_admin') then
    raise exception 'No autorizado para consultar códigos de inventario' using errcode='42501';
  end if;
  if v_raw='' then raise exception 'Código vacío'; end if;
  v_code:=v_raw;
  if v_raw ~* '[?&]scan=' then
    v_code:=regexp_replace(v_raw,'^.*[?&]scan=([^&#]+).*$','\1','i');
  end if;
  v_code:=replace(replace(replace(v_code,'%2D','-'),'%2d','-'),'%20',' ');
  v_code:=btrim(v_code);

  select jsonb_build_object(
    'kind','INVENTORY_LOT','scanCode',l.scan_code,
    'lot',jsonb_build_object('id',l.id,'lotNumber',l.lot_number,'serialNumber',l.serial_number,'location',l.location,'warehouseCode',l.warehouse_code,'locationName',l.source_location_name,'available',l.quantity_available,'reserved',l.quantity_reserved,'blocked',l.quantity_blocked,'receivedAt',l.received_at,'expiresAt',l.expires_at,'sourceSystem',l.source_system,'sourceKey',l.source_key),
    'item',jsonb_build_object('id',i.id,'sku',i.sku,'reference',m.reference,'description',m.exact_name,'unit',m.unit,'materialMasterId',m.id,'materialVariantId',v.id,'variantLabel',v.variant_label),
    'receipt',case when wr.id is null then null else jsonb_build_object('id',wr.id,'receiptNumber',wr.receipt_number,'receivedAt',wr.received_at,'supplierName',wr.supplier_name,'purchaseOrderNumber',wr.purchase_order_number,'invoiceNumber',wr.invoice_number,'linkedPveId',wr.linked_pve_id) end,
    'version','11.6.0'
  ) into v_result
  from erp_supply.inventory_lots l
  join erp_supply.inventory_items i on i.id=l.inventory_item_id and i.organization_id=v_org and i.active
  join erp_supply.material_master m on m.id=i.material_master_id and m.active
  left join erp_supply.material_variants v on v.id=l.material_variant_id
  left join erp_supply.warehouse_receipt_lines wrl on wrl.inventory_lot_id=l.id
  left join erp_supply.warehouse_receipts wr on wr.id=wrl.receipt_id and wr.organization_id=v_org
  where l.source_active and (upper(l.scan_code)=upper(v_code) or l.id::text=v_code)
  order by wr.received_at desc nulls last
  limit 1;
  if v_result is null then raise exception 'Código de inventario no encontrado'; end if;
  return v_result;
end;
$$;

create or replace function public.erp_x_inventory_lots(p_item_id uuid default null::uuid, p_search text default null::text)
returns jsonb
language plpgsql
stable security definer
set search_path to 'erp_supply','public','auth','pg_catalog'
as $$
declare
  v_org uuid:=erp_supply.current_org_id();
  v_q text:=erp_supply.material_norm(p_search);
begin
  perform erp_supply.require_profile();
  if not erp_supply.can_access_module('inventory','read')
     and not erp_supply.can_access_module('cutting','read')
     and not erp_supply.has_role('super_admin') then
    raise exception 'No autorizado' using errcode='42501';
  end if;
  return (
    with lot_rows as (
      select l.id,l.inventory_item_id "itemId",i.sku,m.reference,m.exact_name description,m.unit,
        l.lot_number "lotNumber",l.serial_number "serialNumber",l.location,l.quantity_available available,
        l.quantity_reserved reserved,l.quantity_blocked blocked,l.expires_at "expiresAt",l.source_system "sourceSystem",
        l.warehouse_code "warehouseCode",l.source_location_name "locationName",v.id "materialVariantId",
        v.variant_label "variantLabel",l.scan_code "scanCode",l.metadata
      from erp_supply.inventory_lots l
      join erp_supply.inventory_items i on i.id=l.inventory_item_id
      join erp_supply.material_master m on m.id=i.material_master_id and m.active
      left join erp_supply.material_variants v on v.id=l.material_variant_id
      where i.organization_id=v_org and i.active and l.source_active
        and (p_item_id is null or i.id=p_item_id)
        and (v_q='' or erp_supply.material_norm(concat_ws(' ',m.reference,m.exact_name,l.lot_number,l.location,v.variant_label,l.serial_number,l.warehouse_code,l.source_location_name,l.scan_code)) like '%'||v_q||'%')
    )
    select coalesce(jsonb_agg(to_jsonb(x) order by x.description,x.location,x."lotNumber",x.id),'[]'::jsonb) from lot_rows x
  );
end;
$$;

grant execute on function public.erp_x_inventory_scan_resolve(text) to authenticated;
