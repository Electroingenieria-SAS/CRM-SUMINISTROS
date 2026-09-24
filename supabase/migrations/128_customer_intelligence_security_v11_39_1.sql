-- CRM SUMINISTROS V11.39.1
-- Hardening puntual de la clave canónica de cliente introducida en V11.39.0.
begin;

create or replace function erp_supply.customer_key(p_document text,p_name text)
returns text
language sql
immutable
set search_path=pg_catalog
as $$
  select case
    when nullif(trim(coalesce(p_document,'')),'') is not null
      then 'DOC:'||upper(regexp_replace(trim(p_document),'\s+','','g'))
    else 'NAME:'||lower(regexp_replace(trim(coalesce(p_name,'')),'\s+',' ','g'))
  end
$$;

revoke all on function erp_supply.customer_key(text,text) from public,anon,authenticated;

comment on function erp_supply.customer_key(text,text)
is 'V11.39.1: clave determinística interna de cliente; search_path fijo y sin ejecución directa para clientes API.';

notify pgrst,'reload schema';
commit;
