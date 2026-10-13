begin;
create or replace function erp_supply.freight_eval_v1141(
  p_org uuid,
  p_from date,
  p_to date
)
returns table(
  order_id uuid,
  order_number text,
  client_name text,
  destination_city text,
  destination_department text,
  requested_delivery_date date,
  order_status text,
  created_at timestamptz,
  delivery_id uuid,
  carrier text,
  tracking_number text,
  carrier_cost numeric,
  dispatched_at timestamptz,
  delivered_at timestamptz,
  weight_kg numeric,
  invoice_amount numeric,
  prediction_version text,
  prediction_mode text,
  predicted_low numeric,
  predicted_mid numeric,
  predicted_high numeric,
  best_predicted_mid numeric,
  cheapest_carrier text,
  predicted_transit_p50_days numeric,
  predicted_transit_p80_days numeric,
  deviation_amount numeric,
  deviation_pct numeric,
  abs_error_pct numeric,
  potential_savings numeric,
  cost_per_kg numeric,
  logistics_pct_of_sale numeric,
  anomaly_level text,
  anomaly_reason text,
  delivery_risk text,
  estimated_arrival_p80 date,
  evaluation_eligible boolean
)
language sql
stable
security definer
set search_path=erp_supply,public,auth,pg_catalog
as $$
with base as(
  select
    o.id order_id,o.order_number,o.client_name,o.client_city destination_city,
    nullif(o.metadata->>'clientDepartment','') destination_department,
    o.requested_delivery_date,o.status order_status,o.created_at,
    d.id delivery_id,upper(trim(coalesce(d.carrier,''))) carrier,d.tracking_number,
    d.carrier_cost,d.dispatched_at,d.delivered_at,
    erp_supply.order_estimated_weight_v1141(o.id) weight_kg,
    coalesce((select sum(i.amount) from erp_supply.invoices i where i.order_id=o.id),0)::numeric invoice_amount,
    coalesce(fq.snapshot->'prediction',o.metadata->'freightPredictionAtCreation') prediction,
    coalesce(fq.snapshot#>>'{prediction,version}',o.metadata->>'freightPredictionVersion') prediction_version_meta
  from erp_supply.orders o
  left join lateral(
    select d.*
    from erp_supply.deliveries d
    where d.order_id=o.id
    order by d.updated_at desc,d.created_at desc
    limit 1
  ) d on true
  left join lateral(
    select q.snapshot from erp_supply.freight_quotes q
    where q.order_id=o.id and q.organization_id=o.organization_id and q.status='CALCULATED'
      and q.snapshot#>>'{prediction,available}'='true'
      and q.created_at<=coalesce(d.dispatched_at,now())
      and q.updated_at<=coalesce(d.dispatched_at,now())
    order by q.created_at,q.id limit 1
  ) fq on true
  where o.organization_id=p_org
    and not coalesce(o.is_test,false)
    and o.delivery_route_code='NATIONAL_DISPATCH'
    and o.created_at::date between coalesce(p_from,current_date-365) and coalesce(p_to,current_date)
),
pred as(
  select b.*,
    coalesce(b.prediction->>'version',b.prediction_version_meta) prediction_version,
    b.prediction->>'mode' prediction_mode,
    b.prediction->>'cheapestCarrier' cheapest_carrier,
    actual_pred.item actual_pred,
    best_pred.item best_pred
  from base b
  left join lateral(
    select e item
    from jsonb_array_elements(coalesce(b.prediction->'carriers','[]'::jsonb)) e
    where erp_supply.freight_norm_v1140(e->>'carrier')=erp_supply.freight_norm_v1140(b.carrier)
    limit 1
  ) actual_pred on true
  left join lateral(
    select e item
    from jsonb_array_elements(coalesce(b.prediction->'carriers','[]'::jsonb)) e
    order by erp_supply.safe_numeric(e->>'estimateMid') nulls last
    limit 1
  ) best_pred on true
),
calc as(
  select p.*,
    erp_supply.safe_numeric(p.actual_pred->>'estimateLow') predicted_low,
    erp_supply.safe_numeric(p.actual_pred->>'estimateMid') predicted_mid,
    erp_supply.safe_numeric(p.actual_pred->>'estimateHigh') predicted_high,
    erp_supply.safe_numeric(p.best_pred->>'estimateMid') best_predicted_mid,
    erp_supply.safe_numeric(p.actual_pred#>>'{transit,medianDays}') predicted_transit_p50_days,
    erp_supply.safe_numeric(p.actual_pred#>>'{transit,p80Days}') predicted_transit_p80_days
  from pred p
)
select
  c.order_id,c.order_number,c.client_name,c.destination_city,c.destination_department,
  c.requested_delivery_date,c.order_status,c.created_at,c.delivery_id,c.carrier,c.tracking_number,
  c.carrier_cost,c.dispatched_at,c.delivered_at,c.weight_kg,c.invoice_amount,
  c.prediction_version,c.prediction_mode,
  c.predicted_low,c.predicted_mid,c.predicted_high,c.best_predicted_mid,c.cheapest_carrier,
  c.predicted_transit_p50_days,c.predicted_transit_p80_days,
  case when c.carrier_cost is not null and c.predicted_mid>0 then round(c.carrier_cost-c.predicted_mid,0) end deviation_amount,
  case when c.carrier_cost is not null and c.predicted_mid>0 then round(100*(c.carrier_cost-c.predicted_mid)/c.predicted_mid,1) end deviation_pct,
  case when c.carrier_cost is not null and c.predicted_mid>0 then round(100*abs(c.carrier_cost-c.predicted_mid)/c.predicted_mid,1) end abs_error_pct,
  case when c.carrier_cost is not null and c.best_predicted_mid>0 then greatest(round(c.carrier_cost-c.best_predicted_mid,0),0) end potential_savings,
  case when c.carrier_cost is not null and c.weight_kg>0 then round(c.carrier_cost/c.weight_kg,0) end cost_per_kg,
  case when c.carrier_cost is not null and c.invoice_amount>0 then round(100*c.carrier_cost/c.invoice_amount,2) end logistics_pct_of_sale,
  case
    when c.carrier_cost is null or c.predicted_mid is null then 'NONE'
    when c.carrier_cost>greatest(coalesce(c.predicted_high,c.predicted_mid)*1.25,c.predicted_mid*1.50) then 'CRITICAL'
    when c.carrier_cost>coalesce(c.predicted_high,c.predicted_mid) or c.carrier_cost>c.predicted_mid*1.25 then 'HIGH'
    when c.carrier_cost<c.predicted_low then 'FAVORABLE'
    else 'NORMAL'
  end anomaly_level,
  case
    when c.carrier_cost is null or c.predicted_mid is null then null
    when c.carrier_cost>greatest(coalesce(c.predicted_high,c.predicted_mid)*1.25,c.predicted_mid*1.50) then 'Costo real muy superior al rango histórico'
    when c.carrier_cost>coalesce(c.predicted_high,c.predicted_mid) then 'Costo real superior al rango esperado'
    when c.carrier_cost>c.predicted_mid*1.25 then 'Desviación superior al 25% frente al valor central'
    when c.carrier_cost<c.predicted_low then 'Costo real favorable frente al rango'
    else 'Dentro del rango esperado'
  end anomaly_reason,
  case
    when c.requested_delivery_date is null then 'NO_DATE'
    when c.delivered_at is not null and c.delivered_at::date>c.requested_delivery_date then 'LATE'
    when c.delivered_at is not null then 'ON_TIME'
    when c.dispatched_at is not null
      and coalesce(c.predicted_transit_p80_days,c.predicted_transit_p50_days) is not null
      and (c.dispatched_at + make_interval(secs => round(86400*coalesce(c.predicted_transit_p80_days,c.predicted_transit_p50_days))::int))::date>c.requested_delivery_date
      then 'AT_RISK'
    when c.dispatched_at is null
      and coalesce(c.predicted_transit_p80_days,c.predicted_transit_p50_days) is not null
      and (current_date + ceil(coalesce(c.predicted_transit_p80_days,c.predicted_transit_p50_days))::int)>=c.requested_delivery_date
      then 'AT_RISK'
    else 'ON_TRACK'
  end delivery_risk,
  case
    when c.dispatched_at is not null and coalesce(c.predicted_transit_p80_days,c.predicted_transit_p50_days) is not null
      then (c.dispatched_at + make_interval(secs => round(86400*coalesce(c.predicted_transit_p80_days,c.predicted_transit_p50_days))::int))::date
    when c.dispatched_at is null and coalesce(c.predicted_transit_p80_days,c.predicted_transit_p50_days) is not null
      then current_date+ceil(coalesce(c.predicted_transit_p80_days,c.predicted_transit_p50_days))::int
  end estimated_arrival_p80,
  (c.carrier_cost is not null and c.predicted_mid is not null and c.predicted_mid>0 and c.actual_pred is not null) evaluation_eligible
from calc c
$$;
revoke all on function erp_supply.freight_eval_v1141(uuid,date,date) from public,anon,authenticated;
commit;
