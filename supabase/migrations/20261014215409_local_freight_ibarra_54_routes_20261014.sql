-- Additive data migration. CSV source: tarifas_rutas_luis_ibarra_CRM.csv.
-- Original uploaded SHA-256: 7be632a885a842222e97f86ae4f6c5af2b1b696aac43bbf43fc4d1169ff97f5d
-- Historical trips/legacy tariff codes remain intact; the new UI offers only 54 supplied routes.
begin;
-- Immutable pre-import record of the 60 original routes so no pre-existing fare is lost.
create table if not exists erp_supply.local_dispatch_rate_snapshots (
 snapshot_batch text not null,
 destination_code text not null,
 zone_code text,
 base_cost numeric,
 extra_per_kg numeric,
 limit_kg numeric,
 was_active boolean,
 original_updated_at timestamptz,
 captured_at timestamptz not null default now(),
 primary key(snapshot_batch,destination_code)
);
alter table erp_supply.local_dispatch_rate_snapshots enable row level security;
revoke all on erp_supply.local_dispatch_rate_snapshots from public,anon,authenticated;
insert into erp_supply.local_dispatch_rate_snapshots
 (snapshot_batch,destination_code,zone_code,base_cost,extra_per_kg,limit_kg,was_active,original_updated_at)
select 'BEFORE_LUIS_IBARRA_CSV_2026_10_14',destination_code,zone_code,base_cost,extra_per_kg,limit_kg,active,updated_at
from erp_supply.local_dispatch_tariffs
on conflict(snapshot_batch,destination_code) do nothing;
alter table erp_supply.local_dispatch_tariffs add column if not exists source_version text;
alter table erp_supply.local_dispatch_tariffs add column if not exists max_weight_kg numeric;
insert into erp_supply.local_dispatch_tariffs(destination_code,zone_code,base_cost,extra_per_kg,limit_kg,active,source_version,max_weight_kg)
values
('URBANO','TULUA_CERCANAS',30000,47,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500),
('RURAL - LA MARINA','TULUA_CERCANAS',100000,47,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500),
('ANDALUCÍA','TULUA_CERCANAS',60000,47,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500),
('BUGALAGRANDE','TULUA_CERCANAS',70000,47,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500),
('TRUJILLO','TULUA_CERCANAS',180000,47,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500),
('RIOFRÍO','TULUA_CERCANAS',85000,47,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500),
('SAN PEDRO','TULUA_CERCANAS',60000,47,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500),
('ING. CARMELITA','TULUA_CERCANAS',90000,47,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500),
('CAMPA. LA LUISA','TULUA_CERCANAS',75000,47,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500),
('MANIZALES','NORTE_VALLE_IBARRA',850000,100,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500),
('VILLAMARÍA','NORTE_VALLE_IBARRA',850000,100,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500),
('CHINCHINÁ','NORTE_VALLE_IBARRA',775000,100,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500),
('SANTA ROSA DE CABAL','NORTE_VALLE_IBARRA',750000,100,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500),
('DOSQUEBRADAS','NORTE_VALLE_IBARRA',725000,100,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500),
('PEREIRA','NORTE_VALLE_IBARRA',700000,100,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500),
('LA VIRGINIA','NORTE_VALLE_IBARRA',500000,100,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500),
('CARTAGO','NORTE_VALLE_IBARRA',400000,100,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500),
('ALCALÁ','NORTE_VALLE_IBARRA',600000,100,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500),
('QUIMBAYA','NORTE_VALLE_IBARRA',600000,100,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500),
('MONTENEGRO','NORTE_VALLE_IBARRA',600000,100,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500),
('ANSERMANUEVO','NORTE_VALLE_IBARRA',600000,100,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500),
('ARMENIA','NORTE_VALLE_IBARRA',700000,100,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500),
('LA TEBAIDA','NORTE_VALLE_IBARRA',500000,75,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500),
('OBANDO','NORTE_VALLE_IBARRA',350000,75,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500),
('TORO','NORTE_VALLE_IBARRA',350000,75,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500),
('LA UNIÓN','NORTE_VALLE_IBARRA',300000,75,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500),
('LA VICTORIA','NORTE_VALLE_IBARRA',300000,75,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500),
('BOLÍVAR','NORTE_VALLE_IBARRA',175000,75,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500),
('ROLDANILLO','NORTE_VALLE_IBARRA',170000,75,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500),
('ZARZAL','NORTE_VALLE_IBARRA',170000,75,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500),
('LA PAILA','NORTE_VALLE_IBARRA',170000,75,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500),
('CAICEDONIA','NORTE_VALLE_IBARRA',400000,75,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500),
('SEVILLA','NORTE_VALLE_IBARRA',300000,75,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500),
('BUGA','SUR_VALLE_IBARRA',180000,75,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500),
('MEDIACANOA','SUR_VALLE_IBARRA',180000,75,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500),
('YOTOCO','SUR_VALLE_IBARRA',200000,75,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500),
('PUENTE TIERRA','SUR_VALLE_IBARRA',375000,100,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500),
('RESTREPO','SUR_VALLE_IBARRA',375000,100,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500),
('CALIMA - DARIÉN','SUR_VALLE_IBARRA',375000,100,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500),
('LA HABANA','SUR_VALLE_IBARRA',200000,75,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500),
('EL VÍNCULO','SUR_VALLE_IBARRA',225000,75,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500),
('GUACARÍ','SUR_VALLE_IBARRA',225000,75,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500),
('VIJES','SUR_VALLE_IBARRA',300000,75,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500),
('GINEBRA','SUR_VALLE_IBARRA',250000,75,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500),
('CERRITO','SUR_VALLE_IBARRA',275000,75,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500),
('MULALÓ','SUR_VALLE_IBARRA',275000,75,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500),
('ROZO','SUR_VALLE_IBARRA',275000,75,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500),
('PALMIRA','SUR_VALLE_IBARRA',400000,100,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500),
('YUMBO','SUR_VALLE_IBARRA',400000,100,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500),
('CALI','SUR_VALLE_IBARRA',600000,100,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500),
('CANDELARIA - INGENIOS','SUR_VALLE_IBARRA',475000,100,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500),
('PRADERA - INGENIOS','SUR_VALLE_IBARRA',475000,100,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500),
('FLORIDA - INGENIOS','SUR_VALLE_IBARRA',475000,100,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500),
('JAMUNDÍ','SUR_VALLE_IBARRA',600000,100,1000,true,'LUIS_IBARRA_CSV_2026_10_14',2500)
on conflict(destination_code) do update set
 zone_code=excluded.zone_code,base_cost=excluded.base_cost,extra_per_kg=excluded.extra_per_kg,
 limit_kg=excluded.limit_kg,active=excluded.active,source_version=excluded.source_version,
 max_weight_kg=excluded.max_weight_kg,updated_at=now();

