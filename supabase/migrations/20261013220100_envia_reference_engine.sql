begin;
create or replace function erp_supply.envia_territory_key(p_value text) returns text
language sql immutable set search_path=pg_catalog as $$
 select trim(regexp_replace(replace(replace(translate(upper(coalesce(p_value,'')),'ÁÉÍÓÚÜÑ','AEIOUUN'),'.',''),',',''),'\s+',' ','g'))
$$;
revoke all on function erp_supply.envia_territory_key(text) from public,anon,authenticated;
create or replace function erp_supply.envia_reference_calculate(p_rule jsonb,p_packages jsonb,p_policy jsonb) returns jsonb
language plpgsql immutable set search_path=pg_catalog as $$
declare p jsonb; weight numeric; qty numeric; volume numeric; vw numeric; charged numeric; rate numeric; minimum numeric; base numeric; variable numeric; total numeric; threshold numeric; margin numeric; dims integer; count_packages numeric:=0; warnings jsonb:='["DIVISOR_ASSUMED_5000","SOURCE_CONFIDENCE_NOT_STATISTICAL","ORIGIN_NOT_VERIFIED"]';
begin
 if p_rule is null then return jsonb_build_object('status','UNAVAILABLE','reason','ROUTE_UNDOCUMENTED','official',false); end if;
 if p_packages is null or p_packages='[]' then return jsonb_build_object('status','REQUIRES_INFORMATION','official',false); end if;
 if jsonb_typeof(p_packages)<>'array' or jsonb_array_length(p_packages)>100 then raise exception 'Bultos inválidos' using errcode='22023'; end if;
 for p in select value from jsonb_array_elements(p_packages) loop
  weight:=nullif(p->>'weightKg','')::numeric;qty:=coalesce(nullif(p->>'quantity','')::numeric,1);
  if weight is null then return jsonb_build_object('status','REQUIRES_INFORMATION','official',false); end if;
  if weight<=0 or weight>1000000 or qty<1 or qty<>trunc(qty) or qty>10000 or weight::text in ('NaN','Infinity','-Infinity') or qty::text in ('NaN','Infinity','-Infinity') then raise exception 'Peso/cantidad inválidos' using errcode='22023'; end if;
  count_packages:=count_packages+qty;
  for volume in select nullif(p->>key,'')::numeric from unnest(array['lengthM','widthM','heightM','volumeM3']) key loop
   if volume is not null and (volume<=0 or volume>100000 or volume::text in ('NaN','Infinity','-Infinity')) then raise exception 'Dimensión inválida' using errcode='22023'; end if;
  end loop;
 end loop;
 if count_packages<>1 then return jsonb_build_object('status','PENDING_PACKAGING_RULE','official',false,'warnings',warnings||'["MULTI_PACKAGE_POLICY_UNCONFIRMED"]'); end if;
 p:=p_packages->0;weight:=(p->>'weightKg')::numeric;
 select count(*) into dims from unnest(array['lengthM','widthM','heightM']) key where nullif(p->>key,'') is not null;
 volume:=nullif(p->>'volumeM3','')::numeric;
 if volume is null and dims=3 then volume:=(p->>'lengthM')::numeric*(p->>'widthM')::numeric*(p->>'heightM')::numeric;
 elsif volume is null and dims>0 then return jsonb_build_object('status','REQUIRES_INFORMATION','official',false,'warnings',warnings); end if;
 vw:=coalesce(volume*1000000/(p_policy->>'divisor_volumetrico_cm3_por_kg')::numeric,0);
 charged:=ceil(greatest(weight,vw));if charged>1000000 then raise exception 'Peso fuera de rango' using errcode='22023';end if;
 rate:=(p_rule->>'rate_per_kg_cop')::numeric;minimum:=(p_rule->>'min_base_cop')::numeric;variable:=(p_rule->>'fixed_variable_cop')::numeric;
 base:=round(greatest(minimum,charged*rate),0);total:=base+variable;threshold:=floor(minimum/rate)+1;
 margin:=case when p_rule->>'source_confidence'='media' or abs(charged-threshold)<(p_policy->>'caution_threshold_distance_kg')::numeric then (p_policy->>'caution_margin')::numeric else (p_policy->>'default_margin')::numeric end;
 if volume is null then warnings:=warnings||'["DIMENSIONS_NOT_CONFIRMED"]';end if;
 if charged>(p_policy->>'max_verified_weight_kg')::numeric then warnings:=warnings||'["EXTRAPOLATED_OVER_100_KG"]';end if;
 return jsonb_build_object('status','ESTIMATED_REFERENCE','official',false,'ruleKey',p_rule->>'key','weightKg',weight,'volumeWeightKg',vw,'billableKg',charged,'rateCopKg',p_rule->>'rate_per_kg_cop','minimumCop',minimum,'baseCop',base,'variableCop',variable,'totalCop',total,'rangeLowCop',round(total*(1-margin),0),'rangeHighCop',round(total*(1+margin),0),'thresholdKg',threshold,'marginPct',margin*100,'sourceConfidence',p_rule->>'source_confidence','provisionalDimensions',volume is null,'warnings',warnings);
end $$;
revoke all on function erp_supply.envia_reference_calculate(jsonb,jsonb,jsonb) from public,anon,authenticated;
commit;
