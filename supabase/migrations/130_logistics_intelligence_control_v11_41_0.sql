-- CRM SUMINISTROS V11.41.0
-- Control integral de inteligencia logística:
-- predicho vs real, anomalías, ahorro potencial, precisión, ETA/riesgo, costo/kg,
-- costo logístico por cliente y presupuesto de fletes pendientes.
begin;

create or replace function erp_supply.order_estimated_weight_v1141(p_order_id uuid)
returns numeric
language sql
stable
security definer
set search_path=erp_supply,public,auth,pg_catalog
as $$
  select coalesce(
    erp_supply.safe_numeric(o.metadata->>'estimatedMaterialWeightKg'),
    (
      select sum(
        coalesce(m.weight,0) *
        case when coalesce(oi.requires_cut,false)
             then coalesce(oi.quantity,0)*coalesce(oi.requested_cut_length,0)
             else coalesce(oi.quantity,0)
        end
      )
      from erp_supply.order_items oi
      join erp_supply.material_master m on m.id=oi.material_master_id
      where oi.order_id=o.id
    ),
    0
  )::numeric
  from erp_supply.orders o
  where o.id=p_order_id
$$;
revoke all on function erp_supply.order_estimated_weight_v1141(uuid) from public,anon,authenticated;

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
    o.metadata->'freightPredictionAtCreation' prediction,
    o.metadata->>'freightPredictionVersion' prediction_version_meta
  from erp_supply.orders o
  left join lateral(
    select d.*
    from erp_supply.deliveries d
    where d.order_id=o.id
    order by d.updated_at desc,d.created_at desc
    limit 1
  ) d on true
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

