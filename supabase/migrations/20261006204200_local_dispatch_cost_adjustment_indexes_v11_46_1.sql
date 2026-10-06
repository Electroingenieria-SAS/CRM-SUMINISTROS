begin;

create index if not exists idx_viajes_despacho_ajustes_order
  on public.viajes_despacho_ajustes_costo(order_id);

create index if not exists idx_viajes_despacho_ajustes_delivery
  on public.viajes_despacho_ajustes_costo(delivery_id);

create index if not exists idx_viajes_despacho_ajustes_created_by
  on public.viajes_despacho_ajustes_costo(created_by);

comment on index public.idx_viajes_despacho_ajustes_order is
  'V11.46.1: soporte FK y consultas por pedido del historial de ajustes de flete.';
comment on index public.idx_viajes_despacho_ajustes_delivery is
  'V11.46.1: soporte FK y consultas por entrega del historial de ajustes de flete.';
comment on index public.idx_viajes_despacho_ajustes_created_by is
  'V11.46.1: soporte FK y trazabilidad por usuario que registra ajustes de flete.';

commit;