alter table erp_supply.freight_quotes drop constraint if exists freight_quotes_carrier_check;
alter table erp_supply.freight_quotes add constraint freight_quotes_carrier_check
 check(carrier in ('TCC','ENVIA','LOCAL'));

-- No route/weight/value supplied by browser can invent a quote: every cost comes from SQL rows.
create or replace function erp_supply.local_freight_quote_snapshot(p_payload jsonb)
returns jsonb language plpgsql stable security definer set search_path=erp_supply,public,auth,pg_catalog as $$
declare
 tariff erp_supply.local_dispatch_tariffs%rowtype; mat jsonb;
 code text:=nullif(btrim(p_payload->>'localDestinationCode'),'');
 weight numeric:=0; amount numeric; n int; nc int:=0; extra numeric:=0; extras numeric:=0;
 unload numeric:=coalesce(erp_supply.safe_numeric(p_payload->>'localUnloadingCost'),0);
 diversion numeric:=coalesce(erp_supply.safe_numeric(p_payload->>'localDiversionCost'),0);
 notes text:=coalesce(p_payload->>'localExtraReason',''); available boolean:=false;
 reason text:='PESO_REQUERIDO'; reference jsonb; estimate jsonb; snap jsonb;
begin
 perform erp_supply.require_freight_quote_access();
 if octet_length(p_payload::text)>100000 or jsonb_typeof(p_payload->'materials') is distinct from 'array'
 then raise exception 'Materiales inválidos' using errcode='22023';end if;
 n:=jsonb_array_length(p_payload->'materials');
 if n>100 then raise exception 'Máximo 100 materiales' using errcode='22023';end if;
 if upper(coalesce(p_payload->>'origin',''))<>'TULUA' then
  raise exception 'La matriz local suministrada solo corresponde a salidas de Tuluá' using errcode='22023';
 end if;
 if code is null then raise exception 'Selecciona la ruta local de destino' using errcode='22023';end if;
 select * into tariff from erp_supply.local_dispatch_tariffs
 where destination_code=code and active and source_version='LUIS_IBARRA_CSV_2026_10_14';
 if not found then raise exception 'Ruta local sin tarifa en la matriz suministrada' using errcode='22023';end if;
 if unload<0 or diversion<0 or unload>100000000 or diversion>100000000
 then raise exception 'Recargos locales inválidos' using errcode='22023';end if;
 if unload+diversion>0 and length(btrim(notes))<8
 then raise exception 'Explica brevemente el recargo local' using errcode='22023';end if;
 for mat in select value from jsonb_array_elements(p_payload->'materials') loop
  if length(coalesce(mat->>'description',''))>240 then raise exception 'Nombre de material demasiado largo' using errcode='22023';end if;
  amount:=nullif(mat->>'weightKg','')::numeric;
  if amount is not null then
   if amount<=0 or amount>1000000 or amount::text in ('NaN','Infinity','-Infinity') then
    raise exception 'Peso de material inválido' using errcode='22023';end if;
   weight:=weight+amount;nc:=nc+1;
  end if;
 end loop;
 if n>0 and nc=n and weight<=coalesce(tariff.max_weight_kg,2500) then
  available:=true;reason:='';extra:=greatest(0,ceil(weight-tariff.limit_kg));
 elsif n>0 and nc=n then reason:='PESO_FUERA_DE_RANGO';end if;
 extras:=extra*tariff.extra_per_kg+unload+diversion;
 reference:=jsonb_build_object('status',case when available then 'LOCAL_TARIFF_REFERENCE' else 'REQUIRES_INFORMATION' end,
  'official',false,'basis','WEIGHT','baseCop',tariff.base_cost,'variableCop',extras,
  'extraKg',extra,'extraPerKgCop',tariff.extra_per_kg,'unloadingCop',unload,'diversionCop',diversion,
  'subtotalCop',case when available then tariff.base_cost+extras else null end,
  'complete',available,'measuredMaterials',nc,'totalMaterials',n,'reason',nullif(reason,''));
 estimate:=jsonb_build_object('available',available,'source','LOCAL_IBARRA_CSV_2026_10_14',
  'totalCop',case when available then tariff.base_cost+extras else null end,
  'rangeLowCop',case when available then tariff.base_cost+extras else null end,
  'rangeHighCop',case when available then tariff.base_cost+extras else null end,
  'statisticalRange',false,'rangeScope','FIXED_INTERNAL_ROUTE','baseCop',tariff.base_cost,
  'variableCop',case when available then extras else null end,'reason',nullif(reason,''));
 snap:=jsonb_build_object('carrier','LOCAL','origin','TULUA','destination',code,'department',tariff.zone_code,
  'tariffVersion','LUIS_IBARRA_CSV_2026_10_14','policyVersion','LOCAL_FIXED_BASE_PLUS_EXTRAS_V1',
  'sourceType','IMPORTED_INTERNAL_CSV','tariffSource','Luis Ibarra · matriz aportada',
  'reference',reference,'commercialEstimate',estimate,'selectedBasis','WEIGHT',
  'measurementVersion',2,'measurementSummary',jsonb_build_object('count',n,'weightKg',weight,'weightCount',nc),
  'localExtras',jsonb_build_object('unloadingCop',unload,'diversionCop',diversion,'reason',notes),
  'prediction',jsonb_build_object('available',false,'reason','FIXED_TARIFF_NO_ML'),
  'calculatedAt',now(),'warning','Tarifa fija de la matriz interna aportada. No constituye precio contractual verificado.');
 return snap||jsonb_build_object('comparison',jsonb_build_array(snap),'carrierAliases','{}'::jsonb);
