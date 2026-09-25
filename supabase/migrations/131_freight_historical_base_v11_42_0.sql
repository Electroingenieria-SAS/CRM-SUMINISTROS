-- CRM SUMINISTROS V11.42.0
-- Activa de forma inmediata la base histórica de 749 despachos.
-- Corrige equivalencias geográficas y agrega fallback:
-- ciudad -> departamento -> base nacional por transportadora.
begin;

create or replace function erp_supply.freight_city_key_v1142(p_value text)
returns text
language sql
immutable
set search_path=erp_supply,pg_catalog
as $$
  with n as (
    select trim(regexp_replace(
      regexp_replace(
        erp_supply.freight_norm_v1140(p_value),
        '[^A-Z0-9 ]+',' ','g'
      ),
      '\s+',' ','g'
    )) v
  )
  select case
    when v in ('BOGOTA D C','BOGOTA DC','BOGOTA DISTRITO CAPITAL','SANTA FE DE BOGOTA','SANTAFE DE BOGOTA') then 'BOGOTA'
    when v in ('GUADALAJARA DE BUGA','BUGA') then 'BUGA'
    when v in ('SANTA CRUZ DE LORICA','LORICA') then 'LORICA'
    when v='SANTIAGO DE CALI' then 'CALI'
    when v='SAN JOSE DE CUCUTA' then 'CUCUTA'
    when v like 'SAN VICENTE DEL CHUCU%' or v like 'SAN VICENTE DE CHUCURI%' then 'SAN VICENTE DE CHUCURI'
    else v
  end
  from n
$$;

revoke all on function erp_supply.freight_city_key_v1142(text) from public,anon,authenticated;

create or replace function erp_supply.freight_department_key_v1142(p_value text)
returns text
language sql
immutable
set search_path=erp_supply,pg_catalog
as $$
  with n as (
    select trim(regexp_replace(
      regexp_replace(
        erp_supply.freight_norm_v1140(p_value),
        '[^A-Z0-9 ]+',' ','g'
      ),
      '\s+',' ','g'
    )) v
  )
  select case
    when v in ('VALLE','VALLE DEL CAUCA') then 'VALLE DEL CAUCA'
    when v in ('BOGOTA D C','BOGOTA DC','D C','DISTRITO CAPITAL','BOGOTA DISTRITO CAPITAL') then 'BOGOTA DC'
    when v in ('GUAJIRA','LA GUAJIRA') then 'GUAJIRA'
    else v
  end
  from n
$$;

revoke all on function erp_supply.freight_department_key_v1142(text) from public,anon,authenticated;

create or replace function erp_supply.freight_reference_scope_v1142(
  p_org uuid,
  p_model_version text,
  p_origin_city text,
  p_carrier text,
  p_city text,
  p_department text
)
returns jsonb
language plpgsql
stable
security definer
set search_path=erp_supply,public,auth,pg_catalog
as $$
declare
  v_carrier text:=erp_supply.freight_norm_v1140(p_carrier);
  v_city_key text:=erp_supply.freight_city_key_v1142(p_city);
  v_department_key text:=erp_supply.freight_department_key_v1142(p_department);
  v_scope text:='NONE';
  v_samples integer:=0;
  v_weight_samples integer:=0;
  v_weight_p20 numeric;
  v_weight_p50 numeric;
  v_weight_p80 numeric;
  v_cost_p20 numeric;
  v_cost_p50 numeric;
  v_cost_p80 numeric;
  v_transit_samples integer:=0;
  v_transit_p50 numeric;
  v_transit_p80 numeric;
  v_novelty_samples integer:=0;
  v_novelty_rate numeric;
  v_on_time_samples integer:=0;
  v_on_time_rate numeric;
  v_charge_samples integer:=0;
  v_charge_ratio numeric;
  v_dimensional_rate numeric;