create or replace function public.erp_x_freight_intelligence_dashboard(
  p_from date default null,
  p_to date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path=erp_supply,public,auth,pg_catalog
as $$
declare
  v_org uuid:=erp_supply.current_org_id();
  v_from date:=coalesce(p_from,current_date-89);
  v_to date:=coalesce(p_to,current_date);
  v_summary jsonb;
  v_rows jsonb;
  v_monthly jsonb;
  v_carriers jsonb;
  v_destinations jsonb;
  v_clients jsonb;
  v_budget jsonb;
  v_alerts jsonb;
begin
  perform erp_supply.require_profile();
  if v_to<v_from or v_to-v_from>730 then raise exception 'Rango inválido'; end if;
  if not (
    erp_supply.can_access_module('shipping','read')
    or erp_supply.can_access_module('reports','read')
    or erp_supply.has_role('super_admin')
    or erp_supply.has_role('gerencia')
    or erp_supply.has_role('auditoria')
    or erp_supply.has_role('jefe_logistica')
    or erp_supply.has_role('lider_logistica')
    or erp_supply.has_role('coordinador_logistico')
  ) then raise exception 'No autorizado para inteligencia logística' using errcode='42501'; end if;

  with e as(select * from erp_supply.freight_eval_v1141(v_org,v_from,v_to))
  select jsonb_build_object(
    'nationalOrders',count(*),
    'actualCostRecords',count(*) filter(where carrier_cost is not null),
    'evaluatedPredictions',count(*) filter(where evaluation_eligible),
    'actualCarrierCost',coalesce(sum(carrier_cost),0),
    'predictedCost',coalesce(sum(predicted_mid) filter(where evaluation_eligible),0),
    'medianAbsErrorPct',round((percentile_cont(.5) within group(order by abs_error_pct) filter(where evaluation_eligible))::numeric,1),
    'within25Pct',round(100.0*count(*) filter(where evaluation_eligible and abs_error_pct<=25)/nullif(count(*) filter(where evaluation_eligible),0),1),
    'within50Pct',round(100.0*count(*) filter(where evaluation_eligible and abs_error_pct<=50)/nullif(count(*) filter(where evaluation_eligible),0),1),
    'potentialSavings',coalesce(sum(potential_savings) filter(where evaluation_eligible),0),
    'anomalies',count(*) filter(where anomaly_level in('HIGH','CRITICAL')),
    'criticalAnomalies',count(*) filter(where anomaly_level='CRITICAL'),
    'atRiskDeliveries',count(*) filter(where delivery_risk in('AT_RISK','LATE')),
    'avgLogisticsPctOfSale',round(avg(logistics_pct_of_sale) filter(where logistics_pct_of_sale is not null),2)
  ) into v_summary from e;

  with e as(select * from erp_supply.freight_eval_v1141(v_org,v_from,v_to))
  select coalesce(jsonb_agg(to_jsonb(x) order by x."createdAt" desc),'[]'::jsonb) into v_rows
  from(
    select order_id "orderId",order_number "orderNumber",client_name "clientName",
      destination_city "destinationCity",destination_department "destinationDepartment",
      requested_delivery_date "requestedDeliveryDate",carrier,tracking_number "trackingNumber",
      carrier_cost "actualCost",weight_kg "weightKg",invoice_amount "invoiceAmount",
      prediction_version "predictionVersion",prediction_mode "predictionMode",
      predicted_low "predictedLow",predicted_mid "predictedMid",predicted_high "predictedHigh",
      best_predicted_mid "bestPredictedMid",cheapest_carrier "cheapestCarrier",
      deviation_amount "deviationAmount",deviation_pct "deviationPct",abs_error_pct "absErrorPct",
      potential_savings "potentialSavings",cost_per_kg "costPerKg",
      logistics_pct_of_sale "logisticsPctOfSale",anomaly_level "anomalyLevel",
      anomaly_reason "anomalyReason",delivery_risk "deliveryRisk",
      estimated_arrival_p80 "estimatedArrivalP80",dispatched_at "dispatchedAt",
      delivered_at "deliveredAt",evaluation_eligible "evaluationEligible",created_at "createdAt"
    from e
    order by
      case anomaly_level when 'CRITICAL' then 1 when 'HIGH' then 2 when 'FAVORABLE' then 4 else 3 end,
      created_at desc
    limit 120
  )x;

  with e as(select * from erp_supply.freight_eval_v1141(v_org,v_from,v_to)),
  g as(
    select date_trunc('month',created_at)::date month_start,
      count(*) filter(where evaluation_eligible) evaluated,
      round((percentile_cont(.5) within group(order by abs_error_pct) filter(where evaluation_eligible))::numeric,1) mape50,
      round(100.0*count(*) filter(where evaluation_eligible and abs_error_pct<=25)/nullif(count(*) filter(where evaluation_eligible),0),1) within25,
      coalesce(sum(carrier_cost),0) actual_cost,
      coalesce(sum(potential_savings),0) potential_savings
    from e group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'month',month_start,'evaluated',evaluated,'medianAbsErrorPct',mape50,'within25Pct',within25,
    'actualCost',actual_cost,'potentialSavings',potential_savings
  ) order by month_start),'[]'::jsonb) into v_monthly from g;

  with e as(select * from erp_supply.freight_eval_v1141(v_org,v_from,v_to)),
  g as(
    select carrier,count(*) shipments,count(*) filter(where evaluation_eligible) evaluated,
      coalesce(sum(carrier_cost),0) actual_cost,
      round(avg(deviation_pct) filter(where evaluation_eligible),1) avg_deviation_pct,
      round((percentile_cont(.5) within group(order by abs_error_pct) filter(where evaluation_eligible))::numeric,1) median_abs_error_pct,
      coalesce(sum(potential_savings),0) potential_savings,
      round(100.0*count(*) filter(where delivery_risk='ON_TIME')/nullif(count(*) filter(where delivery_risk in('ON_TIME','LATE')),0),1) on_time_pct
    from e where nullif(carrier,'') is not null group by carrier
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'carrier',carrier,'shipments',shipments,'evaluated',evaluated,'actualCost',actual_cost,
    'avgDeviationPct',avg_deviation_pct,'medianAbsErrorPct',median_abs_error_pct,
    'potentialSavings',potential_savings,'onTimePct',on_time_pct
  ) order by actual_cost desc),'[]'::jsonb) into v_carriers from g;

  with e as(select * from erp_supply.freight_eval_v1141(v_org,v_from,v_to)),
  g as(
    select destination_city city,destination_department department,count(*) shipments,
      coalesce(sum(carrier_cost),0) actual_cost,
      round(avg(cost_per_kg) filter(where cost_per_kg is not null),0) avg_cost_per_kg,
      round(avg(logistics_pct_of_sale) filter(where logistics_pct_of_sale is not null),2) avg_logistics_pct
    from e group by destination_city,destination_department
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'city',city,'department',department,'shipments',shipments,'actualCost',actual_cost,
    'avgCostPerKg',avg_cost_per_kg,'avgLogisticsPctOfSale',avg_logistics_pct
  ) order by actual_cost desc),'[]'::jsonb) into v_destinations from(select * from g order by actual_cost desc limit 20)x;

  with e as(select * from erp_supply.freight_eval_v1141(v_org,v_from,v_to)),
  g as(
    select client_name,count(*) shipments,coalesce(sum(carrier_cost),0) logistics_cost,
      coalesce(sum(invoice_amount),0) invoice_amount,
      round(100*coalesce(sum(carrier_cost),0)/nullif(coalesce(sum(invoice_amount),0),0),2) logistics_pct,
      coalesce(sum(potential_savings),0) potential_savings
    from e group by client_name
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'clientName',client_name,'shipments',shipments,'logisticsCost',logistics_cost,
    'invoiceAmount',invoice_amount,'logisticsPct',logistics_pct,'potentialSavings',potential_savings
  ) order by logistics_cost desc),'[]'::jsonb) into v_clients from(select * from g order by logistics_cost desc limit 20)x;

  with active as(
    select o.id,o.order_number,o.client_name,o.client_city,
      o.metadata->'freightPredictionAtCreation' prediction,
      erp_supply.order_estimated_weight_v1141(o.id) weight_kg
    from erp_supply.orders o
    where o.organization_id=v_org and not coalesce(o.is_test,false)
      and o.delivery_route_code='NATIONAL_DISPATCH'
      and o.status not in('CLOSED','CANCELLED')
      and not exists(select 1 from erp_supply.deliveries d where d.order_id=o.id and d.carrier_cost is not null)
  ), est as(
    select a.*,
      erp_supply.safe_numeric(best.item->>'estimateLow') low,
      erp_supply.safe_numeric(best.item->>'estimateMid') mid,
      erp_supply.safe_numeric(best.item->>'estimateHigh') high,
      best.item->>'carrier' carrier
    from active a
    left join lateral(
      select e item from jsonb_array_elements(coalesce(a.prediction->'carriers','[]'::jsonb))e
      order by erp_supply.safe_numeric(e->>'estimateMid') nulls last limit 1
    )best on true
  )
  select jsonb_build_object(
    'orders',count(*) filter(where mid is not null),
    'expectedLow',coalesce(sum(low),0),'expectedMid',coalesce(sum(mid),0),'expectedHigh',coalesce(sum(high),0),
    'items',coalesce(jsonb_agg(jsonb_build_object(
      'orderId',id,'orderNumber',order_number,'clientName',client_name,'city',client_city,
      'weightKg',weight_kg,'carrier',carrier,'estimateLow',low,'estimateMid',mid,'estimateHigh',high
    ) order by mid desc) filter(where mid is not null),'[]'::jsonb)
  ) into v_budget from est;

  with e as(select * from erp_supply.freight_eval_v1141(v_org,v_from,v_to))
  select coalesce(jsonb_agg(jsonb_build_object(
    'orderId',order_id,'orderNumber',order_number,'clientName',client_name,'carrier',carrier,
    'actualCost',carrier_cost,'predictedMid',predicted_mid,'predictedHigh',predicted_high,
    'deviationPct',deviation_pct,'potentialSavings',potential_savings,
    'anomalyLevel',anomaly_level,'anomalyReason',anomaly_reason,
    'deliveryRisk',delivery_risk,'requestedDeliveryDate',requested_delivery_date,
    'estimatedArrivalP80',estimated_arrival_p80
  ) order by case anomaly_level when 'CRITICAL' then 1 when 'HIGH' then 2 else 3 end,
    abs(coalesce(deviation_pct,0)) desc),'[]'::jsonb)
  into v_alerts
  from(select * from e
    where anomaly_level in('HIGH','CRITICAL') or delivery_risk in('AT_RISK','LATE')
    order by created_at desc limit 30)x;

  return jsonb_build_object(
    'from',v_from,'to',v_to,'summary',coalesce(v_summary,'{}'::jsonb),
    'rows',coalesce(v_rows,'[]'::jsonb),'monthly',coalesce(v_monthly,'[]'::jsonb),
    'carriers',coalesce(v_carriers,'[]'::jsonb),'destinations',coalesce(v_destinations,'[]'::jsonb),
    'clients',coalesce(v_clients,'[]'::jsonb),'budget',coalesce(v_budget,'{}'::jsonb),
    'alerts',coalesce(v_alerts,'[]'::jsonb),'version','11.41.0'
  );
