-- CRM Suministros V11.27.0 · Auditoría de seguridad/RLS
-- Retira una política permisiva redundante que ampliaba el SELECT de public.profiles.
-- Se conserva profiles_read_v8 como política granular canónica.

begin;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_read_v8'
  ) then
    raise exception 'No existe profiles_read_v8; se aborta el hardening de public.profiles';
  end if;
end
$$;

drop policy if exists erp_active_read on public.profiles;

select pg_notify('pgrst','reload schema');
commit;