begin
  -- 1. La ciudad manda. El departamento se usa solo para priorizar, no para excluir.
  with x as(
    select *
    from erp_supply.freight_route_reference r
    where r.organization_id=p_org
      and r.model_version=p_model_version
      and r.origin_city=erp_supply.freight_norm_v1140(p_origin_city)
      and r.carrier=v_carrier
      and erp_supply.freight_city_key_v1142(r.destination_city)=v_city_key
  )
  select
    coalesce(sum(sample_count),0)::int,
    coalesce(sum(weight_sample_count),0)::int,
    sum(weight_p20*weight_sample_count)/nullif(sum(weight_sample_count),0),
    sum(weight_p50*weight_sample_count)/nullif(sum(weight_sample_count),0),
    sum(weight_p80*weight_sample_count)/nullif(sum(weight_sample_count),0),
    sum(cost_p20*sample_count)/nullif(sum(sample_count),0),
    sum(cost_p50*sample_count)/nullif(sum(sample_count),0),
    sum(cost_p80*sample_count)/nullif(sum(sample_count),0),
    coalesce(sum(transit_sample_count),0)::int,
    sum(transit_p50_days*transit_sample_count)/nullif(sum(transit_sample_count),0),
    sum(transit_p80_days*transit_sample_count)/nullif(sum(transit_sample_count),0),
    coalesce(sum(novelty_sample_count),0)::int,
    sum(novelty_rate*novelty_sample_count)/nullif(sum(novelty_sample_count),0),
    coalesce(sum(on_time_sample_count),0)::int,
    sum(on_time_rate*on_time_sample_count)/nullif(sum(on_time_sample_count),0),
    coalesce(sum(charge_real_sample_count),0)::int,
    sum(charge_to_real_p50*charge_real_sample_count)/nullif(sum(charge_real_sample_count),0),
    sum(dimensional_uplift_rate*greatest(charge_real_sample_count,sample_count))
      /nullif(sum(greatest(charge_real_sample_count,sample_count)),0)
  into
    v_samples,v_weight_samples,v_weight_p20,v_weight_p50,v_weight_p80,
    v_cost_p20,v_cost_p50,v_cost_p80,
    v_transit_samples,v_transit_p50,v_transit_p80,
    v_novelty_samples,v_novelty_rate,
    v_on_time_samples,v_on_time_rate,
    v_charge_samples,v_charge_ratio,v_dimensional_rate
  from x;

  if v_samples>0 then
    v_scope:='CITY_HISTORY';
  end if;

  -- 2. Si la ciudad nunca apareció, usa el departamento cargado en el archivo.
  if v_samples=0 and v_department_key<>'' then
    with x as(
      select *
      from erp_supply.freight_route_reference r
      where r.organization_id=p_org
        and r.model_version=p_model_version
        and r.origin_city=erp_supply.freight_norm_v1140(p_origin_city)
        and r.carrier=v_carrier
        and erp_supply.freight_department_key_v1142(r.destination_department)=v_department_key
    )
    select
      coalesce(sum(sample_count),0)::int,
      coalesce(sum(weight_sample_count),0)::int,
      sum(weight_p20*weight_sample_count)/nullif(sum(weight_sample_count),0),
      sum(weight_p50*weight_sample_count)/nullif(sum(weight_sample_count),0),
      sum(weight_p80*weight_sample_count)/nullif(sum(weight_sample_count),0),
      sum(cost_p20*sample_count)/nullif(sum(sample_count),0),
      sum(cost_p50*sample_count)/nullif(sum(sample_count),0),
      sum(cost_p80*sample_count)/nullif(sum(sample_count),0),
      coalesce(sum(transit_sample_count),0)::int,
      sum(transit_p50_days*transit_sample_count)/nullif(sum(transit_sample_count),0),
      sum(transit_p80_days*transit_sample_count)/nullif(sum(transit_sample_count),0),
      coalesce(sum(novelty_sample_count),0)::int,
      sum(novelty_rate*novelty_sample_count)/nullif(sum(novelty_sample_count),0),
      coalesce(sum(on_time_sample_count),0)::int,
      sum(on_time_rate*on_time_sample_count)/nullif(sum(on_time_sample_count),0),
      coalesce(sum(charge_real_sample_count),0)::int,
      sum(charge_to_real_p50*charge_real_sample_count)/nullif(sum(charge_real_sample_count),0),
      sum(dimensional_uplift_rate*greatest(charge_real_sample_count,sample_count))
        /nullif(sum(greatest(charge_real_sample_count,sample_count)),0)
    into
      v_samples,v_weight_samples,v_weight_p20,v_weight_p50,v_weight_p80,
      v_cost_p20,v_cost_p50,v_cost_p80,
      v_transit_samples,v_transit_p50,v_transit_p80,
      v_novelty_samples,v_novelty_rate,
      v_on_time_samples,v_on_time_rate,
      v_charge_samples,v_charge_ratio,v_dimensional_rate
    from x;

    if v_samples>0 then v_scope:='DEPARTMENT_HISTORY'; end if;
  end if;

  -- 3. Último respaldo: toda la base de esa transportadora. Sigue siendo histórico real.
  if v_samples=0 then
    with x as(
      select *
      from erp_supply.freight_route_reference r
      where r.organization_id=p_org
        and r.model_version=p_model_version
        and r.origin_city=erp_supply.freight_norm_v1140(p_origin_city)
        and r.carrier=v_carrier
    )
    select
      coalesce(sum(sample_count),0)::int,
      coalesce(sum(weight_sample_count),0)::int,
      sum(weight_p20*weight_sample_count)/nullif(sum(weight_sample_count),0),
      sum(weight_p50*weight_sample_count)/nullif(sum(weight_sample_count),0),
      sum(weight_p80*weight_sample_count)/nullif(sum(weight_sample_count),0),
      sum(cost_p20*sample_count)/nullif(sum(sample_count),0),
      sum(cost_p50*sample_count)/nullif(sum(sample_count),0),
      sum(cost_p80*sample_count)/nullif(sum(sample_count),0),
      coalesce(sum(transit_sample_count),0)::int,
      sum(transit_p50_days*transit_sample_count)/nullif(sum(transit_sample_count),0),
      sum(transit_p80_days*transit_sample_count)/nullif(sum(transit_sample_count),0),
      coalesce(sum(novelty_sample_count),0)::int,
      sum(novelty_rate*novelty_sample_count)/nullif(sum(novelty_sample_count),0),
      coalesce(sum(on_time_sample_count),0)::int,
      sum(on_time_rate*on_time_sample_count)/nullif(sum(on_time_sample_count),0),
      coalesce(sum(charge_real_sample_count),0)::int,
      sum(charge_to_real_p50*charge_real_sample_count)/nullif(sum(charge_real_sample_count),0),
      sum(dimensional_uplift_rate*greatest(charge_real_sample_count,sample_count))
        /nullif(sum(greatest(charge_real_sample_count,sample_count)),0)
    into
      v_samples,v_weight_samples,v_weight_p20,v_weight_p50,v_weight_p80,
      v_cost_p20,v_cost_p50,v_cost_p80,
      v_transit_samples,v_transit_p50,v_transit_p80,
      v_novelty_samples,v_novelty_rate,
      v_on_time_samples,v_on_time_rate,
      v_charge_samples,v_charge_ratio,v_dimensional_rate
    from x;

    if v_samples>0 then v_scope:='NATIONAL_BASELINE'; end if;
  end if;

  return jsonb_build_object(
    'scope',v_scope,
    'sampleCount',v_samples,
    'weightSampleCount',v_weight_samples,
    'weightP20',v_weight_p20,
    'weightP50',v_weight_p50,
    'weightP80',v_weight_p80,
    'costP20',v_cost_p20,
    'costP50',v_cost_p50,
    'costP80',v_cost_p80,
    'transitSampleCount',v_transit_samples,
    'transitP50Days',v_transit_p50,
    'transitP80Days',v_transit_p80,
    'noveltySampleCount',v_novelty_samples,
    'noveltyRate',v_novelty_rate,
    'onTimeSampleCount',v_on_time_samples,
    'onTimeRate',v_on_time_rate,
    'chargeRealSampleCount',v_charge_samples,
    'chargeToRealP50',v_charge_ratio,
    'dimensionalUpliftRate',v_dimensional_rate
  );
