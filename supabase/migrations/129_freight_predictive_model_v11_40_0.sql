-- CRM SUMINISTROS V11.40.0
-- Modelo predictivo de fletes construido sobre 749 despachos reales con origen Tuluá
-- (COLVANES, TCC y VELOENVIOS; ene-sep 2026).
-- PRIVACIDAD: esta migración contiene únicamente coeficientes y estadística agregada.
-- No incluye nombres, NIT, teléfonos, direcciones, destinatarios, guías ni documentos de clientes.
begin;

create table if not exists erp_supply.freight_prediction_models(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id) on delete cascade,
  model_code text not null,
  model_version text not null,
  origin_city text not null,
  source_start date not null,
  source_end date not null,
  sample_count integer not null check(sample_count>0),
  intercept numeric not null,
  coefficients jsonb not null default '{}'::jsonb,
  calibration jsonb not null default '{}'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  feature_schema jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,model_code,model_version)
);

create table if not exists erp_supply.freight_route_reference(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id) on delete cascade,
  model_version text not null,
  origin_city text not null,
  carrier text not null,
  destination_city text not null,
  destination_department text not null default '',
  sample_count integer not null check(sample_count>0),
  weight_sample_count integer not null default 0,
  weight_p20 numeric,
  weight_p50 numeric,
  weight_p80 numeric,
  cost_p20 numeric,
  cost_p50 numeric,
  cost_p80 numeric,
  transit_sample_count integer not null default 0,
  transit_p50_days numeric,
  transit_p80_days numeric,
  novelty_sample_count integer not null default 0,
  novelty_rate numeric,
  on_time_sample_count integer not null default 0,
  on_time_rate numeric,
  charge_real_sample_count integer not null default 0,
  charge_to_real_p50 numeric,
  dimensional_uplift_rate numeric,
  source_start date not null,
  source_end date not null,
  source_label text not null default 'TRANSPORTADORAS_ENE_SEP_2026_AGGREGATED',
  created_at timestamptz not null default now(),
  unique(organization_id,model_version,origin_city,carrier,destination_city,destination_department)
);

alter table erp_supply.freight_prediction_models enable row level security;
alter table erp_supply.freight_route_reference enable row level security;
revoke all on table erp_supply.freight_prediction_models from public,anon,authenticated;
revoke all on table erp_supply.freight_route_reference from public,anon,authenticated;

create index if not exists idx_freight_prediction_models_active_v1140
  on erp_supply.freight_prediction_models(organization_id,active,model_version desc);
create index if not exists idx_freight_route_reference_lookup_v1140
  on erp_supply.freight_route_reference(organization_id,model_version,carrier,destination_city,destination_department);

create or replace function erp_supply.freight_norm_v1140(p_value text)
returns text
language sql
immutable
set search_path=pg_catalog
as $$
  select trim(regexp_replace(
    translate(upper(coalesce(p_value,'')),'ÁÉÍÓÚÜÑ','AEIOUUN'),
    '\s+',' ','g'
  ))
$$;
revoke all on function erp_supply.freight_norm_v1140(text) from public,anon,authenticated;

create or replace function erp_supply.freight_weight_band_v1140(p_weight numeric)
returns integer
language sql
immutable
set search_path=pg_catalog
as $$
  select case
    when coalesce(p_weight,0)<=5 then 0
    when p_weight<=10 then 1
    when p_weight<=20 then 2
    when p_weight<=50 then 3
    when p_weight<=100 then 4
    when p_weight<=200 then 5
    when p_weight<=350 then 6
    when p_weight<=500 then 7
    when p_weight<=750 then 8
    when p_weight<=1000 then 9
    else 10
  end
$$;
revoke all on function erp_supply.freight_weight_band_v1140(numeric) from public,anon,authenticated;

delete from erp_supply.freight_prediction_models
where organization_id in(select id from erp_supply.organizations where code='EI')
  and model_code='EI_FREIGHT_RIDGE_WEIGHT';

