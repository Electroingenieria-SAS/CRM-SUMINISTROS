-- Run after freight_carrier_market_overlay + guide + audit migrations.
-- Everything operates with an authenticated seller fixture and is rolled back.
begin;
do $$ declare actor uuid; begin
 select p.auth_user_id into actor from erp_supply.profiles p join erp_supply.profile_roles r on r.profile_id=p.id
 where p.active and r.role_code='super_admin' and p.auth_user_id is not null limit 1;
 if actor is null then raise exception 'Missing test profile';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 perform set_config('request.jwt.claim.sub',actor::text,true);
end $$;
set local role authenticated;
do $$
declare k text;dep text; input jsonb;tcc jsonb;envia jsonb;outcome jsonb;
begin
 select value->>'key' into k from jsonb_array_elements(public.erp_x_freight_quote_catalog('VALLE DEL CAUCA')->'destinations')
  where value->>'name'='TULUA (VALLE DEL CAUCA)' limit 1;
 input:=jsonb_build_object('measurementVersion',2,'origin','CALI','carrier','TCC','department','VALLE DEL CAUCA','destinationKey',k,'declaredValue',100000,
 'materials','[{"description":"Cable","measurementMode":"WEIGHT","weightKg":20}]'::jsonb);
 outcome:=public.erp_x_freight_quote_calculate(input);
 if (outcome#>>'{reference,subtotalCop}')::numeric<>19060
   or (outcome#>>'{commercialEstimate,totalCop}')::numeric<=19060 then
   raise exception 'Regression TCC historical/CPI overlay: %',outcome;end if;
 envia:=outcome#>'{comparison,1}';
 if envia#>>'{commercialEstimate,source}'<>'ENVIA_REFERENCE'
   or (envia#>>'{commercialEstimate,totalCop}')::numeric<>23900 then
   raise exception 'Regression ENVIA separated pricing: %',envia;end if;
 select value->>'key',value->>'department' into k,dep
 from jsonb_array_elements(public.erp_x_freight_quote_catalog('CUNDINAMARCA')->'destinations')
 where value->>'name' ilike 'BOGOTA%' limit 1;
 if k is null then raise exception 'Bogota document lookup failed';end if;
 input:=jsonb_build_object('measurementVersion',2,'origin','TULUA','carrier','TCC','department',dep,'destinationKey',k,'declaredValue',100000,
 'materials','[{"description":"Cable","measurementMode":"WEIGHT","weightKg":20}]'::jsonb);
 outcome:=public.erp_x_freight_quote_calculate(input);
 if outcome#>>'{reference,reason}'<>'ORIGIN_ROUTE_UNAVAILABLE'
   or outcome#>>'{commercialEstimate,source}'<>'TCC_REAL_GUIDE_MODEL'
   or coalesce((outcome#>>'{commercialEstimate,rangeLowCop}')::numeric,0)<=0
   or coalesce((outcome#>>'{commercialEstimate,rangeHighCop}')::numeric,0)<=0 then
   raise exception 'Tuluá fallback did not use TCC only: %',outcome;end if;
 if outcome#>>'{commercialEstimate,ipcFactor}' is not null then
   raise exception 'Cali tariff was incorrectly mapped to Tuluá';end if;
end $$;
reset role;
select 'PASS: TCC historic untouched, 2026 IPC price, ENVIA independent, Tuluá uses only TCC historical guide model' result;
rollback;
