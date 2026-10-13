begin;
create or replace function erp_supply.freight_material_reference(p_carrier text,p_basis text,p_amount numeric,p_rate numeric,p_rules jsonb,p_declared numeric) returns jsonb
language plpgsql immutable set search_path=erp_supply,public,pg_catalog as $$
declare kg numeric;factor numeric; surcharge numeric:=0;base numeric;handling numeric:=0;variable numeric;threshold numeric;margin numeric;warnings jsonb:='[]';
begin
 if p_amount<=0 or p_amount is null then return jsonb_build_object('status','REQUIRES_INFORMATION','official',false);end if;
 if p_rate is null then return jsonb_build_object('status','UNAVAILABLE','reason','RATE_UNAVAILABLE','official',false);end if;
 factor:=case when p_carrier='TCC' then (p_rules->>'volumetricFactor')::numeric else 1000000/(p_rules->>'divisor_volumetrico_cm3_por_kg')::numeric end;
 kg:=case when p_basis='VOLUME' then p_amount*factor else p_amount end;
 if p_carrier='TCC' then
  if coalesce((p_rules->>'surchargeApplies')::boolean,false) or (p_basis='WEIGHT' and kg>(p_rules->>'realThresholdKg')::numeric) or (p_basis='VOLUME' and kg>(p_rules->>'volumeThresholdKg')::numeric) then surcharge:=(p_rules->>'surchargeCopKg')::numeric;end if;
  base:=kg*(p_rate+surcharge);
  if p_declared>=(p_rules->>'handlingThresholdCop')::numeric then handling:=p_declared*(p_rules->>'handlingRate')::numeric;end if;
  return jsonb_build_object('status','HISTORICAL_REFERENCE','official',false,'basis',p_basis,'billableKg',kg,'amount',p_amount,'conversionFactor',factor,'rateCopKg',p_rate,'surchargeCopKg',surcharge,'baseCop',base,'handlingCop',handling,'subtotalCop',base+handling,'declaredValuePending',p_declared is null);
 end if;
 kg:=ceil(kg);threshold:=floor((p_rules->>'min_base_cop')::numeric/p_rate)+1;
 base:=round(greatest((p_rules->>'min_base_cop')::numeric,kg*p_rate));variable:=(p_rules->>'fixed_variable_cop')::numeric;
 margin:=case when p_rules->>'source_confidence'='media' or abs(kg-threshold)<(p_rules->>'caution_threshold_distance_kg')::numeric then (p_rules->>'caution_margin')::numeric else (p_rules->>'default_margin')::numeric end;
 if kg>(p_rules->>'max_verified_weight_kg')::numeric then warnings:=warnings||'"EXTRAPOLATED_OVER_100_KG"'::jsonb;end if;
 return jsonb_build_object('status','ESTIMATED_REFERENCE','official',false,'basis',p_basis,'amount',p_amount,'conversionFactor',factor,'billableKg',kg,'rateCopKg',p_rate,'minimumCop',p_rules->'min_base_cop','baseCop',base,'variableCop',variable,'totalCop',base+variable,'thresholdKg',threshold,'marginPct',margin*100,'rangeLowCop',round((base+variable)*(1-margin)),'rangeHighCop',round((base+variable)*(1+margin)),'sourceConfidence',p_rules->>'source_confidence','warnings',warnings);
end $$;