insert into erp_supply.freight_prediction_models(
  organization_id,model_code,model_version,origin_city,source_start,source_end,sample_count,
  intercept,coefficients,calibration,metrics,feature_schema,active
)
select
  o.id,'EI_FREIGHT_RIDGE_WEIGHT','11.40.0','TULUA','2026-01-06','2026-09-23',749,
  9.630226952455,
  '{"COLVANES:lw":0.2060155935297945,"COLVANES:lw2":0.0015604449764545667,"TCC:lw":-0.035642270538472694,"TCC:lw2":0.02330561264498775,"VELOENVIOS:lw":0.03571217856569031,"VELOENVIOS:lw2":0.02059582222950546,"band=0":0.18464243016681645,"band=1":-0.014013639535568613,"band=10":-0.12043150818476574,"band=2":-0.08548522195013354,"band=3":-0.1083184155926101,"band=4":-0.04256438730551495,"band=5":0.05785459830683544,"band=6":0.08371731896751464,"band=7":0.06246877337963055,"band=8":0.04664970032264018,"band=9":-0.06451964857523418,"carrier=COLVANES":-0.5048325760022395,"carrier=TCC":0.6764764855346636,"carrier=VELOENVIOS":-0.17164390953117295,"dept=":-0.17011214379290257,"dept=ANTIOQUIA":0.08770124937755135,"dept=ATLANTICO":0.10530275739034826,"dept=BOGOTA DC":-0.06961162412847759,"dept=BOLIVAR":-0.05937602010008318,"dept=BOYACA":0.09791807086379284,"dept=CALDAS":0.061253037288662784,"dept=CAUCA":0.08710803139609559,"dept=CESAR":0.014597267088263187,"dept=CHOCO":-0.0004205928602259829,"dept=CORDOBA":0.05856670344307038,"dept=CUNDINAMARCA":0.02254058344973704,"dept=D.C.":0.13823083152511564,"dept=GUAJIRA":0.010178266287946715,"dept=HUILA":0.13797156285204876,"dept=MAGDALENA":0.13652258874159914,"dept=META":0.019394642770279694,"dept=NARINO":0.06255461900807067,"dept=NORTE DE SANTANDER":-0.02686759002045329,"dept=QUINDIO":-0.20735293226588142,"dept=RISARALDA":-0.26468498852541567,"dept=SANTANDER":-0.034019077617086176,"dept=SUCRE":0.01802413021897021,"dept=TOLIMA":0.18962499109693584,"dept=VALLE":-0.1021968342194807,"dept=VALLE DEL CAUCA":-0.3128475292685618,"dest=AGUACHICA":0.024067033365474423,"dest=AMBALEMA":-0.018324160101492157,"dest=APARTADO":-0.004180875141700204,"dest=ARMENIA":-0.1989200827909939,"dest=BARRANCABERMEJA":-0.01851667277066002,"dest=BARRANQUILLA":-0.10797063120851001,"dest=BELLO":-0.06769882066822527,"dest=BOGOTA":-0.07208546189921691,"dest=BUCARAMANGA":0.08144576129654608,"dest=BUENAVENTURA":0.10970323244813458,"dest=BUGA":-0.06925637985075873,"dest=CACERES":0.013802353557719431,"dest=CALI":-0.4272050860276579,"dest=CARTAGENA":-0.031320967184751136,"dest=CARTAGO":-0.13667572635274494,"dest=CAUCASIA":0.010404178986676229,"dest=CERETE":0.007493010681648555,"dest=CHAPARRAL":0.002831304910718679,"dest=CHARALA":0.0775365626194072,"dest=CHINU":0.07135557268669038,"dest=CHIQUINQUIRA":0.030255477285131442,"dest=CUCUTA":-0.01488899293528988,"dest=EL ROSAL":0.14886211701599