-- V11.28.1 · Configuración privada del destino AuditoriaERP desde Supabase Vault.
-- Los valores reales se administran en Vault y no se duplican en el repositorio.

create or replace function public.erp_x_auditoria_erp_target_config()
returns jsonb
language sql
security definer
stable
set search_path = public, vault, pg_catalog
as $$
  select jsonb_build_object(
    'url', max(decrypted_secret) filter (where name='auditoria_erp_url'),
    'key', max(decrypted_secret) filter (where name='auditoria_erp_anon_key')
  )
  from vault.decrypted_secrets
  where name in ('auditoria_erp_url','auditoria_erp_anon_key');
$$;

revoke all on function public.erp_x_auditoria_erp_target_config() from public, anon, authenticated;
grant execute on function public.erp_x_auditoria_erp_target_config() to service_role;

notify pgrst, 'reload schema';
