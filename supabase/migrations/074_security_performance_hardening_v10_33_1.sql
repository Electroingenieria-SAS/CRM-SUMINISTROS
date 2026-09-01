-- ERP EI · V10.33.1 Security/Performance hardening
-- Fecha: 2026-09-01
-- Objetivo: cerrar grants RPC anónimos residuales y corregir dos avisos inequívocos del Advisor.
-- Esta migración es idempotente y no modifica datos de negocio.

begin;

-- SECURITY DEFINER: ninguna de estas funciones debe ser ejecutable sin sesión.
revoke execute on function public.current_profile() from public, anon;
grant execute on function public.current_profile() to authenticated, service_role;

revoke execute on function public.erp_x_execute_cut_group(text,jsonb) from public, anon;
grant execute on function public.erp_x_execute_cut_group(text,jsonb) to authenticated, service_role;

revoke execute on function public.erp_x_material_reservation_health() from public, anon;
grant execute on function public.erp_x_material_reservation_health() to authenticated, service_role;

revoke execute on function public.erp_x_resolve_cut_requirement(uuid,text,jsonb) from public, anon;
grant execute on function public.erp_x_resolve_cut_requirement(uuid,text,jsonb) to authenticated, service_role;

-- Función trigger: no necesita invocación vía Data API.
revoke execute on function public.link_new_auth_user_to_profile() from public, anon, authenticated;

-- Evita evaluar auth.uid() una vez por cada fila en esta política de compatibilidad.
drop policy if exists profiles_read_v8 on public.profiles;
create policy profiles_read_v8 on public.profiles
for select to authenticated
using (
  (erp_current_exact_role() = 'super_admin')
  or ((erp_current_exact_role() = any(array['gerencia','jefe_logistica','auditoria'])) and active = true)
  or ((erp_current_exact_role() = any(array['coordinador_logistico','despacho_nacional'])) and active = true and (erp_exact_role(role_code) = any(array['aux_logistica','auxiliar_corte','recepcion_mercancia'])))
  or (auth_user_id = (select auth.uid()))
);

-- Los dos índices son byte-a-byte equivalentes. Conservamos el nombre histórico estable.
drop index if exists erp_supply.idx_financial_validations_order_type_v1033;

select pg_notify('pgrst','reload schema');
commit;