end;
$$;

revoke all on function erp_supply.freight_reference_scope_v1142(uuid,text,text,text,text,text)
from public,anon,authenticated;

create or replace function erp_supply.freight_model_predict_v1140(
  p_org uuid,
  p_carrier text,
  p_department text,
  p_city text,
  p_weight_kg numeric default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path=erp_supply,public,auth,pg_catalog
as $$
declare
  v_carrier text:=erp_supply.freight_norm_v1140(p_carrier);
  v_city_raw text:=erp_supply.freight_norm_v1140(p_city);
  v_city_key text:=erp_supply.freight_city_key_v1142(p_city);
  v_department_raw text:=erp_supply.freight_norm_v1140(p_department);
  v_department_key text:=erp_supply.freight_department_key_v1142(p_department);
  v_model_city text;
  v_model_department text;
  v_weight numeric:=case when p_weight_kg is null then null else greatest(p_weight_kg,0) end;
  v_band integer:=erp_supply.freight_weight_band_v1140(p_weight_kg);
  v_lw numeric:=ln(1+coalesce(v_weight,0));
  v_model erp_supply.freight_prediction_models%rowtype;
  v_ref jsonb;
  v_scope text;
  v_ref_samples integer:=0;
  v_log numeric;
  v_mid numeric;
  v_low numeric;
  v_high numeric;
  v_low90 numeric;
  v_high90 numeric;
  v_p20 numeric;
  v_p80 numeric;
  v_p10 numeric;
  v_p90 numeric;
  v_confidence text;
  v_uncertainty numeric;
begin
  select * into v_model
  from erp_supply.freight_prediction_models m
  where m.organization_id=p_org
    and m.model_code='EI_FREIGHT_RIDGE_WEIGHT'
    and m.active
  order by m.source_end desc,m.created_at desc
  limit 1;

  if not found then
    return jsonb_build_object(
      'available',false,'reason','MODEL_NOT_AVAILABLE',
      'carrier',v_carrier,'version','11.42.0'
    );
  end if;

  v_ref:=erp_supply.freight_reference_scope_v1142(
    p_org,v_model.model_version,v_model.origin_city,v_carrier,p_city,p_department
  );
  v_scope:=coalesce(v_ref->>'scope','NONE');
  v_ref_samples:=coalesce(erp_supply.safe_numeric(v_ref->>'sampleCount'),0)::integer;

  -- Conserva el nombre del modelo si ya existe; si no, usa la equivalencia geográfica.
  v_model_city:=case
    when v_model.coefficients ? ('dest='||v_city_raw) then v_city_raw
    when v_model.coefficients ? ('dest='||v_city_key) then v_city_key
    else v_city_key
  end;
  v_model_department:=case
    when v_model.coefficients ? ('dept='||v_department_raw) then v_department_raw
    when v_model.coefficients ? ('dept='||v_department_key) then v_department_key
    else v_department_key
  end;

  if v_weight is null or v_weight<=0 then
    if v_ref_samples<=0 or erp_supply.safe_numeric(v_ref->>'costP50') is null then
      return jsonb_build_object(
        'available',false,'reason','HISTORICAL_BASE_NOT_AVAILABLE',
        'carrier',v_carrier,'city',p_city,'department',p_department,
        'historicalBaseSamples',v_model.sample_count,'version','11.42.0'
      );
    end if;
    v_mid:=erp_supply.safe_numeric(v_ref->>'costP50');
    v_low:=coalesce(erp_supply.safe_numeric(v_ref->>'costP20'),v_mid);
    v_high:=coalesce(erp_supply.safe_numeric(v_ref->>'costP80'),v_mid);
    v_low90:=v_low;
    v_high90:=v_high;
  else
    v_log:=v_model.intercept
      +coalesce(erp_supply.safe_numeric(v_model.coefficients->>('carrier='||v_carrier)),0)
      +coalesce(erp_supply.safe_numeric(v_model.coefficients->>('dest='||v_model_city)),0)
      +coalesce(erp_supply.safe_numeric(v_model.coefficients->>('dept='||v_model_department)),0)
      +coalesce(erp_supply.safe_numeric(v_model.coefficients->>('band='||v_band::text)),0)
      +coalesce(erp_supply.safe_numeric(v_model.coefficients->>'lw'),0)*v_lw
      +coalesce(erp_supply.safe_numeric(v_model.coefficients->>'lw2'),0)*v_lw*v_lw
      +coalesce(erp_supply.safe_numeric(v_model.coefficients->>(v_carrier||':lw')),0)*v_lw
      +coalesce(erp_supply.safe_numeric(v_model.coefficients->>(v_carrier||':lw2')),0)*v_lw*v_lw
      +coalesce(erp_supply.safe_numeric(v_model.coefficients->>('destlw='||v_model_city)),0)*v_lw;

    v_mid:=greatest(0,exp(v_log)-1);
    v_p20:=coalesce(erp_supply.safe_numeric(v_model.calibration#>>array[v_carrier,'p20']),0.80);
    v_p80:=coalesce(erp_supply.safe_numeric(v_model.calibration#>>array[v_carrier,'p80']),1.25);
    v_p10:=coalesce(erp_supply.safe_numeric(v_model.calibration#>>array[v_carrier,'p10']),0.70);
    v_p90:=coalesce(erp_supply.safe_numeric(v_model.calibration#>>array[v_carrier,'p90']),1.50);
    v_low:=v_mid*v_p20;
    v_high:=v_mid*v_p80;
    v_low90:=v_mid*v_p10;
    v_high90:=v_mid*v_p90;
  end if;

  v_uncertainty:=case when v_mid>0 then greatest(0,(v_high-v_low)/(2*v_mid)*100) else null end;
  v_confidence:=case
    when v_weight is null then
      case
        when v_scope='CITY_HISTORY' and v_ref_samples>=10 then 'MEDIUM'
        else 'LOW'
      end
    when v_scope='CITY_HISTORY' and v_ref_samples>=10 then 'HIGH'
    when v_scope='CITY_HISTORY' and v_ref_samples>=3 then 'MEDIUM'
    when v_scope='DEPARTMENT_HISTORY' and v_ref_samples>=20 then 'MEDIUM'
    else 'LOW'
  end;

  return jsonb_build_object(
    'available',true,
    'carrier',v_carrier,
    'city',p_city,
    'department',p_department,
    'originCity',v_model.origin_city,
    'weightKg',v_weight,
    'basis',case when v_weight is null then 'HISTORICAL_BASE' else 'WEIGHT_MODEL' end,
    'referenceScope',v_scope,
    'referenceSamples',v_ref_samples,
    'historicalBaseSamples',v_model.sample_count,
    'modelCityKey',v_model_city,
    'modelDepartmentKey',v_model_department,
    'estimateLow',round(v_low,0),
    'estimateMid',round(v_mid,0),
    'estimateHigh',round(v_high,0),
    'conservativeLow',round(v_low90,0),
    'conservativeHigh',round(v_high90,0),
    'uncertaintyPct',case when v_uncertainty is null then null else round(v_uncertainty,1) end,
    'confidence',v_confidence,
    'routeSamples',case when v_scope='CITY_HISTORY' then v_ref_samples else 0 end,
    'sourcePeriod',jsonb_build_object('from',v_model.source_start,'to',v_model.source_end),
    'source','UPLOADED_HISTORICAL_BASE',
    'transit',jsonb_build_object(
      'samples',coalesce(erp_supply.safe_numeric(v_ref->>'transitSampleCount'),0),
      'medianDays',erp_supply.safe_numeric(v_ref->>'transitP50Days'),
      'p80Days',erp_supply.safe_numeric(v_ref->>'transitP80Days')
    ),
    'risk',jsonb_build_object(
      'noveltySamples',coalesce(erp_supply.safe_numeric(v_ref->>'noveltySampleCount'),0),
      'noveltyRate',erp_supply.safe_numeric(v_ref->>'noveltyRate'),
      'onTimeSamples',coalesce(erp_supply.safe_numeric(v_ref->>'onTimeSampleCount'),0),
      'onTimeRate',erp_supply.safe_numeric(v_ref->>'onTimeRate'),
      'chargeRealSamples',coalesce(erp_supply.safe_numeric(v_ref->>'chargeRealSampleCount'),0),
      'chargeToRealP50',erp_supply.safe_numeric(v_ref->>'chargeToRealP50'),
      'dimensionalUpliftRate',erp_supply.safe_numeric(v_ref->>'dimensionalUpliftRate')
    ),
    'modelMetrics',v_model.metrics,
    'modelVersion',v_model.model_version,
    'engineVersion','11.42.0'
  );
end;
$$;

revoke all on function erp_supply.freight_model_predict_v1140(uuid,text,text,text,numeric)
from public,anon,authenticated;

create or replace function public.erp_x_freight_predictions(
  p_department text default null,
  p_city text default null,
  p_weight_kg numeric default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path=erp_supply,public,auth,pg_catalog
as $$
declare
  v_org uuid:=erp_supply.current_org_id();
  v_rows jsonb;
  v_cheapest text;
  v_fastest text;
  v_stable text;
  v_model erp_supply.freight_prediction_models%rowtype;
  v_routes integer:=0;
  v_cities integer:=0;
  v_carriers integer:=0;
begin
  perform erp_supply.require_profile();
  if not (
    erp_supply.can_access_module('sales','read')
    or erp_supply.can_access_module('orders','read')
    or erp_supply.can_access_module('shipping','read')
    or erp_supply.can_access_module('reports','read')
    or erp_supply.has_role('super_admin')
    or erp_supply.has_role('gerencia')
    or erp_supply.has_role('jefe_logistica')
  ) then
    raise exception 'No autorizado para consultar predicciones de flete' using errcode='42501';
  end if;

  if nullif(trim(coalesce(p_city,'')),'') is null then
    return jsonb_build_object('available',false,'reason','CITY_REQUIRED','version','11.42.0');
  end if;

  select * into v_model
  from erp_supply.freight_prediction_models m
  where m.organization_id=v_org
    and m.model_code='EI_FREIGHT_RIDGE_WEIGHT'
    and m.active
  order by m.source_end desc,m.created_at desc limit 1;

  if not found then
    return jsonb_build_object('available',false,'reason','MODEL_NOT_AVAILABLE','version','11.42.0');
  end if;

  select count(*),count(distinct erp_supply.freight_city_key_v1142(destination_city)),count(distinct carrier)
  into v_routes,v_cities,v_carriers
  from erp_supply.freight_route_reference
  where organization_id=v_org and model_version=v_model.model_version;

  with carriers(carrier) as(values('COLVANES'),('TCC'),('VELOENVIOS')),
  pred as(
    select carrier,erp_supply.freight_model_predict_v1140(v_org,carrier,p_department,p_city,p_weight_kg) prediction
    from carriers
  ),
  available as(
    select carrier,prediction
    from pred
    where coalesce((prediction->>'available')::boolean,false)
  )
  select coalesce(jsonb_agg(prediction order by coalesce(erp_supply.safe_numeric(prediction->>'estimateMid'),1e18)),'[]'::jsonb)
  into v_rows
  from available;

  with carriers(carrier) as(values('COLVANES'),('TCC'),('VELOENVIOS')),
  pred as(
    select carrier,erp_supply.freight_model_predict_v1140(v_org,carrier,p_department,p_city,p_weight_kg) prediction
    from carriers
  ),
  available as(
    select carrier,prediction
    from pred
    where coalesce((prediction->>'available')::boolean,false)
  )
  select carrier into v_cheapest
  from available
  order by erp_supply.safe_numeric(prediction->>'estimateMid') nulls last
  limit 1;

  with carriers(carrier) as(values('COLVANES'),('TCC'),('VELOENVIOS')),
  pred as(
    select carrier,erp_supply.freight_model_predict_v1140(v_org,carrier,p_department,p_city,p_weight_kg) prediction
    from carriers
  ),
  available as(
    select carrier,prediction
    from pred
    where coalesce((prediction->>'available')::boolean,false)
  )
  select carrier into v_fastest
  from available
  where erp_supply.safe_numeric(prediction#>>'{transit,medianDays}') is not null
  order by erp_supply.safe_numeric(prediction#>>'{transit,medianDays}') asc
  limit 1;

  with carriers(carrier) as(values('COLVANES'),('TCC'),('VELOENVIOS')),
  pred as(
    select carrier,erp_supply.freight_model_predict_v1140(v_org,carrier,p_department,p_city,p_weight_kg) prediction
    from carriers
  ),
  available as(
    select carrier,prediction
    from pred
    where coalesce((prediction->>'available')::boolean,false)
  )
  select carrier into v_stable
  from available
  where erp_supply.safe_numeric(prediction->>'uncertaintyPct') is not null
  order by erp_supply.safe_numeric(prediction->>'uncertaintyPct') asc
  limit 1;

  return jsonb_build_object(
    'available',jsonb_array_length(v_rows)>0,
    'city',p_city,
    'department',p_department,
    'weightKg',p_weight_kg,
    'mode',case when coalesce(p_weight_kg,0)>0 then 'REFINED_WEIGHT_MODEL' else 'HISTORICAL_BASE_ACTIVE' end,
    'carriers',v_rows,
    'cheapestCarrier',v_cheapest,
    'fastestCarrier',v_fastest,
    'mostStableCarrier',v_stable,
    'historicalBase',jsonb_build_object(
      'active',true,
      'samples',v_model.sample_count,
      'routes',v_routes,
      'cities',v_cities,
      'carriers',v_carriers,
      'source','UPLOADED_FILE',
      'privacy','AGGREGATED_NO_PII'
    ),
    'training',jsonb_build_object(
      'samples',v_model.sample_count,
      'sourceFrom',v_model.source_start,
      'sourceTo',v_model.source_end,
      'metrics',v_model.metrics,
      'privacy','AGGREGATED_NO_PII'
    ),
    'version','11.42.0',
    'modelVersion',v_model.model_version
  );
end;
$$;

revoke all on function public.erp_x_freight_predictions(text,text,numeric) from public,anon;
grant execute on function public.erp_x_freight_predictions(text,text,numeric) to authenticated;

comment on function erp_supply.freight_city_key_v1142(text)
is 'V11.42.0: normaliza municipios del formulario DIVIPOLA contra la base histórica de fletes.';
comment on function erp_supply.freight_department_key_v1142(text)
is 'V11.42.0: normaliza departamentos y aliases de la base histórica.';
comment on function erp_supply.freight_reference_scope_v1142(uuid,text,text,text,text,text)
is 'V11.42.0: selecciona base histórica por ciudad, departamento o transportadora nacional.';
comment on function erp_supply.freight_model_predict_v1140(uuid,text,text,text,numeric)
is 'V11.42.0: usa de inmediato los 749 despachos históricos; el peso refina, no habilita, la predicción.';
comment on function public.erp_x_freight_predictions(text,text,numeric)
is 'V11.42.0: comparación de transportadoras con base histórica activa desde la selección del destino.';

notify pgrst,'reload schema';
commit;
