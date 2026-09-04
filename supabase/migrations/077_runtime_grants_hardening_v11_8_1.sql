-- CRM Suministros V11.8.1
-- Cierre explícito de permisos heredados por PUBLIC en RPC creados después del hardening base.

revoke all on function public.erp_x_goods_receipt_labels(text) from public;
revoke all on function public.erp_x_inventory_scan_resolve(text) from public;
revoke all on function public.erp_x_goods_receipt_labels(text) from anon;
revoke all on function public.erp_x_inventory_scan_resolve(text) from anon;

grant execute on function public.erp_x_goods_receipt_labels(text) to authenticated;
grant execute on function public.erp_x_inventory_scan_resolve(text) to authenticated;