create or replace function erp_supply.freight_quote_material_calculate(p_payload jsonb) returns jsonb
language plpgsql stable security definer set search_path=erp_supply,public,auth,pg_catalog as $$
declare legacy jsonb;row jsonb;mat jsonb;scenarios jsonb;comparison jsonb:='[]';selected jsonb;ref jsonb;wr jsonb;vr jsonb;rules jsonb;rate numeric;w numeric:=0;v numeric:=0;wc int:=0;vc int:=0;n int;val numeric;basis text;prediction jsonb;model_origin text;declared numeric;
begin
 perform erp_supply.require_freight_quote_access();
 if octet_length(p_payload::text)>100000 or jsonb_typeof(p_payload->'materials') is distinct from 'array' then raise exception 'Materiales inválidos' using errcode='22023';end if;
 n:=jsonb_array_length(p_payload->'materials');if n>100 then raise exception 'Máximo 100 materiales' using errcode='22023';end if;
 for mat in select value from jsonb_array_elements(p_payload->'materials') loop
  if length(coalesce(mat->>'description',''))>240 then raise exception 'Nombre del material demasiado largo';end if;
  if coalesce(mat->>'measurementMode','WEIGHT') not in ('WEIGHT','VOLUME') then raise exception 'Modalidad inválida';end if;
  val:=nullif(mat->>'weightKg','')::numeric;
  if val is not null then
   if val<=0 or val>1000000 or val::text in ('NaN','Infinity','-Infinity') then raise exception 'Peso inválido' using errcode='22023';end if;w:=w+val;wc:=wc+1;
  end if;
  val:=nullif(mat->>'volumeM3','')::numeric;
  if val is not null then
   if val<=0 or val>100000 or val::text in ('NaN','Infinity','-Infinity') then raise exception 'Volumen inválido' using errcode='22023';end if;v:=v+val;vc:=vc+1;
  end if;
 end loop;
 declared:=nullif(p_payload->>'declaredValue','')::numeric;
 if declared<0 or declared::text in ('NaN','Infinity','-Infinity') then raise exception 'Valor declarado inválido';end if;
 legacy:=erp_supply.freight_quote_legacy_calculate(p_payload||'{"packages":[]}');
 for row in select value from jsonb_array_elements(legacy->'comparison') loop
  if row->>'carrier'='TCC' then
   select p.rules into rules from erp_supply.freight_quote_policies p where version=row->>'policyVersion';rate:=(row->>'rateCopKg')::numeric;
   rules:=rules||jsonb_build_object('surchargeApplies',w>(rules->>'realThresholdKg')::numeric or v*(rules->>'volumetricFactor')::numeric>(rules->>'volumeThresholdKg')::numeric);
  else
   select r.policy||r.source_data into rules from erp_supply.freight_tariff_rules r join erp_supply.freight_tariff_editions e on e.version=r.dataset_version where r.carrier='ENVIA' and r.dataset_version=row->>'tariffVersion' and r.source_key=row->>'sourceKey' and r.active and e.active;
   rate:=(rules->>'rate_per_kg_cop')::numeric;
  end if;
  wr:=erp_supply.freight_material_reference(row->>'carrier','WEIGHT',w,rate,rules,declared)||jsonb_build_object('complete',wc=n and n>0,'measuredMaterials',wc,'totalMaterials',n);
  vr:=erp_supply.freight_material_reference(row->>'carrier','VOLUME',v,rate,rules,declared)||jsonb_build_object('complete',vc=n and n>0,'measuredMaterials',vc,'totalMaterials',n);
  if row#>>'{reference,reason}' in ('ORIGIN_ROUTE_UNAVAILABLE','ROUTE_UNDOCUMENTED') then
   wr:=wr||jsonb_build_object('status','UNAVAILABLE','reason',row#>>'{reference,reason}');vr:=vr||jsonb_build_object('status','UNAVAILABLE','reason',row#>>'{reference,reason}');
  end if;
  basis:=case when wc=n and vc=n and n>0 then case when (vr->>'billableKg')::numeric>(wr->>'billableKg')::numeric then 'VOLUME' else 'WEIGHT' end when wc=n and n>0 then 'WEIGHT' when vc=n and n>0 then 'VOLUME' else null end;
  ref:=case basis when 'WEIGHT' then wr when 'VOLUME' then vr else jsonb_build_object('status','REQUIRES_INFORMATION','official',false) end;
  row:=(row-'reference')||jsonb_build_object('reference',ref,'measurementScenarios',jsonb_build_object('weight',wr,'volume',vr),'selectedBasis',basis,'measurementVersion',2,'measurementSummary',jsonb_build_object('count',n,'weightKg',w,'volumeM3',v,'weightCount',wc,'volumeCount',vc),'measurementWarning','Estimación agregada con las medidas registradas. La transportadora verifica peso, volumen y empaque al despachar.');
  comparison:=comparison||jsonb_build_array(row);
  if row->>'carrier'=coalesce(p_payload->>'carrier','TCC') then selected:=row;end if;
 end loop;
 prediction:=jsonb_build_object('available',false,'reason','REAL_WEIGHT_INCOMPLETE');
 select origin_city into model_origin from erp_supply.freight_prediction_models where organization_id=erp_supply.current_org_id() and active order by updated_at desc limit 1;
 if wc=n and n>0 and p_payload->>'origin'=model_origin then prediction:=public.erp_x_freight_predictions(legacy->>'department',regexp_replace(legacy->>'destination','\s*\([^)]*\)\s*$',''),w);end if;
 return selected||jsonb_build_object('comparison',comparison,'prediction',prediction,'carrierAliases',legacy->'carrierAliases');
end $$;
commit;
