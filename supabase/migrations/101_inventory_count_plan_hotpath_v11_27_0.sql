-- CRM Suministros V11.27.0 · Auditoría de rendimiento de conteo cíclico
-- Evita materializar JSON detallado de todos los lotes antes de seleccionar el plan diario.
-- El detalle de lotes se construye únicamente para los materiales finalmente seleccionados (máx. 30).

create or replace function public.erp_x_inventory_count_plan(p_day date default null::date)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_org uuid:=erp_supply.current_org_id();
  v_tz text:='America/Bogota';
  v_day date;
  v_year_start date;
  v_year_end date;
  v_workdays integer:=1;
  v_controller boolean:=erp_supply.inventory_count_is_controller();
  v_vsm jsonb:=null;
begin
  perform erp_supply.require_profile();
  if not erp_supply.can_access_module('inventory','read') and not erp_supply.has_role('super_admin') then
    raise exception 'No autorizado para consultar el plan de inventario' using errcode='42501';
  end if;
  select coalesce(o.timezone,'America/Bogota') into v_tz from erp_supply.organizations o where o.id=v_org;
  v_day:=coalesce(p_day,(now() at time zone v_tz)::date);
  v_year_start:=date_trunc('year',v_day)::date;
  v_year_end:=(date_trunc('year',v_day)+interval '1 year - 1 day')::date;

  select greatest(count(*)::integer,1) into v_workdays
  from generate_series(v_day,v_year_end,'1 day'::interval) d
  where extract(isodow from d)::integer between 1 and 5;

  if v_controller and erp_supply.can_access_module('vsm','read') then
    begin v_vsm:=public.erp_x_vsm(greatest(v_year_start,v_day-29),v_day); exception when others then v_vsm:=null; end;
  end if;

  return (
    with lot_agg as (
      select i.id item_id,i.material_master_id,m.reference,m.exact_name description,m.unit,i.item_type,
        count(l.id)::integer lot_count,
        coalesce(sum(coalesce(erp_supply.safe_numeric(l.metadata->>'physicalExistence'),l.quantity_available+l.quantity_reserved+l.quantity_blocked)),0)::numeric source_physical,
        coalesce(sum(l.quantity_available+l.quantity_reserved+l.quantity_blocked),0)::numeric operational_physical,
        coalesce(sum(l.quantity_available),0)::numeric available,
        coalesce(sum(l.quantity_reserved),0)::numeric committed,
        coalesce(sum(l.quantity_blocked),0)::numeric blocked,
        coalesce(sum(coalesce(erp_supply.safe_numeric(l.metadata->>'lastCostTotal'),erp_supply.safe_numeric(l.metadata->>'averageCostTotal'),coalesce(erp_supply.safe_numeric(l.metadata->>'physicalExistence'),0)*coalesce(erp_supply.safe_numeric(l.metadata->>'lastCostUnit'),erp_supply.safe_numeric(l.metadata->>'averageCostUnit'),0))),0)::numeric inventory_value,
        coalesce(sum(coalesce(erp_supply.safe_numeric(l.metadata->>'averageConsumption'),0)),0)::numeric average_consumption,
        min(nullif(upper(trim(l.metadata->>'abcCost')),'')) abc_cost,
        min(nullif(upper(trim(l.metadata->>'abcTurns')),'')) abc_turns,
        coalesce(array_remove(array_agg(distinct nullif(trim(l.warehouse_code),'')),null),'{}'::text[]) warehouses
      from erp_supply.inventory_items i
      join erp_supply.material_master m on m.id=i.material_master_id and m.active
      join erp_supply.inventory_lots l on l.inventory_item_id=i.id and l.source_active
      where i.organization_id=v_org and i.active
      group by i.id,m.id
    ),
    movements as (
      select im.inventory_item_id item_id,
        count(*) filter(where im.created_at>=v_day::timestamp-interval '365 day' and coalesce(im.metadata->>'source','') not in('CYCLIC_COUNT','PHYSICAL_COUNT','INVENTORY_COUNT_APPROVED'))::integer events,
        coalesce(sum(im.quantity) filter(where im.created_at>=v_day::timestamp-interval '365 day' and im.movement_type in('ISSUE','ADJUSTMENT_OUT','SCRAP','TRANSFER_OUT') and coalesce(im.metadata->>'source','') not in('CYCLIC_COUNT','PHYSICAL_COUNT','INVENTORY_COUNT_APPROVED')),0)::numeric outgoing,
        coalesce(stddev_pop(im.quantity) filter(where im.created_at>=v_day::timestamp-interval '365 day' and coalesce(im.metadata->>'source','') not in('CYCLIC_COUNT','PHYSICAL_COUNT','INVENTORY_COUNT_APPROVED')),0)::numeric variability
      from erp_supply.inventory_movements im where im.organization_id=v_org group by im.inventory_item_id
    ),
    demand as (
      select oi.material_master_id,count(distinct o.id)::integer orders,coalesce(sum(oi.quantity),0)::numeric qty
      from erp_supply.order_items oi join erp_supply.orders o on o.id=oi.order_id
      where o.organization_id=v_org and not o.is_test and o.status<>'CANCELLED' and oi.material_master_id is not null and o.created_at>=v_day::timestamp-interval '365 day'
      group by oi.material_master_id
    ),
    count_history as (
      select r.inventory_item_id,
        count(*) filter(where r.status='APPLIED' and r.scheduled_date between v_year_start and v_day)::integer approved_year,
        max(r.applied_at) filter(where r.status='APPLIED') last_count_at,
        coalesce(sum(r.exact_lots) filter(where r.status='APPLIED' and r.scheduled_date between v_year_start and v_day),0)::integer exact_lots,
        coalesce(sum(r.difference_lots) filter(where r.status='APPLIED' and r.scheduled_date between v_year_start and v_day),0)::integer difference_lots,
        coalesce(sum(r.absolute_difference) filter(where r.status='APPLIED' and r.scheduled_date between v_year_start and v_day),0)::numeric abs_difference
      from erp_supply.inventory_count_reports r where r.organization_id=v_org group by r.inventory_item_id
    ),
    base as (
      select l.*,
        coalesce(mv.events,0) movement_events,coalesce(mv.outgoing,0) outgoing_qty,coalesce(mv.variability,0) movement_variability,
        coalesce(d.orders,0) demand_orders,coalesce(d.qty,0) demand_qty,
        coalesce(ch.approved_year,0) approved_year,ch.last_count_at,coalesce(ch.exact_lots,0) exact_lots,coalesce(ch.difference_lots,0) difference_lots,coalesce(ch.abs_difference,0) abs_difference,
        abs(l.operational_physical-l.source_physical)::numeric stock_gap_abs,
        case coalesce(l.abc_cost,'') when 'A' then 100 when 'B' then 65 when 'C' then 30 else 10 end::numeric abc_cost_score,
        case coalesce(l.abc_turns,'') when 'A' then 100 when 'B' then 65 when 'C' then 30 else 10 end::numeric abc_turn_score,
        case when ch.last_count_at is null then 366 else greatest(0,v_day-(ch.last_count_at at time zone v_tz)::date) end::integer days_since_count
      from lot_agg l left join movements mv on mv.item_id=l.item_id left join demand d on d.material_master_id=l.material_master_id left join count_history ch on ch.inventory_item_id=l.item_id
    ),
    normalized as (
      select b.*,
        percent_rank() over(order by b.inventory_value)::numeric*100 value_score,
        percent_rank() over(order by b.average_consumption)::numeric*100 consumption_score,
        percent_rank() over(order by (b.outgoing_qty+b.demand_qty))::numeric*100 activity_score,
        percent_rank() over(order by b.movement_variability)::numeric*100 variability_score,
        percent_rank() over(order by b.stock_gap_abs)::numeric*100 gap_score
      from base b
    ),
    scored0 as (
      select n.*,round((n.abc_turn_score*.25+n.abc_cost_score*.22+n.value_score*.17+n.consumption_score*.12+n.activity_score*.10+n.gap_score*.08+n.variability_score*.04+least(n.days_since_count,366)::numeric/366*100*.02)::numeric,2) business_score
      from normalized n
    ),
    scored as (
      select s.*,percent_rank() over(order by s.business_score)::numeric percentile,
        (((pg_catalog.hashtext(s.reference||'|'||v_day::text)::bigint+2147483648)%10000)::numeric/100) seeded_random
      from scored0 s
    ),
    classified as (
      select s.*,
        case when percentile>=.95 then 'A+' when percentile>=.80 then 'A' when percentile>=.55 then 'B' when percentile>=.30 then 'C' when percentile>=.10 then 'D' else 'E' end pareto_band,
        round((seeded_random*.45+percentile*100*.40+least(days_since_count,366)::numeric/366*100*.15)::numeric,2) selection_rank
      from scored s
    ),
    stats as (
      select count(*)::integer total_materials,count(*) filter(where approved_year>0)::integer counted_year,count(*) filter(where approved_year=0)::integer pending_year,
        coalesce(sum(exact_lots),0)::integer exact_lots,coalesce(sum(difference_lots),0)::integer difference_lots,
        count(*) filter(where stock_gap_abs>.0001)::integer gap_materials,count(*) filter(where blocked>0)::integer blocked_materials,
        round(coalesce(sum(inventory_value),0),2) inventory_value,coalesce(sum(movement_events),0)::integer movement_events,coalesce(sum(demand_orders),0)::integer demand_orders,
        count(*) filter(where abc_cost in('A','B','C') and abc_turns in('A','B','C'))::integer abc_covered
      from classified
    ),
    targets as (
      select st.*,least(30,case when st.pending_year=0 then 0 else greatest(1,ceil(st.pending_year::numeric/v_workdays)::integer) end) target_today,
        case when st.exact_lots+st.difference_lots=0 then null else round(st.exact_lots::numeric/(st.exact_lots+st.difference_lots)*100,1) end exactness_pct
      from stats st
    ),
    selected as (
      select c.* from classified c
      where c.approved_year=0
        and not exists(select 1 from erp_supply.inventory_count_reports r where r.organization_id=v_org and r.inventory_item_id=c.item_id and r.status in('SUBMITTED','RECOUNT_REQUIRED'))
      order by c.selection_rank desc,c.reference
      limit (select target_today from targets)
    ),
    bands as (
      select pareto_band,count(*)::integer materials,count(*) filter(where approved_year>0)::integer counted,count(*) filter(where approved_year=0)::integer pending,round(avg(business_score),1) avg_score
      from classified group by pareto_band
    )
    select jsonb_build_object(
      'day',v_day,
      'engine',jsonb_build_object('version','11.27.0','mode','SIESA_CRM_ACCOUNTING','selection','deterministic_weighted_random','annualNoRepeat',true,'dailyCap',30,'workdaysRemaining',v_workdays),
      'summary',(select jsonb_build_object('totalMaterials',t.total_materials,'countedYear',t.counted_year,'pendingYear',t.pending_year,'coveragePct',case when t.total_materials=0 then 0 else round(t.counted_year::numeric/t.total_materials*100,1) end,'targetToday',t.target_today,'exactnessPct',t.exactness_pct,'exactEvents',t.exact_lots,'differenceEvents',t.difference_lots) from targets t),
      'plan',coalesce((select jsonb_agg(jsonb_build_object(
        'itemId',s.item_id,'materialMasterId',s.material_master_id,'reference',s.reference,'description',s.description,'unit',s.unit,'itemType',s.item_type,
        'warehouses',to_jsonb(s.warehouses),'lotCount',s.lot_count,
        'lots',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'lotNumber',l.lot_number,'serialNumber',l.serial_number,'location',l.location,'warehouseCode',l.warehouse_code,'locationName',l.source_location_name,'variantLabel',mv.variant_label,'scanCode',l.scan_code) order by l.warehouse_code,l.location,l.lot_number,l.id)
          from erp_supply.inventory_lots l left join erp_supply.material_variants mv on mv.id=l.material_variant_id
          where l.inventory_item_id=s.item_id and l.source_active),'[]'::jsonb),
        'paretoBand',s.pareto_band,'businessScore',s.business_score,'selectionRank',s.selection_rank,'abcCost',s.abc_cost,'abcTurns',s.abc_turns,'lastCountAt',s.last_count_at,'daysSinceCount',s.days_since_count
      ) order by s.selection_rank desc,s.reference) from selected s),'[]'::jsonb),
      'bands',coalesce((select jsonb_agg(jsonb_build_object('band',b.pareto_band,'materials',b.materials,'counted',b.counted,'pending',b.pending,'avgScore',b.avg_score) order by case b.pareto_band when 'A+' then 1 when 'A' then 2 when 'B' then 3 when 'C' then 4 when 'D' then 5 else 6 end) from bands b),'[]'::jsonb),
      'dataQuality',(select jsonb_build_object('siesaAbcCoveragePct',case when t.total_materials=0 then 0 else round(t.abc_covered::numeric/t.total_materials*100,1) end,'crmMovementEvents365',t.movement_events,'crmDemandOrders365',t.demand_orders,'baselineConfidence',case when t.total_materials>0 and t.abc_covered::numeric/t.total_materials>=.8 then 'HIGH' when t.abc_covered>0 then 'MEDIUM' else 'LOW' end,'adaptiveLearningStage',case when t.movement_events>=250 or t.demand_orders>=250 then 'MATURE' when t.movement_events>=50 or t.demand_orders>=50 then 'GROWING' else 'INITIAL' end) from targets t),
      'executive',case when v_controller then (select jsonb_build_object(
        'inventoryValue',t.inventory_value,'gapMaterials',t.gap_materials,'blockedMaterials',t.blocked_materials,
        'stars',coalesce((select jsonb_agg(to_jsonb(x) order by x."businessScore" desc,x.reference) from (select c.reference,c.description,c.unit,c.pareto_band "paretoBand",c.business_score "businessScore",c.abc_cost "abcCost",c.abc_turns "abcTurns",c.source_physical "sourcePhysical",c.operational_physical "operationalPhysical",(c.operational_physical-c.source_physical) "stockGap",c.inventory_value "inventoryValue",to_jsonb(c.warehouses) warehouses from classified c order by c.business_score desc,c.reference limit 20)x),'[]'::jsonb),
        'stockGaps',coalesce((select jsonb_agg(to_jsonb(x) order by abs(x."stockGap") desc,x.reference) from (select c.reference,c.description,c.unit,c.source_physical "sourcePhysical",c.operational_physical "operationalPhysical",(c.operational_physical-c.source_physical) "stockGap",c.inventory_value "inventoryValue",to_jsonb(c.warehouses) warehouses from classified c where c.stock_gap_abs>.0001 order by c.stock_gap_abs desc,c.inventory_value desc limit 20)x),'[]'::jsonb),
        'vsm',case when v_vsm is null then null else jsonb_build_object('summary',v_vsm->'summary','range',v_vsm->'range') end
      ) from targets t) else null end,
      'generatedAt',now()
    )
  );
end;
$function$;

revoke execute on function public.erp_x_inventory_count_plan(date) from public, anon;
grant execute on function public.erp_x_inventory_count_plan(date) to authenticated, service_role;
select pg_notify('pgrst','reload schema');