end;
$$;
revoke all on function public.erp_x_freight_intelligence_dashboard(date,date) from public,anon;
grant execute on function public.erp_x_freight_intelligence_dashboard(date,date) to authenticated;

create or replace function public.erp_x_freight_alerts(p_limit integer default 12)
returns jsonb
language plpgsql
stable
security definer
set search_path=erp_supply,public,auth,pg_catalog
as $$
declare
  v_org uuid:=erp_supply.current_org_id();
  v_limit int:=greatest(1,least(coalesce(p_limit,12),50));
  v_rows jsonb;
begin
  perform erp_supply.require_profile();
  if not (
    erp_supply.can_access_module('shipping','read')
    or erp_supply.has_role('super_admin')
    or erp_supply.has_role('gerencia')
    or erp_supply.has_role('jefe_logistica')
    or erp_supply.has_role('lider_logistica')
    or erp_supply.has_role('coordinador_logistico')
  ) then return jsonb_build_object('alerts','[]'::jsonb,'version','11.41.0'); end if;

  with e as(
    select * from erp_supply.freight_eval_v1141(v_org,current_date-120,current_date)
  ), a as(
    select * from e
    where anomaly_level in('HIGH','CRITICAL') or delivery_risk in('AT_RISK','LATE')
    order by
      case anomaly_level when 'CRITICAL' then 1 when 'HIGH' then 2 else 3 end,
      created_at desc
    limit v_limit
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'orderId',order_id,'orderNumber',order_number,'clientName',client_name,'carrier',carrier,
    'actualCost',carrier_cost,'predictedMid',predicted_mid,'predictedHigh',predicted_high,
    'deviationPct',deviation_pct,'potentialSavings',potential_savings,
    'anomalyLevel',anomaly_level,'anomalyReason',anomaly_reason,
    'deliveryRisk',delivery_risk,'requestedDeliveryDate',requested_delivery_date,
    'estimatedArrivalP80',estimated_arrival_p80
  )),'[]'::jsonb) into v_rows from a;
  return jsonb_build_object('alerts',v_rows,'version','11.41.0');
end;
$$;
revoke all on function public.erp_x_freight_alerts(integer) from public,anon;
grant execute on function public.erp_x_freight_alerts(integer) to authenticated;

comment on function public.erp_x_freight_intelligence_dashboard(date,date)
is 'V11.41.0: tablero predicho-vs-real, ahorro potencial, precisión, riesgo, costo/kg, cliente y presupuesto.';
comment on function public.erp_x_freight_alerts(integer)
is 'V11.41.0: alertas acotadas para PACO sobre fletes anómalos y entregas en riesgo.';

notify pgrst,'reload schema';
commit;
