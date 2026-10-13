begin;
-- Additive catalog: documentary prices never enter training or delivery costs.
create table if not exists erp_supply.freight_tariff_editions (
 version text primary key, carrier text not null, status text not null check(status='HISTORICAL_REFERENCE'),
 source_sha256 text not null, dataset_sha256 text not null, source_name text not null,
 expected_rows integer not null, created_at timestamptz not null default now()
);
insert into erp_supply.freight_tariff_editions(version,carrier,status,source_sha256,dataset_sha256,source_name,expected_rows) values('TRADICIONALES_2023_2024','TCC','HISTORICAL_REFERENCE','0a56ce97012329b5fa5a7fc758f628416a544e54ecd8417a0f26ddc595b98bb2','4478d37ecde4f01a41dfaff2b460a5b0fa6fa35b4c1f9d416456173a06d53715','Tarifas-tradicionales-2023-2024-1.pdf',30107) on conflict do nothing;
create table if not exists erp_supply.freight_tariff_rows (
 tcc_row_id text primary key, tariff_version text not null references erp_supply.freight_tariff_editions(version),
 carrier text not null check(carrier='TCC'), origin_city text not null, destination_pdf text not null,
 destination_departamento_pdf text not null, tcc_co text not null, source_page integer not null,
 paq_rate_cop_kg_reference integer check(paq_rate_cop_kg_reference>0), msj_code text not null check(msj_code in ('N','O','Z','R','U','E')),
 source_data jsonb not null
);
create index if not exists freight_tariff_route_lookup on erp_supply.freight_tariff_rows(carrier,tariff_version,origin_city,destination_departamento_pdf,destination_pdf);
create index if not exists freight_tariff_position_lookup on erp_supply.freight_tariff_rows((left(tcc_row_id,8)),origin_city);
create table if not exists erp_supply.freight_quote_policies (
 version text primary key, carrier text not null, status text not null check(status='HISTORICAL_REFERENCE'), rules jsonb not null, source_url text not null
);
insert into erp_supply.freight_quote_policies values ('TCC_WEB_REFERENCE_1','TCC','HISTORICAL_REFERENCE','{"volumetricFactor":400,"realThresholdKg":50,"volumeThresholdKg":86,"surchargeCopKg":50,"handlingThresholdCop":200000,"handlingRate":0.01}', 'https://tcc.com.co/courier/paqueteria/formas-de-pago-y-tarifas/') on conflict do nothing;
insert into erp_supply.modules(code,name,description,icon,sort_order) values('freight_quotes','Cotización de fletes','Referencias documentales y predicciones independientes de pedidos','truck',35) on conflict(code) do nothing;
insert into erp_supply.role_module_permissions(role_code,module_code,can_read,can_create,can_update,can_approve,can_admin)
 select role_code,'freight_quotes',bool_or(can_read),bool_or(can_create),bool_or(can_update),false,bool_or(can_admin)
 from erp_supply.role_module_permissions where module_code in ('sales','shipping') group by role_code
 on conflict(role_code,module_code) do nothing;
create table if not exists erp_supply.freight_quotes (
 id uuid primary key default gen_random_uuid(), folio bigint generated always as identity unique,
 organization_id uuid not null references erp_supply.organizations(id), created_by uuid not null references erp_supply.profiles(id),
 order_id uuid references erp_supply.orders(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 status text not null check(status in ('DRAFT','CALCULATED','EXPIRED')), carrier text not null check(carrier='TCC'),
 tariff_version text not null, policy_version text not null, input jsonb not null, snapshot jsonb not null
);
create index if not exists freight_quote_org_date on erp_supply.freight_quotes(organization_id,created_at desc,id);
create index if not exists freight_quote_order on erp_supply.freight_quotes(order_id,created_at) where order_id is not null;
alter table erp_supply.freight_tariff_editions enable row level security;
alter table erp_supply.freight_tariff_rows enable row level security;
alter table erp_supply.freight_quote_policies enable row level security;
alter table erp_supply.freight_quotes enable row level security;
revoke all on erp_supply.freight_tariff_editions,erp_supply.freight_tariff_rows,erp_supply.freight_quote_policies,erp_supply.freight_quotes from public,anon,authenticated;
-- Writes use guarded RPC; direct read also enforces current organization.
drop policy if exists freight_quotes_org_read on erp_supply.freight_quotes;
create policy freight_quotes_org_read on erp_supply.freight_quotes for select to authenticated using(organization_id=erp_supply.current_org_id() and erp_supply.can_access_module('freight_quotes','read'));
grant select on erp_supply.freight_quotes to authenticated;
-- Loader is service-only and upserts by stable document row ID, never geographic name.
create or replace function public.erp_x_import_tcc_reference(p_rows jsonb) returns integer
language plpgsql security definer set search_path=erp_supply,public,pg_catalog as $$
declare r jsonb; n integer:=0;
begin
 if coalesce(auth.role(),'')<>'service_role' and session_user not in ('postgres','supabase_admin') then raise exception 'No autorizado' using errcode='42501'; end if;
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>2000 then raise exception 'Lote inválido'; end if;
 for r in select value from jsonb_array_elements(p_rows) loop
  if r->>'source_sha256'<>'0a56ce97012329b5fa5a7fc758f628416a544e54ecd8417a0f26ddc595b98bb2' or r->>'tariff_version'<>'TRADICIONALES_2023_2024' or r->>'carrier'<>'TCC' or r->>'service_type'<>'PAQ' or r->>'tcc_row_id' !~ '^TCC_[0-9]{4}_[0-9]{2}$' then raise exception 'Contrato TCC inválido'; end if;
  if nullif(r->>'paq_rate_cop_kg_reference','') is null and (r->>'data_status'<>'FUENTE_DANADA_O_ILEGIBLE' or r->>'source_page'<>'4' or r->>'destination_pdf' not like 'BARRANCABERMEJA%') then raise exception 'NULL no autorizado'; end if;
  insert into erp_supply.freight_tariff_rows values(r->>'tcc_row_id',r->>'tariff_version','TCC',r->>'origin_city',r->>'destination_pdf',r->>'destination_departamento_pdf',r->>'tcc_co',(r->>'source_page')::integer,nullif(r->>'paq_rate_cop_kg_reference','')::integer,r->>'msj_code',r)
  on conflict(tcc_row_id) do update set source_data=excluded.source_data where freight_tariff_rows.source_data=excluded.source_data;
  if not found then raise exception 'Conflicto: ID con datos distintos %',r->>'tcc_row_id'; end if;
  n:=n+1;
 end loop;
 return n;
end $$;
revoke all on function public.erp_x_import_tcc_reference(jsonb) from public,anon,authenticated;
grant execute on function public.erp_x_import_tcc_reference(jsonb) to service_role;
commit;