end $$;
revoke all on function erp_supply.local_freight_quote_snapshot(jsonb) from public,anon,authenticated;

create or replace function public.erp_x_freight_quote_calculate(p_payload jsonb)
returns jsonb language plpgsql stable security definer
set search_path=erp_supply,public,auth,pg_catalog as $$
begin
 perform erp_supply.require_freight_quote_access();
 if p_payload->>'carrier'='LOCAL' then return erp_supply.local_freight_quote_snapshot(p_payload);end if;
 if p_payload->>'measurementVersion'='2' then
  return erp_supply.freight_quote_market_overlay(
   erp_supply.freight_quote_material_calculate(p_payload),p_payload);
 end if;
 return erp_supply.freight_quote_legacy_calculate(p_payload);
end $$;
revoke all on function public.erp_x_freight_quote_calculate(jsonb) from public,anon;
grant execute on function public.erp_x_freight_quote_calculate(jsonb) to authenticated;

-- Preserve carrier matching: local trip actuals never calibrate TCC or ENVÍA.
create or replace function public.erp_x_freight_quote_list(p_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path=erp_supply,public,auth,pg_catalog as $$
begin
 perform erp_supply.require_freight_quote_access();
 return jsonb_build_object('total',(select count(*) from erp_supply.freight_quotes where organization_id=erp_supply.current_org_id()),
 'items',coalesce((select jsonb_agg(to_jsonb(q)) from
  (select q.*,o.order_number,d.carrier_cost actual_cost_cop,d.carrier actual_carrier
   from erp_supply.freight_quotes q
   left join erp_supply.orders o on o.id=q.order_id
   left join lateral(
    select carrier_cost,carrier from erp_supply.deliveries
    where order_id=q.order_id and carrier_cost>0 and carrier_cost_currency='COP'
    and case when q.carrier='ENVIA'
      then erp_supply.freight_norm_v1140(carrier) in ('ENVIA','COLVANES')
      when q.carrier='LOCAL'
      then upper(btrim(carrier)) in ('VEHÍCULO LOCAL','VEHICULO LOCAL','TRANSPORTE LOCAL')
      else erp_supply.freight_norm_v1140(carrier)='TCC' end
    and q.created_at<=coalesce(dispatched_at,carrier_cost_recorded_at,now())
    order by updated_at desc limit 1)d on true
   where q.organization_id=erp_supply.current_org_id()
   order by q.created_at desc,q.id limit 30
   offset (greatest(1,coalesce(p_page,1))-1)*30)q),'[]'));
end $$;
revoke all on function public.erp_x_freight_quote_list(integer) from public,anon;
grant execute on function public.erp_x_freight_quote_list(integer) to authenticated;
