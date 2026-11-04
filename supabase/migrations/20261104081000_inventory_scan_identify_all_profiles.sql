-- Lector QR/CODE128 universal: identificación mínima para cualquier perfil operativo activo.
-- No devuelve saldos, reservas, bloqueos, costos ni datos de proveedores.
-- Reconoce códigos de lotes y comprobantes de recepción por separado.
-- Se conserva erp_x_inventory_scan_resolve como consulta detallada con sus controles de conteo ciego.
create or replace function public.erp_x_inventory_scan_identify(p_code text)
returns jsonb
language plpgsql
stable security definer
set search_path to 'erp_supply','public','auth','pg_catalog'
as $$
declare
  v_org uuid;
  v_raw text:=btrim(coalesce(p_code,''));
  v_code text;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Inicia sesión para consultar códigos' using errcode='42501';
  end if;
  perform erp_supply.require_profile();
  v_org:=erp_supply.current_org_id();
  if v_raw='' or length(v_raw)>2048 then
    raise exception 'Código de inventario inválido' using errcode='22023';
  end if;

  v_code:=v_raw;
  if v_raw ~* '[?&](scan|countScan)=' then
    v_code:=regexp_replace(v_raw,'^.*[?&](?:scan|countScan)=([^&#]+).*$','\1','i');
  end if;
  v_code:=btrim(replace(replace(replace(v_code,'%2D','-'),'%2d','-'),'%20',' '));

  select jsonb_build_object(
    'kind','INVENTORY_LOT',
    'scanCode',l.scan_code,
    'canViewStock',false,
    'lot',jsonb_build_object(
      'id',l.id,'lotNumber',l.lot_number,'serialNumber',l.serial_number,
      'location',l.location,'warehouseCode',l.warehouse_code,
      'locationName',l.source_location_name,'sourceSystem',l.source_system
    ),
    'item',jsonb_build_object(
      'reference',m.reference,'description',m.exact_name,'unit',m.unit
    ),
    'receipt',null,
    'version','11.46.4'
  ) into v_result
  from erp_supply.inventory_lots l
  join erp_supply.inventory_items i
    on i.id=l.inventory_item_id and i.organization_id=v_org and i.active
  join erp_supply.material_master m
    on m.id=i.material_master_id and m.active
  where l.source_active
    and (upper(l.scan_code)=upper(v_code) or l.id::text=v_code)
  limit 1;
  if v_result is null then
    -- Los comprobantes de Recepción imprimen un CODE128 y un QR JSON, no un EI-L-.
    -- Para otros roles solo se identifica el comprobante, sin datos del proveedor.
    select jsonb_build_object(
      'kind','WAREHOUSE_RECEIPT',
      'scanCode',w.barcode_value,
      'canViewStock',false,
      'receipt',jsonb_build_object(
        'receiptNumber',w.receipt_number,
        'receiptType',w.receipt_type
      ),
      'item',jsonb_build_object(
        'reference',w.receipt_number,
        'description','Recepción de mercancía'
      ),
      'lot',jsonb_build_object(),
      'version','11.46.4'
    ) into v_result
    from erp_supply.warehouse_receipts w
    where w.organization_id=v_org
      and (w.barcode_value=v_raw or w.qr_value=v_raw or w.receipt_number=v_code)
    limit 1;
  end if;

  if v_result is null then
    raise exception 'Código QR o de barras no encontrado' using errcode='P0002';
  end if;
  return v_result;
end;
$$;

revoke all on function public.erp_x_inventory_scan_identify(text) from public, anon;
grant execute on function public.erp_x_inventory_scan_identify(text) to authenticated;
