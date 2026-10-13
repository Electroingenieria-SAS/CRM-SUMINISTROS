-- 2026-10-13: non-destructive quote overlay and strictly carrier-scoped guide calibration.
-- Original tariff rows, historic price functions and prediction coefficients are not updated.
create or replace function erp_supply.freight_quote_guide_correction(
  p_carrier text,p_origin text,p_department text,p_city text,p_weight numeric
) returns jsonb
language plpgsql stable security definer set search_path=erp_supply,public,auth,pg_catalog as $$
declare n int:=0; correction numeric:=1; latest timestamptz;
begin
  -- Invoiced and verified costs only. The metadata was captured with the guide,
  -- not inferred from an unrelated PDF route or another carrier.
  with distinct_guides as (
    select distinct on (upper(trim(d.tracking_number)))
      d.carrier_cost actual, d.carrier_cost_recorded_at paid_at,
      (d.metadata->>'freightWeightKg')::numeric actual_weight,
      o.client_city city,
      coalesce(o.metadata->>'clientDepartment',d.metadata#>>'{destination,department}') department
    from erp_supply.deliveries d
    join erp_supply.orders o on o.id=d.order_id
    where o.organization_id=erp_supply.current_org_id()
      and o.is_test is distinct from true
      and d.carrier_cost>0 and d.carrier_cost_currency='COP'
      and nullif(trim(d.tracking_number),'') is not null
      and nullif(trim(d.carrier_invoice_number),'') is not null
      and d.carrier_cost_recorded_at is not null
      and d.metadata->>'freightWeightKg' ~ '^[0-9]{1,7}(\.[0-9]{1,5})?$'
      and (d.metadata->>'freightWeightKg')::numeric>0
      and erp_supply.freight_norm_v1140(d.metadata->>'freightOrigin')=erp_supply.freight_norm_v1140(p_origin)
      and erp_supply.freight_norm_v1140(o.client_city)=erp_supply.freight_norm_v1140(p_city)
      and erp_supply.freight_norm_v1140(coalesce(o.metadata->>'clientDepartment',d.metadata#>>'{destination,department}'))=erp_supply.freight_norm_v1140(p_department)
      and case when p_carrier='ENVIA'
        then erp_supply.freight_norm_v1140(d.carrier) in ('ENVIA','COLVANES')
        else erp_supply.freight_norm_v1140(d.carrier)='TCC' end
    order by upper(trim(d.tracking_number)),d.carrier_cost_recorded_at desc,d.id desc
  ), predicted as (
    select actual, paid_at, actual_weight,
      erp_supply.freight_model_predict_v1140(
        erp_supply.current_org_id(),
        case when p_carrier='ENVIA' then 'COLVANES' else 'TCC' end,
        department, city, actual_weight
      ) as expected
    from distinct_guides
    where p_weight>0 and actual_weight between p_weight/2 and p_weight*2
  ), residuals as (
    select actual/(expected->>'estimateMid')::numeric ratio,paid_at
    from predicted
    where (expected->>'estimateMid') ~ '^[0-9]+(\.[0-9]+)?$'
      and (expected->>'estimateMid')::numeric>0
  ), quartiles as (
    select percentile_cont(0.25) within group(order by ratio::double precision) q1,
      percentile_cont(0.75) within group(order by ratio::double precision) q3
    from residuals
  )
  select count(*),coalesce(
    sum(greatest(0.01,power(0.5::numeric,greatest(0,extract(epoch from (now()-r.paid_at))/86400)/180))*r.ratio)
      /nullif(sum(greatest(0.01,power(0.5::numeric,greatest(0,extract(epoch from (now()-r.paid_at))/86400)/180))),0),1
    ),max(r.paid_at)
    into n,correction,latest
  from residuals r cross join quartiles q
  where r.ratio between greatest(0.01,q.q1-1.5*(q.q3-q.q1)) and q.q3+1.5*(q.q3-q.q1);
  return jsonb_build_object(
    'samples',n,'latestGuideAt',latest,
    'applied',n>=3,
    'factor',case when n>=3 then round(least(1.25,greatest(0.75,correction)),6) else 1 end,
    'method','RECENCY_WEIGHTED_IQR_180D',
    'carrier',p_carrier
  );
end $$;
revoke all on function erp_supply.freight_quote_guide_correction(text,text,text,text,numeric) from public,anon,authenticated;

create or replace function erp_supply.freight_quote_market_overlay(p_snapshot jsonb,p_payload jsonb)
returns jsonb language plpgsql stable security definer set search_path=erp_supply,public,auth,pg_catalog as $$
declare row jsonb; enriched jsonb:='[]'::jsonb; chosen jsonb; pr jsonb; doc jsonb; pred jsonb;
        carrier text; ref jsonb; source_type text; base numeric; variable numeric;
        central numeric; low numeric; high numeric; spread_low numeric;spread_high numeric;
        weight numeric; city text; calibration jsonb; k numeric; raw_total numeric;
        enough boolean; indexed numeric:=(1.051::numeric*1.0574::numeric);
begin
  perform erp_supply.require_freight_quote_access();
  pred:=p_snapshot->'prediction';
  city:=regexp_replace(coalesce(p_snapshot->>'destination',''),'\s*\([^)]*\)\s*$','');
  for row in select value from jsonb_array_elements(coalesce(p_snapshot->'comparison','[]'::jsonb)) loop
    carrier:=row->>'carrier';ref:=row->'reference';
    pr:=null;
    if coalesce((pred->>'available')::boolean,false) then
      select value into pr from jsonb_array_elements(coalesce(pred->'carriers','[]'::jsonb))
      where value->>'carrier'=case when carrier='ENVIA' then 'COLVANES' else 'TCC' end
      limit 1;
    end if;
    base:=null;variable:=null;central:=null;low:=null;high:=null;source_type:=null;
    enough:=coalesce((row#>>'{measurementScenarios,weight,complete}')::boolean,false)
       or coalesce((row#>>'{measurementScenarios,volume,complete}')::boolean,false);
    if enough and carrier='TCC' and ref->>'status'='HISTORICAL_REFERENCE' then
      base:=round((ref->>'baseCop')::numeric*indexed,0);
      variable:=coalesce((ref->>'handlingCop')::numeric,0);
      central:=base+variable;
      source_type:='TCC_2024_IPC_2026';
    elsif enough and carrier='ENVIA' and ref->>'status'='ESTIMATED_REFERENCE' then
      base:=(ref->>'baseCop')::numeric;
      variable:=coalesce((ref->>'variableCop')::numeric,0);
      central:=base+variable;
      source_type:='ENVIA_REFERENCE';
    elsif carrier in ('TCC','ENVIA') and enough
       and coalesce((row#>>'{measurementScenarios,weight,complete}')::boolean,false)
       and (pr->>'estimateMid') ~ '^[0-9]+(\.[0-9]+)?$' then
       -- No Tuluá/Cali equivalence. Empirical fallback is isolated by provider.
       central:=(pr->>'estimateMid')::numeric;
       source_type:=case when carrier='ENVIA' then 'ENVIA_REAL_GUIDE_MODEL' else 'TCC_REAL_GUIDE_MODEL' end;
    end if;
    if central is not null and central>0 then
      if pr is not null and (pr->>'estimateMid') ~ '^[0-9]+(\.[0-9]+)?$'
         and (pr->>'estimateMid')::numeric>0
         and coalesce((pr->>'referenceSamples')::numeric,0)>=3 then
        spread_low:=greatest(0,(pr->>'estimateLow')::numeric/(pr->>'estimateMid')::numeric);
        spread_high:=greatest(spread_low,(pr->>'estimateHigh')::numeric/(pr->>'estimateMid')::numeric);
        low:=round(central*spread_low);
        high:=round(central*spread_high);
      end if;
      if source_type in ('TCC_REAL_GUIDE_MODEL','ENVIA_REAL_GUIDE_MODEL') and low is null and pr is not null then
        low:=(pr->>'estimateLow')::numeric;high:=(pr->>'estimateHigh')::numeric;
      end if;
      weight:=case when (row#>>'{measurementScenarios,weight,complete}')::boolean
        then (row#>>'{measurementSummary,weightKg}')::numeric else null end;
      calibration:=erp_supply.freight_quote_guide_correction(carrier,row->>'origin',row->>'department',city,weight);
      -- Correction is residual vs contemporary real-guide model, never mixed with
      -- documentary CPI uplift. Keep authoritative raw components unchanged.
      if coalesce((calibration->>'applied')::boolean,false)
         and source_type in ('TCC_REAL_GUIDE_MODEL','ENVIA_REAL_GUIDE_MODEL','ENVIA_REFERENCE') then
        k:=(calibration->>'factor')::numeric;
        central:=round(central*k);low:=round(low*k);high:=round(high*k);
        if base is not null then
          base:=round(base*k);variable:=central-base;
        end if;
      end if;
      doc:=jsonb_build_object('available',true,'source',source_type,'totalCop',central,
        'rangeLowCop',low,'rangeHighCop',high,'baseCop',base,'variableCop',variable,
        'guideCalibration',calibration,
        'reference2024Cop',case when source_type='TCC_2024_IPC_2026' then ref->'subtotalCop' else null end,
        'ipcFactor',case when source_type='TCC_2024_IPC_2026' then indexed else null end,
        'ipcReference','DANE_DIC_2025_SEP_2026',
        'statisticalRange',low is not null and high is not null);
    else
      doc:=jsonb_build_object('available',false,'reason','INSUFFICIENT_CARRIER_EVIDENCE');
    end if;
    row:=row||jsonb_build_object('commercialEstimate',doc);
    enriched:=enriched||jsonb_build_array(row);
    if row->>'carrier'=coalesce(p_payload->>'carrier','TCC') then chosen:=row;end if;
  end loop;
  if chosen is null then return p_snapshot;end if;
  return chosen||jsonb_build_object('comparison',enriched,'prediction',pred,'carrierAliases',p_snapshot->'carrierAliases');
end $$;
revoke all on function erp_supply.freight_quote_market_overlay(jsonb,jsonb) from public,anon,authenticated;

create or replace function public.erp_x_freight_quote_calculate(p_payload jsonb) returns jsonb
language plpgsql stable security definer set search_path=erp_supply,public,auth,pg_catalog as $$
begin
 perform erp_supply.require_freight_quote_access();
 if p_payload->>'measurementVersion'='2' then
   return erp_supply.freight_quote_market_overlay(
     erp_supply.freight_quote_material_calculate(p_payload),p_payload);
 end if;
 return erp_supply.freight_quote_legacy_calculate(p_payload);
end $$;
revoke all on function public.erp_x_freight_quote_calculate(jsonb) from public,anon;
grant execute on function public.erp_x_freight_quote_calculate(jsonb) to authenticated;
