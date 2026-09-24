-- CRM SUMINISTROS V11.39.0
-- Inteligencia comercial y logística:
--  * segmentación automática de clientes por frecuencia + valor facturado;
--  * prioridad automática de pedidos;
--  * estimación de flete por histórico real;
--  * facturas navegables desde Centro de Operaciones;
--  * distancia y tiempo real/estimado por despacho.
-- No crea tablas nuevas.

begin;

update erp_supply.organizations
set settings=coalesce(settings,'{}'::jsonb)||jsonb_build_object(
  'shippingOriginCity','Tuluá',
  'shippingOriginDepartment','Valle del Cauca'
),
updated_at=now()
where code='EI';

create or replace function erp_supply.customer_key(p_document text,p_name text)
returns text
language sql
immutable
as $$
  select case
    when nullif(trim(coalesce(p_document,'')),'') is not null
      then 'DOC:'||upper(regexp_replace(trim(p_document),'\s+','','g'))
    else 'NAME:'||lower(regexp_replace(trim(coalesce(p_name,'')),'\s+',' ','g'))
  end
$$;

create or replace function erp_supply.customer_value_profile(
  p_org uuid,
  p_document text,
  p_name text,
  p_include_pending boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path=erp_supply,public,auth,pg_catalog
as $$
declare
  v_key text:=erp_supply.customer_key(p_document,p_name);
  v_orders bigint:=0;
  v_paid numeric:=0;
  v_clients bigint:=0;
  v_total_orders bigint:=0;
  v_freq numeric:=0;
  v_value numeric:=0;
  v_score numeric:=0;
  v_segment text:='NORMAL';
  v_priority text:='MEDIUM';
  v_confidence text:='LEARNING';
  v_mature boolean:=false;
begin
  with order_value as(
    select
      o.id,
      erp_supply.customer_key(o.client_document,o.client_name) customer_key,
      coalesce((
        select sum(i.amount)
        from erp_supply.invoices i
        where i.order_id=o.id
          and i.amount is not null
          and i.amount>0
      ),0)::numeric paid_amount
    from erp_supply.orders o
    where o.organization_id=p_org
      and not coalesce(o.is_test,false)
      and o.status<>'CANCELLED'
  ),
  client_base as(
    select
      customer_key,
      count(*)::bigint order_count,
      coalesce(sum(paid_amount),0)::numeric paid_amount
    from order_value
    group by customer_key
  ),
  target_adjusted as(
    select
      c.customer_key,
      c.order_count + case when c.customer_key=v_key and p_include_pending then 1 else 0 end order_count,
      c.paid_amount
    from client_base c
    union all
    select
      v_key,
      case when p_include_pending then 1 else 0 end,
      0::numeric
    where not exists(select 1 from client_base where customer_key=v_key)
  ),
  ranked as(
    select
      customer_key,
      order_count,
      paid_amount,
      percent_rank() over(order by order_count)::numeric frequency_rank,
      percent_rank() over(order by paid_amount)::numeric value_rank,
      count(*) over()::bigint client_count,
      sum(order_count) over()::bigint total_orders
    from target_adjusted
  )
  select
    order_count,
    paid_amount,
    client_count,
    total_orders,
    frequency_rank,
    value_rank
  into
    v_orders,
    v_paid,
    v_clients,
    v_total_orders,
    v_freq,
    v_value
  from ranked
  where customer_key=v_key;

  v_orders:=coalesce(v_orders,case when p_include_pending then 1 else 0 end);
  v_paid:=coalesce(v_paid,0);
  v_clients:=coalesce(v_clients,1);
  v_total_orders:=coalesce(v_total_orders,v_orders);
  v_freq:=coalesce(v_freq,0);
  v_value:=coalesce(v_value,0);
  v_score:=round((50.0*v_freq+50.0*v_value)::numeric,1);

  -- Evita clasificar prematuramente una base pequeña.
  v_mature:=v_total_orders>=20 and v_clients>=5 and v_orders>=3;

  if v_mature then
    if v_score>=90 then
      v_segment:='URGENT';
      v_priority:='URGENT';
    elsif v_score>=70 then
      v_segment:='PREMIUM';
      v_priority:='HIGH';
    elsif v_score>=30 then
      v_segment:='NORMAL';
      v_priority:='MEDIUM';
    else
      v_segment:='BASIC';
      v_priority:='LOW';
    end if;

    v_confidence:=case
      when v_orders>=10 then 'HIGH'
      when v_orders>=5 then 'MEDIUM'
      else 'LOW'
    end;
  end if;

  return jsonb_build_object(
    'customerKey',v_key,
    'segment',v_segment,
    'priority',v_priority,
    'score',v_score,
    'orderCount',v_orders,
    'paidAmount',v_paid,
    'frequencyPercentile',round((100*v_freq)::numeric,1),
    'valuePercentile',round((100*v_value)::numeric,1),
    'confidence',v_confidence,
    'learningActive',v_mature,
    'sampleClients',v_clients,
    'sampleOrders',v_total_orders,
    'valueSource','INVOICE_AMOUNT',
    'weights',jsonb_build_object('orderCount',0.5,'paidAmount',0.5),
    'version','11.39.0'
  );
end;
$$;

revoke all on function erp_supply.customer_value_profile(uuid,text,text,boolean) from public,anon;

create or replace function public.erp_x_customer_intelligence(
  p_client_document text default null,
  p_client_name text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path=erp_supply,public,auth,pg_catalog
as $$
declare
  v_org uuid:=erp_supply.current_org_id();
begin
  perform erp_supply.require_profile();
  if nullif(trim(coalesce(p_client_name,'')),'') is null
     and nullif(trim(coalesce(p_client_document,'')),'') is null then
    return jsonb_build_object(
      'segment','NORMAL','priority','MEDIUM','score',0,'orderCount',0,'paidAmount',0,
      'confidence','LEARNING','learningActive',false,'version','11.39.0'
    );
  end if;
  return erp_supply.customer_value_profile(v_org,p_client_document,p_client_name,true);
end;
$$;

revoke all on function public.erp_x_customer_intelligence(text,text) from public,anon;
grant execute on function public.erp_x_customer_intelligence(text,text) to authenticated;

create or replace function public.erp_x_customer_ranking(p_limit integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path=erp_supply,public,auth,pg_catalog
as $$
declare
  v_org uuid:=erp_supply.current_org_id();
  v_limit integer:=greatest(1,least(coalesce(p_limit,30),100));
  v_rows jsonb;
  v_clients bigint:=0;
  v_orders bigint:=0;
  v_mature boolean:=false;
begin
  perform erp_supply.require_profile();

  with order_value as(
    select
      o.id,
      erp_supply.customer_key(o.client_document,o.client_name) customer_key,
      max(o.client_name) over(partition by erp_supply.customer_key(o.client_document,o.client_name)) customer_name,
      max(o.client_document) over(partition by erp_supply.customer_key(o.client_document,o.client_name)) customer_document,
      coalesce((
        select sum(i.amount)
        from erp_supply.invoices i
        where i.order_id=o.id and i.amount is not null and i.amount>0
      ),0)::numeric paid_amount
    from erp_supply.orders o
    where o.organization_id=v_org
      and not coalesce(o.is_test,false)
      and o.status<>'CANCELLED'
  ),
  base as(
    select
      customer_key,
      max(customer_name) customer_name,
      max(customer_document) customer_document,
      count(*)::bigint order_count,
      coalesce(sum(paid_amount),0)::numeric paid_amount
    from order_value
    group by customer_key
  )
  select count(*),coalesce(sum(order_count),0)
  into v_clients,v_orders
  from base;

  v_mature:=v_orders>=20 and v_clients>=5;

  with order_value as(
    select
      o.id,
      erp_supply.customer_key(o.client_document,o.client_name) customer_key,
      o.client_name customer_name,
      o.client_document customer_document,
      coalesce((
        select sum(i.amount)
        from erp_supply.invoices i
        where i.order_id=o.id and i.amount is not null and i.amount>0
      ),0)::numeric paid_amount
    from erp_supply.orders o
    where o.organization_id=v_org
      and not coalesce(o.is_test,false)
      and o.status<>'CANCELLED'
  ),
  base as(
    select
      customer_key,
      max(customer_name) customer_name,
      max(customer_document) customer_document,
      count(*)::bigint order_count,
      coalesce(sum(paid_amount),0)::numeric paid_amount
    from order_value
    group by customer_key
  ),
  ranked as(
    select
      *,
      percent_rank() over(order by order_count)::numeric frequency_rank,
      percent_rank() over(order by paid_amount)::numeric value_rank
    from base
  ),
  scored as(
    select
      *,
      round((50.0*frequency_rank+50.0*value_rank)::numeric,1) score
    from ranked
  ),
  segmented as(
    select
      *,
      case
        when not v_mature or order_count<3 then 'NORMAL'
        when score>=90 then 'URGENT'
        when score>=70 then 'PREMIUM'
        when score>=30 then 'NORMAL'
        else 'BASIC'
      end segment,
      case
        when not v_mature or order_count<3 then 'LEARNING'
        when order_count>=10 then 'HIGH'
        when order_count>=5 then 'MEDIUM'
        else 'LOW'
      end confidence
    from scored
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'customerKey',customer_key,
    'customerName',customer_name,
    'customerDocument',customer_document,
    'orderCount',order_count,
    'paidAmount',paid_amount,
    'frequencyPercentile',round((100*frequency_rank)::numeric,1),
    'valuePercentile',round((100*value_rank)::numeric,1),
    'score',score,
    'segment',segment,
    'confidence',confidence
  ) order by score desc,paid_amount desc,order_count desc),'[]'::jsonb)
  into v_rows
  from (
    select * from segmented
    order by score desc,paid_amount desc,order_count desc
    limit v_limit
  ) q;

  return jsonb_build_object(
    'rows',v_rows,
    'learningActive',v_mature,
    'sampleClients',v_clients,
    'sampleOrders',v_orders,
    'weights',jsonb_build_object('orderCount',0.5,'paidAmount',0.5),
    'version','11.39.0'
  );
end;
$$;

revoke all on function public.erp_x_customer_ranking(integer) from public,anon;
grant execute on function public.erp_x_customer_ranking(integer) to authenticated;

create or replace function erp_supply.freight_estimate_internal(
  p_org uuid,
  p_route text,
  p_department text,
  p_city text,
  p_weight_kg numeric default null,
  p_package_quantity numeric default null,
  p_volume_m3 numeric default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path=erp_supply,public,auth,pg_catalog
as $$
declare
  v_route text:=upper(nullif(trim(coalesce(p_route,'')),''));
  v_department text:=lower(nullif(trim(coalesce(p_department,'')),''));
  v_city text:=lower(nullif(trim(coalesce(p_city,'')),''));
  v_scope text:='ROUTE';
  v_samples integer:=0;
  v_low numeric;
  v_mid numeric;
  v_high numeric;
  v_observed_min numeric;
  v_observed_max numeric;
  v_corr_weight numeric;
  v_corr_packages numeric;
  v_corr_volume numeric;
  v_weight_low numeric;
  v_weight_mid numeric;
  v_weight_high numeric;
  v_package_low numeric;
  v_package_mid numeric;
  v_package_high numeric;
  v_volume_low numeric;
  v_volume_mid numeric;
  v_volume_high numeric;
  v_distance numeric;
  v_transit numeric;
  v_basis text:='ROUTE_HISTORY';
  v_confidence text:='LEARNING';
  v_city_count integer:=0;
  v_department_count integer:=0;
begin
  if v_route is null then
    return jsonb_build_object('available',false,'reason','ROUTE_REQUIRED','version','11.39.0');
  end if;

  with obs as(
    select
      d.carrier_cost::numeric cost,
      lower(trim(o.client_city)) city,
      lower(trim(o.metadata->>'clientDepartment')) department,
      coalesce(inv.weight_kg,erp_supply.safe_numeric(d.metadata#>>'{shippingLearning,weightKg}')) weight_kg,
      coalesce(inv.package_quantity,erp_supply.safe_numeric(d.metadata#>>'{shippingLearning,packageQuantity}')) package_quantity,
      coalesce(inv.volume_m3,erp_supply.safe_numeric(d.metadata#>>'{shippingLearning,volumeM3}')) volume_m3
    from erp_supply.deliveries d
    join erp_supply.orders o on o.id=d.order_id
    left join lateral(
      select
        sum(i.package_weight_kg)::numeric weight_kg,
        sum(i.package_quantity)::numeric package_quantity,
        sum(erp_supply.safe_numeric(i.metadata->>'packageVolumeM3'))::numeric volume_m3
      from erp_supply.invoices i
      where i.order_id=o.id
    ) inv on true
    where o.organization_id=p_org
      and not coalesce(o.is_test,false)
      and upper(d.route_code)=v_route
      and d.carrier_cost is not null
      and d.carrier_cost>0
  )
  select
    count(*) filter(where v_city is not null and city=v_city),
    count(*) filter(where v_department is not null and department=v_department)
  into v_city_count,v_department_count
  from obs;

  if v_city is not null and v_city_count>=2 then
    v_scope:='CITY';
  elsif v_department is not null and v_department_count>=2 then
    v_scope:='DEPARTMENT';
  else
    v_scope:='ROUTE';
  end if;

  with obs as(
    select
      d.carrier_cost::numeric cost,
      d.distance_km::numeric distance_km,
      case
        when d.dispatched_at is not null and d.delivered_at is not null
          then extract(epoch from(d.delivered_at-d.dispatched_at))/3600.0
      end transit_hours,
      lower(trim(o.client_city)) city,
      lower(trim(o.metadata->>'clientDepartment')) department,
      coalesce(inv.weight_kg,erp_supply.safe_numeric(d.metadata#>>'{shippingLearning,weightKg}')) weight_kg,
      coalesce(inv.package_quantity,erp_supply.safe_numeric(d.metadata#>>'{shippingLearning,packageQuantity}')) package_quantity,
      coalesce(inv.volume_m3,erp_supply.safe_numeric(d.metadata#>>'{shippingLearning,volumeM3}')) volume_m3
    from erp_supply.deliveries d
    join erp_supply.orders o on o.id=d.order_id
    left join lateral(
      select
        sum(i.package_weight_kg)::numeric weight_kg,
        sum(i.package_quantity)::numeric package_quantity,
        sum(erp_supply.safe_numeric(i.metadata->>'packageVolumeM3'))::numeric volume_m3
      from erp_supply.invoices i
      where i.order_id=o.id
    ) inv on true
    where o.organization_id=p_org
      and not coalesce(o.is_test,false)
      and upper(d.route_code)=v_route
      and d.carrier_cost is not null
      and d.carrier_cost>0
  ),
  selected as(
    select *
    from obs
    where
      (v_scope='CITY' and city=v_city)
      or (v_scope='DEPARTMENT' and department=v_department)
      or v_scope='ROUTE'
  )
  select
    count(*)::integer,
    percentile_cont(0.25) within group(order by cost),
    percentile_cont(0.50) within group(order by cost),
    percentile_cont(0.75) within group(order by cost),
    min(cost),
    max(cost),
    corr(cost::double precision,weight_kg::double precision) filter(where weight_kg>0),
    corr(cost::double precision,package_quantity::double precision) filter(where package_quantity>0),
    corr(cost::double precision,volume_m3::double precision) filter(where volume_m3>0),
    percentile_cont(0.25) within group(order by cost/nullif(weight_kg,0)) filter(where weight_kg>0),
    percentile_cont(0.50) within group(order by cost/nullif(weight_kg,0)) filter(where weight_kg>0),
    percentile_cont(0.75) within group(order by cost/nullif(weight_kg,0)) filter(where weight_kg>0),
    percentile_cont(0.25) within group(order by cost/nullif(package_quantity,0)) filter(where package_quantity>0),
    percentile_cont(0.50) within group(order by cost/nullif(package_quantity,0)) filter(where package_quantity>0),
    percentile_cont(0.75) within group(order by cost/nullif(package_quantity,0)) filter(where package_quantity>0),
    percentile_cont(0.25) within group(order by cost/nullif(volume_m3,0)) filter(where volume_m3>0),
    percentile_cont(0.50) within group(order by cost/nullif(volume_m3,0)) filter(where volume_m3>0),
    percentile_cont(0.75) within group(order by cost/nullif(volume_m3,0)) filter(where volume_m3>0),
    percentile_cont(0.50) within group(order by distance_km) filter(where distance_km is not null),
    percentile_cont(0.50) within group(order by transit_hours) filter(where transit_hours is not null and transit_hours>=0)
  into
    v_samples,
    v_low,v_mid,v_high,
    v_observed_min,v_observed_max,
    v_corr_weight,v_corr_packages,v_corr_volume,
    v_weight_low,v_weight_mid,v_weight_high,
    v_package_low,v_package_mid,v_package_high,
    v_volume_low,v_volume_mid,v_volume_high,
    v_distance,v_transit
  from selected;

  if v_samples=0 then
    return jsonb_build_object(
      'available',false,
      'reason','NO_HISTORY',
      'route',v_route,
      'city',p_city,
      'department',p_department,
      'samples',0,
      'confidence','LEARNING',
      'version','11.39.0'
    );
  end if;

  if coalesce(abs(v_corr_volume),0)>=0.45
     and coalesce(abs(v_corr_volume),0)>=coalesce(abs(v_corr_weight),0)
     and coalesce(abs(v_corr_volume),0)>=coalesce(abs(v_corr_packages),0) then
    v_basis:='VOLUME';
  elsif coalesce(abs(v_corr_weight),0)>=0.45
     and coalesce(abs(v_corr_weight),0)>=coalesce(abs(v_corr_packages),0) then
    v_basis:='WEIGHT';
  elsif coalesce(abs(v_corr_packages),0)>=0.45 then
    v_basis:='PACKAGE_COUNT';
  else
    v_basis:='ROUTE_HISTORY';
  end if;

  if v_basis='WEIGHT' and coalesce(p_weight_kg,0)>0 and v_weight_mid is not null then
    v_low:=v_weight_low*p_weight_kg;
    v_mid:=v_weight_mid*p_weight_kg;
    v_high:=v_weight_high*p_weight_kg;
  elsif v_basis='PACKAGE_COUNT' and coalesce(p_package_quantity,0)>0 and v_package_mid is not null then
    v_low:=v_package_low*p_package_quantity;
    v_mid:=v_package_mid*p_package_quantity;
    v_high:=v_package_high*p_package_quantity;
  elsif v_basis='VOLUME' and coalesce(p_volume_m3,0)>0 and v_volume_mid is not null then
    v_low:=v_volume_low*p_volume_m3;
    v_mid:=v_volume_mid*p_volume_m3;
    v_high:=v_volume_high*p_volume_m3;
  end if;

  v_confidence:=case
    when v_scope='CITY' and v_samples>=10 then 'HIGH'
    when v_samples>=5 then 'MEDIUM'
    when v_samples>=2 then 'LOW'
    else 'LEARNING'
  end;

  return jsonb_build_object(
    'available',true,
    'route',v_route,
    'city',p_city,
    'department',p_department,
    'scope',v_scope,
    'samples',v_samples,
    'estimateLow',round(coalesce(v_low,v_mid,0),0),
    'estimateMid',round(coalesce(v_mid,v_low,0),0),
    'estimateHigh',round(coalesce(v_high,v_mid,0),0),
    'observedMin',round(coalesce(v_observed_min,0),0),
    'observedMax',round(coalesce(v_observed_max,0),0),
    'basis',v_basis,
    'confidence',v_confidence,
    'correlations',jsonb_build_object(
      'weight',round(coalesce(v_corr_weight,0)::numeric,3),
      'packageCount',round(coalesce(v_corr_packages,0)::numeric,3),
      'volume',round(coalesce(v_corr_volume,0)::numeric,3)
    ),
    'estimatedDistanceKm',case when v_distance is null then null else round(v_distance,1) end,
    'estimatedTransitHours',case when v_transit is null then null else round(v_transit,1) end,
    'version','11.39.0'
  );
end;
$$;

revoke all on function erp_supply.freight_estimate_internal(uuid,text,text,text,numeric,numeric,numeric) from public,anon;

create or replace function public.erp_x_freight_estimate(
  p_route text,
  p_department text default null,
  p_city text default null,
  p_weight_kg numeric default null,
  p_package_quantity numeric default null,
  p_volume_m3 numeric default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path=erp_supply,public,auth,pg_catalog
as $$
declare
  v_org uuid:=erp_supply.current_org_id();
begin
  perform erp_supply.require_profile();
  return erp_supply.freight_estimate_internal(
    v_org,p_route,p_department,p_city,p_weight_kg,p_package_quantity,p_volume_m3
  );
end;
$$;

revoke all on function public.erp_x_freight_estimate(text,text,text,numeric,numeric,numeric) from public,anon;
grant execute on function public.erp_x_freight_estimate(text,text,text,numeric,numeric,numeric) to authenticated;

create or replace function erp_supply.apply_customer_priority_v1139()
returns trigger
language plpgsql
security definer
set search_path=erp_supply,public,auth,pg_catalog
as $$
declare
  v_profile jsonb;
begin
  if coalesce(new.is_test,false) then
    return new;
  end if;

  v_profile:=erp_supply.customer_value_profile(
    new.organization_id,new.client_document,new.client_name,true
  );

  new.priority:=coalesce(v_profile->>'priority','MEDIUM');
  new.metadata:=coalesce(new.metadata,'{}'::jsonb)||jsonb_build_object(
    'customerSegmentAtCreation',coalesce(v_profile->>'segment','NORMAL'),
    'customerScoreAtCreation',coalesce((v_profile->>'score')::numeric,0),
    'customerConfidenceAtCreation',coalesce(v_profile->>'confidence','LEARNING'),
    'customerRankingVersion','11.39.0',
    'prioritySource','CUSTOMER_INTELLIGENCE'
  );
  return new;
end;
$$;

revoke all on function erp_supply.apply_customer_priority_v1139() from public,anon;

drop trigger if exists trg_orders_customer_priority_v1139 on erp_supply.orders;
create trigger trg_orders_customer_priority_v1139
before insert on erp_supply.orders
for each row execute function erp_supply.apply_customer_priority_v1139();

update erp_supply.orders
set priority='MEDIUM',
    metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
      'customerSegmentAtCreation','NORMAL',
      'customerScoreAtCreation',0,
      'customerConfidenceAtCreation','LEARNING',
      'customerRankingVersion','11.39.0',
      'prioritySource','CUSTOMER_INTELLIGENCE'
    )
where not coalesce(is_test,false)
  and not (coalesce(metadata,'{}'::jsonb) ? 'customerSegmentAtCreation');

create or replace function public.erp_x_operational_module_dashboard(
  p_module text,
  p_from date,
  p_to date
)
returns jsonb
language plpgsql
stable
security definer
set search_path=erp_supply,public,auth,pg_catalog
as $$
declare
  v_actor uuid:=erp_supply.require_profile();
  v_org uuid:=erp_supply.current_org_id();
  v_module text:=lower(trim(coalesce(p_module,'')));
  v_from date:=coalesce(p_from,current_date-89);
  v_to date:=coalesce(p_to,current_date);
  v_rows jsonb;
  v_origin_city text:=coalesce(
    (select settings->>'shippingOriginCity' from erp_supply.organizations where id=v_org),
    'Tuluá'
  );
begin
  if v_to<v_from or v_to-v_from>366 then raise exception 'Rango inválido'; end if;
  if v_module not in('billing','shipping','receiving') then raise exception 'Módulo inválido'; end if;
  if not (
    erp_supply.can_access_module(v_module,'read')
    or erp_supply.has_role('super_admin')
    or erp_supply.has_role('auditoria')
  ) then
    raise exception 'No autorizado para consultar estos indicadores' using errcode='42501';
  end if;

  if v_module='billing' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x."invoiceDate" desc,x."invoiceNumber" desc),'[]'::jsonb)
    into v_rows
    from(
      select
        i.id,
        o.order_number "orderNumber",
        o.client_name "clientName",
        i.invoice_number "invoiceNumber",
        i.invoice_date "invoiceDate",
        i.amount,
        i.currency,
        i.package_quantity "packageQuantity",
        i.package_weight_kg "packageWeightKg",
        i.weight_per_unit_kg "weightPerUnitKg",
        f.web_view_link "invoiceWebViewLink",
        f.file_name "invoiceFileName",
        i.created_at "createdAt"
      from erp_supply.invoices i
      join erp_supply.orders o on o.id=i.order_id
      left join erp_supply.drive_files f on f.id=i.drive_file_id
      where o.organization_id=v_org
        and i.invoice_date between v_from and v_to
    ) x;

  elsif v_module='shipping' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x."createdAt" desc),'[]'::jsonb)
    into v_rows
    from(
      select
        d.id,
        o.order_number "orderNumber",
        o.client_name "clientName",
        o.client_city "destinationCity",
        o.metadata->>'clientDepartment' "destinationDepartment",
        v_origin_city "originCity",
        d.carrier,
        d.tracking_number "trackingNumber",
        d.carrier_invoice_number "carrierInvoiceNumber",
        d.carrier_cost "carrierCost",
        d.carrier_cost_currency "currency",
        d.status,
        d.dispatched_at "dispatchedAt",
        d.delivered_at "deliveredAt",
        coalesce(d.distance_km,hist.distance_km) "distanceKm",
        case
          when d.distance_km is not null then 'ACTUAL'
          when hist.distance_km is not null then 'ESTIMATED'
          else 'NONE'
        end "distanceKind",
        case
          when d.dispatched_at is not null and d.delivered_at is not null
            then round((extract(epoch from(d.delivered_at-d.dispatched_at))/3600.0)::numeric,1)
          else hist.transit_hours
        end "transitHours",
        case
          when d.dispatched_at is not null and d.delivered_at is not null then 'ACTUAL'
          when hist.transit_hours is not null then 'ESTIMATED'
          else 'NONE'
        end "transitKind",
        hist.samples "routeSamples",
        d.created_at "createdAt"
      from erp_supply.deliveries d
      join erp_supply.orders o on o.id=d.order_id
      left join lateral(
        select
          percentile_cont(0.50) within group(order by hd.distance_km)
            filter(where hd.distance_km is not null) distance_km,
          round((
            percentile_cont(0.50) within group(
              order by extract(epoch from(hd.delivered_at-hd.dispatched_at))/3600.0
            ) filter(
              where hd.dispatched_at is not null
                and hd.delivered_at is not null
                and hd.delivered_at>=hd.dispatched_at
            )
          )::numeric,1) transit_hours,
          count(*)::integer samples
        from erp_supply.deliveries hd
        join erp_supply.orders ho on ho.id=hd.order_id
        where ho.organization_id=v_org
          and hd.id<>d.id
          and upper(hd.route_code)=upper(d.route_code)
          and lower(trim(ho.client_city))=lower(trim(o.client_city))
      ) hist on true
      where o.organization_id=v_org
        and d.created_at::date between v_from and v_to
    ) x;

  else
    select coalesce(jsonb_agg(to_jsonb(x) order by x."receivedAt" desc),'[]'::jsonb)
    into v_rows
    from(
      select
        r.id,
        o.order_number "orderNumber",
        r.receipt_number "receiptNumber",
        r.receipt_type "receiptType",
        r.document_prefix "documentPrefix",
        r.consecutive_no "consecutiveNo",
        r.supplier_name "supplierName",
        r.status,
        r.novelty_status "noveltyStatus",
        r.novelty_type "noveltyType",
        r.novelty_note "noveltyNote",
        r.barcode_value "barcodeValue",
        r.qr_value "qrValue",
        r.verified_at "verifiedAt",
        vp.display_name "verifiedBy",
        r.verification_note "verificationNote",
        nullif(trim(r.metadata->>'informationCaptured'),'') "informationCaptured",
        r.received_at "receivedAt",
        coalesce((select sum(rl.received_quantity) from erp_supply.receipt_lines rl where rl.receipt_id=r.id),0) "receivedQuantity",
        coalesce((select sum(rl.accepted_quantity) from erp_supply.receipt_lines rl where rl.receipt_id=r.id),0) "acceptedQuantity",
        coalesce((select sum(rl.rejected_quantity) from erp_supply.receipt_lines rl where rl.receipt_id=r.id),0) "rejectedQuantity"
      from erp_supply.receipts r
      join erp_supply.orders o on o.id=r.order_id
      left join erp_supply.profiles vp on vp.id=r.verified_by
      where o.organization_id=v_org
        and coalesce(r.received_at,r.created_at)::date between v_from and v_to
    ) x;
  end if;

  return jsonb_build_object(
    'module',v_module,
    'from',v_from,
    'to',v_to,
    'rows',v_rows,
    'summary',jsonb_build_object(
      'records',jsonb_array_length(v_rows),
      'totalAmount',case when v_module='billing' then
        (select coalesce(sum((e->>'amount')::numeric),0) from jsonb_array_elements(v_rows)e)
        else null end,
      'totalWeightKg',case when v_module='billing' then
        (select coalesce(sum((e->>'packageWeightKg')::numeric),0) from jsonb_array_elements(v_rows)e)
        else null end,
      'totalCarrierCost',case when v_module='shipping' then
        (select coalesce(sum((e->>'carrierCost')::numeric),0) from jsonb_array_elements(v_rows)e)
        else null end,
      'avgDistanceKm',case when v_module='shipping' then
        (select round(avg(nullif(e->>'distanceKm','')::numeric),1) from jsonb_array_elements(v_rows)e)
        else null end,
      'avgTransitHours',case when v_module='shipping' then
        (select round(avg(nullif(e->>'transitHours','')::numeric),1) from jsonb_array_elements(v_rows)e)
        else null end,
      'openNovelties',case when v_module='receiving' then
        (select count(*) from jsonb_array_elements(v_rows)e where e->>'noveltyStatus'='OPEN')
        else null end
    ),
    'originCity',v_origin_city,
    'version','11.39.0'
  );
end;
$$;

revoke all on function public.erp_x_operational_module_dashboard(text,date,date) from public,anon;
grant execute on function public.erp_x_operational_module_dashboard(text,date,date) to authenticated;

comment on function erp_supply.customer_value_profile(uuid,text,text,boolean)
is 'V11.39.0: ranking de cliente 50% frecuencia + 50% valor facturado, con muestra mínima antes de segmentar.';

comment on function public.erp_x_customer_ranking(integer)
is 'V11.39.0: Pareto/ranking comercial dinámico de clientes, sin tabla derivada.';

comment on function erp_supply.freight_estimate_internal(uuid,text,text,text,numeric,numeric,numeric)
is 'V11.39.0: estimador robusto de flete por ruta/destino y señal dominante peso, paquetes, volumen o histórico.';

notify pgrst,'reload schema';
commit;
