-- CRM SUMINISTROS V11.31.0
-- Confirmación post-entrega con satisfacción, distancia recorrida y tiempos diferenciados.
-- Cambio aditivo/no destructivo: no modifica el cierre logístico existente ni reabre pedidos cerrados.

alter table erp_supply.deliveries
  add column if not exists distance_km numeric(10,2),
  add column if not exists distance_source text,
  add column if not exists distance_recorded_at timestamptz,
  add column if not exists distance_recorded_by uuid references erp_supply.profiles(id) on delete set null,
  add column if not exists satisfaction_status text,
  add column if not exists satisfaction_confirmed_at timestamptz,
  add column if not exists satisfaction_confirmed_by uuid references erp_supply.profiles(id) on delete set null,
  add column if not exists satisfaction_note text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='erp_supply.deliveries'::regclass
      and conname='deliveries_distance_km_nonnegative_v1131'
  ) then
    alter table erp_supply.deliveries
      add constraint deliveries_distance_km_nonnegative_v1131
      check (distance_km is null or (distance_km >= 0 and distance_km <= 100000));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='erp_supply.deliveries'::regclass
      and conname='deliveries_distance_source_v1131'
  ) then
    alter table erp_supply.deliveries
      add constraint deliveries_distance_source_v1131
      check (
        distance_source is null
        or distance_source in ('CARRIER_REPORTED','ODOMETER_GPS','ROUTE_ESTIMATE','CLIENT_CONFIRMED','OTHER')
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='erp_supply.deliveries'::regclass
      and conname='deliveries_satisfaction_status_v1131'
  ) then
    alter table erp_supply.deliveries
      add constraint deliveries_satisfaction_status_v1131
      check (satisfaction_status is null or satisfaction_status in ('SATISFIED'));
  end if;
end $$;

create index if not exists idx_deliveries_satisfaction_confirmed_v1131
  on erp_supply.deliveries(satisfaction_confirmed_at)
  where satisfaction_confirmed_at is not null;

create index if not exists idx_deliveries_distance_recorded_v1131
  on erp_supply.deliveries(distance_recorded_at)
  where distance_km is not null;

create or replace function public.erp_x_shipping_confirm_satisfaction(
  p_order_id uuid,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'erp_supply','public','auth','pg_catalog'
as $function$
declare
  v_actor uuid:=erp_supply.require_profile();
  v_org uuid:=erp_supply.current_org_id();
  v_order erp_supply.orders%rowtype;
  v_delivery erp_supply.deliveries%rowtype;
  v_task_id uuid;
  v_distance numeric;
  v_source text:=upper(trim(coalesce(p_payload->>'distanceSource','')));
  v_received_by text:=nullif(trim(p_payload->>'receivedBy'),'');
  v_note text:=nullif(trim(p_payload->>'note'),'');
  v_first_confirmation boolean;
  v_now timestamptz:=now();
  v_transit_elapsed bigint;
  v_transit_business bigint;
  v_confirmed_elapsed bigint;
  v_confirmed_business bigint;
  v_post_delivery_elapsed bigint;
begin
  if not (
    erp_supply.has_role('ventas')
    or erp_supply.has_role('jefe_logistica')
    or erp_supply.has_role('super_admin')
  ) then
    raise exception 'No autorizado para confirmar satisfacción de entrega' using errcode='42501';
  end if;

  select * into v_order
  from erp_supply.orders
  where id=p_order_id and organization_id=v_org
  for update;

  if not found then raise exception 'Pedido no encontrado'; end if;

  if erp_supply.has_role('ventas')
     and not erp_supply.has_role('super_admin')
     and v_order.seller_profile_id is distinct from v_actor then
    raise exception 'Solo el asesor responsable puede confirmar la satisfacción de este pedido' using errcode='42501';
  end if;

  select * into v_delivery
  from erp_supply.deliveries
  where order_id=p_order_id
  order by created_at desc
  limit 1
  for update;

  if not found or v_delivery.dispatched_at is null then
    raise exception 'El pedido todavía no registra salida';
  end if;

  if v_delivery.delivered_at is null or v_delivery.status<>'DELIVERED' then
    raise exception 'La satisfacción solo puede confirmarse después de la entrega logística';
  end if;

  if v_delivery.status='NOT_DELIVERED'
     or lower(coalesce(v_order.metadata->>'deliveryExceptionOpen','false'))='true' then
    raise exception 'Existe una novedad de entrega abierta; resuélvela antes de confirmar satisfacción';
  end if;

  begin
    v_distance:=nullif(trim(p_payload->>'distanceKm'),'')::numeric;
  exception when others then
    raise exception 'Distancia recorrida inválida';
  end;

  if v_distance is not null and (v_distance<0 or v_distance>100000) then
    raise exception 'La distancia recorrida debe estar entre 0 y 100000 km';
  end if;

  if v_order.delivery_route_code in ('LOCAL_DISPATCH','NATIONAL_DISPATCH')
     and (v_distance is null or v_distance<=0) then
    raise exception 'Registra la distancia recorrida para despachos locales o nacionales';
  end if;

  if v_distance is not null then
    if v_source not in ('CARRIER_REPORTED','ODOMETER_GPS','ROUTE_ESTIMATE','CLIENT_CONFIRMED','OTHER') then
      raise exception 'Selecciona la fuente de la distancia recorrida';
    end if;
  else
    v_source:=null;
  end if;

  if v_note is not null and char_length(v_note)>500 then
    raise exception 'La observación no puede superar 500 caracteres';
  end if;

  v_first_confirmation:=v_delivery.satisfaction_confirmed_at is null;

  update erp_supply.deliveries
  set
    distance_km=coalesce(v_distance,distance_km),
    distance_source=case when v_distance is null then distance_source else v_source end,
    distance_recorded_at=case when v_distance is null then distance_recorded_at else v_now end,
    distance_recorded_by=case when v_distance is null then distance_recorded_by else v_actor end,
    satisfaction_status='SATISFIED',
    satisfaction_confirmed_at=coalesce(satisfaction_confirmed_at,v_now),
    satisfaction_confirmed_by=coalesce(satisfaction_confirmed_by,v_actor),
    satisfaction_note=coalesce(v_note,satisfaction_note),
    received_by=coalesce(v_received_by,received_by),
    metadata=coalesce(metadata,'{}'::jsonb)||jsonb_strip_nulls(jsonb_build_object(
      'satisfactionConfirmed',true,
      'satisfactionConfirmedAt',coalesce(satisfaction_confirmed_at,v_now),
      'satisfactionConfirmedBy',coalesce(satisfaction_confirmed_by,v_actor),
      'distanceKm',coalesce(v_distance,distance_km),
      'distanceSource',case when v_distance is null then distance_source else v_source end,
      'postDeliveryReviewVersion','11.31.0'
    )),
    updated_at=v_now
  where id=v_delivery.id
  returning * into v_delivery;

  select t.id into v_task_id
  from erp_supply.order_tasks t
  where t.order_id=p_order_id and t.step_code='CLOSURE'
  order by t.sequence_no desc
  limit 1;

  insert into erp_supply.delivery_milestones(
    organization_id,order_id,task_id,delivery_id,milestone_code,actor_profile_id,metadata
  ) values(
    v_org,p_order_id,v_task_id,v_delivery.id,
    case when v_first_confirmation then 'DELIVERED_SATISFIED' else 'DELIVERY_REVIEW_UPDATED' end,
    v_actor,
    jsonb_strip_nulls(jsonb_build_object(
      'distanceKm',v_delivery.distance_km,
      'distanceSource',v_delivery.distance_source,
      'receivedBy',v_delivery.received_by,
      'note',v_delivery.satisfaction_note,
      'satisfactionConfirmedAt',v_delivery.satisfaction_confirmed_at,
      'version','11.31.0'
    ))
  );

  insert into erp_supply.order_events(
    organization_id,order_id,task_id,event_type,action_code,
    from_step_code,to_step_code,from_status,to_status,
    actor_profile_id,actor_role_code,payload
  ) values(
    v_org,p_order_id,v_task_id,'DOMAIN_RECORD',
    case when v_first_confirmation then 'DELIVERY_SATISFACTION' else 'DELIVERY_REVIEW_UPDATE' end,
    v_order.current_step_code,v_order.current_step_code,v_order.status,v_order.status,
    v_actor,(erp_supply.current_roles())[1],
    jsonb_strip_nulls(jsonb_build_object(
      'deliveryId',v_delivery.id,
      'distanceKm',v_delivery.distance_km,
      'distanceSource',v_delivery.distance_source,
      'receivedBy',v_delivery.received_by,
      'satisfactionStatus',v_delivery.satisfaction_status,
      'satisfactionConfirmedAt',v_delivery.satisfaction_confirmed_at,
      'version','11.31.0'
    ))
  );

  update erp_supply.orders
  set metadata=coalesce(metadata,'{}'::jsonb)||jsonb_strip_nulls(jsonb_build_object(
        'deliverySatisfactionStatus','SATISFIED',
        'deliverySatisfactionConfirmedAt',v_delivery.satisfaction_confirmed_at,
        'deliveryDistanceKm',v_delivery.distance_km,
        'deliveryDistanceSource',v_delivery.distance_source
      )),
      updated_at=v_now
  where id=p_order_id;

  v_transit_elapsed:=greatest(0,extract(epoch from(v_delivery.delivered_at-v_delivery.dispatched_at))::bigint);
  v_transit_business:=erp_supply.business_seconds_between(v_org,v_delivery.dispatched_at,v_delivery.delivered_at);
  v_confirmed_elapsed:=greatest(0,extract(epoch from(v_delivery.satisfaction_confirmed_at-v_delivery.dispatched_at))::bigint);
  v_confirmed_business:=erp_supply.business_seconds_between(v_org,v_delivery.dispatched_at,v_delivery.satisfaction_confirmed_at);
  v_post_delivery_elapsed:=greatest(0,extract(epoch from(v_delivery.satisfaction_confirmed_at-v_delivery.delivered_at))::bigint);

  return jsonb_build_object(
    'success',true,
    'firstConfirmation',v_first_confirmation,
    'delivery',to_jsonb(v_delivery),
    'metrics',jsonb_build_object(
      'distanceKm',v_delivery.distance_km,
      'transitElapsedSeconds',v_transit_elapsed,
      'transitBusinessSeconds',v_transit_business,
      'satisfactionElapsedSeconds',v_confirmed_elapsed,
      'satisfactionBusinessSeconds',v_confirmed_business,
      'postDeliveryConfirmationSeconds',v_post_delivery_elapsed
    )
  );
end;
$function$;

revoke all on function public.erp_x_shipping_confirm_satisfaction(uuid,jsonb) from public,anon;
grant execute on function public.erp_x_shipping_confirm_satisfaction(uuid,jsonb) to authenticated;

create or replace function public.erp_x_shipping_sent_orders(
  p_search text default null,
  p_page integer default 1,
  p_page_size integer default 30
)
returns jsonb
language plpgsql
stable security definer
set search_path to 'erp_supply','public','auth','pg_catalog'
as $function$
declare
  v_actor uuid:=erp_supply.require_profile();
  v_org uuid:=erp_supply.current_org_id();
  v_page int:=greatest(coalesce(p_page,1),1);
  v_size int:=least(greatest(coalesce(p_page_size,30),1),100);
  v_total bigint;
  v_items jsonb;
begin
  if not (erp_supply.has_role('ventas') or erp_supply.has_role('super_admin')) then
    raise exception 'Solo Ventas o Superadministración pueden consultar pedidos enviados' using errcode='42501';
  end if;

  select count(*) into v_total
  from erp_supply.orders o
  join lateral(
    select d.* from erp_supply.deliveries d
    where d.order_id=o.id and d.dispatched_at is not null
    order by d.created_at desc limit 1
  ) d on true
  where o.organization_id=v_org
    and not o.is_test
    and (erp_supply.has_role('super_admin') or o.seller_profile_id=v_actor)
    and (
      p_search is null
      or lower(o.order_number||' '||o.client_name||' '||coalesce(d.tracking_number,'')) like '%'||lower(p_search)||'%'
    );

  select coalesce(jsonb_agg(to_jsonb(x) order by x."dispatchedAt" desc),'[]'::jsonb)
  into v_items
  from(
    select
      o.id,
      o.order_number "orderNumber",
      o.client_name "clientName",
      o.priority,
      o.delivery_route_code route,
      o.current_step_code "currentStep",
      o.status,
      d.status "deliveryStatus",
      d.tracking_number "trackingNumber",
      d.carrier,
      d.dispatched_at "dispatchedAt",
      d.delivered_at "deliveredAt",
      d.received_by "receivedBy",
      d.distance_km "distanceKm",
      d.distance_source "distanceSource",
      d.satisfaction_status "satisfactionStatus",
      d.satisfaction_confirmed_at "satisfactionConfirmedAt",
      d.satisfaction_note "satisfactionNote",
      sp2.display_name "satisfactionConfirmedByName",
      d.metadata#>>'{destination,municipality}' municipality,
      d.metadata#>>'{destination,address}' address,
      coalesce(p.display_name,sp.display_name) "assigneeName",
      (d.status='NOT_DELIVERED' or lower(coalesce(o.metadata->>'deliveryExceptionOpen','false'))='true') "hasNoDelivery",
      (d.status in('DISPATCHED','IN_TRANSIT','REPROGRAMMED') and o.status<>'CLOSED') "canReportNoDelivery",
      (d.delivered_at is not null and d.status='DELIVERED' and d.satisfaction_confirmed_at is null
        and lower(coalesce(o.metadata->>'deliveryExceptionOpen','false'))<>'true') "canConfirmSatisfaction",
      case when d.dispatched_at is not null and d.delivered_at is not null
        then greatest(0,extract(epoch from(d.delivered_at-d.dispatched_at))::bigint) end "transitElapsedSeconds",
      case when d.dispatched_at is not null and d.delivered_at is not null
        then erp_supply.business_seconds_between(v_org,d.dispatched_at,d.delivered_at) end "transitBusinessSeconds",
      case when d.dispatched_at is not null and d.satisfaction_confirmed_at is not null
        then greatest(0,extract(epoch from(d.satisfaction_confirmed_at-d.dispatched_at))::bigint) end "satisfactionElapsedSeconds",
      case when d.dispatched_at is not null and d.satisfaction_confirmed_at is not null
        then erp_supply.business_seconds_between(v_org,d.dispatched_at,d.satisfaction_confirmed_at) end "satisfactionBusinessSeconds",
      case when d.delivered_at is not null and d.satisfaction_confirmed_at is not null
        then greatest(0,extract(epoch from(d.satisfaction_confirmed_at-d.delivered_at))::bigint) end "postDeliveryConfirmationSeconds"
    from erp_supply.orders o
    join lateral(
      select dl.* from erp_supply.deliveries dl
      where dl.order_id=o.id and dl.dispatched_at is not null
      order by dl.created_at desc limit 1
    ) d on true
    left join erp_supply.profiles p on p.id=d.assigned_profile_id
    left join erp_supply.profiles sp on sp.id=o.seller_profile_id
    left join erp_supply.profiles sp2 on sp2.id=d.satisfaction_confirmed_by
    where o.organization_id=v_org
      and not o.is_test
      and (erp_supply.has_role('super_admin') or o.seller_profile_id=v_actor)
      and (
        p_search is null
        or lower(o.order_number||' '||o.client_name||' '||coalesce(d.tracking_number,'')) like '%'||lower(p_search)||'%'
      )
    order by d.dispatched_at desc
    offset(v_page-1)*v_size
    limit v_size
  )x;

  return jsonb_build_object(
    'items',v_items,
    'pagination',jsonb_build_object(
      'page',v_page,'pageSize',v_size,'totalItems',v_total,
      'totalPages',ceil(v_total::numeric/v_size)::int
    )
  );
end;
$function$;

revoke all on function public.erp_x_shipping_sent_orders(text,integer,integer) from public,anon;
grant execute on function public.erp_x_shipping_sent_orders(text,integer,integer) to authenticated;


-- Extensión no destructiva del dataset de Entregas en Analítica.
create or replace function erp_supply.reports_delivery_explore_v1131(p_payload jsonb)
returns jsonb
language plpgsql
stable security definer
set search_path=''
as $function$
declare
  v_actor uuid:=erp_supply.require_profile();
  v_org uuid:=erp_supply.current_org_id();
  v_tz text:=coalesce((select o.timezone from erp_supply.organizations o where o.id=v_org),'America/Bogota');
  v_dimension text:=lower(coalesce(p_payload->>'dimension','route'));
  v_metric text:=lower(coalesce(p_payload->>'metric','count'));
  v_from date:=coalesce((p_payload->>'from')::date,current_date-29);
  v_to date:=coalesce((p_payload->>'to')::date,current_date);
  v_limit integer:=greatest(1,least(coalesce((p_payload->>'limit')::integer,50),500));
  v_start timestamptz;
  v_end timestamptz;
  v_rows jsonb:='[]'::jsonb;
begin
  if not erp_supply.can_access_module('reports','read') then
    raise exception 'No autorizado para consultar Analítica y reportes' using errcode='42501';
  end if;
  if v_from>v_to or (v_to-v_from)>366 then raise exception 'Rango de fechas inválido'; end if;
  if v_dimension not in('route','carrier','status','day') then raise exception 'Dimensión no permitida para Entregas'; end if;
  if v_metric not in(
    'count','delivered','satisfied','cost','avg_transit_hours',
    'distance_km','avg_distance_km','avg_satisfaction_hours','avg_post_delivery_confirmation_hours'
  ) then raise exception 'Métrica no permitida para Entregas'; end if;

  v_start:=(v_from::timestamp at time zone v_tz);
  v_end:=((v_to+1)::timestamp at time zone v_tz);

  with base as (
    select d.*
    from erp_supply.deliveries d
    join erp_supply.orders o on o.id=d.order_id
    where o.organization_id=v_org
      and not coalesce(o.is_test,false)
      and d.created_at>=v_start and d.created_at<v_end
  ), grouped as (
    select
      case v_dimension
        when 'route' then coalesce(route_code,'SIN_RUTA')
        when 'carrier' then coalesce(nullif(trim(carrier),''),'SIN_TRANSPORTADORA')
        when 'status' then coalesce(status,'SIN_ESTADO')
        when 'day' then to_char(created_at at time zone v_tz,'YYYY-MM-DD')
      end label,
      case v_metric
        when 'count' then count(*)::numeric
        when 'delivered' then count(*) filter(where delivered_at is not null or status='DELIVERED')::numeric
        when 'satisfied' then count(*) filter(where satisfaction_confirmed_at is not null or satisfaction_status='SATISFIED')::numeric
        when 'cost' then coalesce(sum(carrier_cost),0)::numeric
        when 'avg_transit_hours' then coalesce(avg(case when dispatched_at is not null and delivered_at is not null then extract(epoch from(delivered_at-dispatched_at)) end)/3600.0,0)::numeric
        when 'distance_km' then coalesce(sum(distance_km),0)::numeric
        when 'avg_distance_km' then coalesce(avg(distance_km),0)::numeric
        when 'avg_satisfaction_hours' then coalesce(avg(case when dispatched_at is not null and satisfaction_confirmed_at is not null then extract(epoch from(satisfaction_confirmed_at-dispatched_at)) end)/3600.0,0)::numeric
        when 'avg_post_delivery_confirmation_hours' then coalesce(avg(case when delivered_at is not null and satisfaction_confirmed_at is not null then extract(epoch from(satisfaction_confirmed_at-delivered_at)) end)/3600.0,0)::numeric
      end value,
      count(*) records
    from base
    group by 1
  )
  select coalesce(
    jsonb_agg(jsonb_build_object('label',label,'value',value,'records',records) order by value desc nulls last)
      filter(where label is not null),
    '[]'::jsonb
  )
  into v_rows
  from (select * from grouped order by value desc nulls last limit v_limit) q;

  return jsonb_build_object(
    'dataset','deliveries',
    'dimension',v_dimension,
    'metric',v_metric,
    'from',v_from,
    'to',v_to,
    'rows',v_rows,
    'catalog',jsonb_build_object(
      'deliveries',jsonb_build_object(
        'dimensions',jsonb_build_array('route','carrier','status','day'),
        'metrics',jsonb_build_array(
          'count','delivered','satisfied','cost','avg_transit_hours',
          'distance_km','avg_distance_km','avg_satisfaction_hours','avg_post_delivery_confirmation_hours'
        )
      )
    )
  );
end;
$function$;

revoke all on function erp_supply.reports_delivery_explore_v1131(jsonb) from public,anon;
grant execute on function erp_supply.reports_delivery_explore_v1131(jsonb) to authenticated;

create or replace function erp_supply.reports_delivery_export_v1131(p_payload jsonb)
returns jsonb
language plpgsql
stable security definer
set search_path=''
as $function$
declare
  v_actor uuid:=erp_supply.require_profile();
  v_org uuid:=erp_supply.current_org_id();
  v_tz text:=coalesce((select o.timezone from erp_supply.organizations o where o.id=v_org),'America/Bogota');
  v_from date:=coalesce((p_payload->>'from')::date,current_date-29);
  v_to date:=coalesce((p_payload->>'to')::date,current_date);
  v_limit integer:=greatest(1,least(coalesce((p_payload->>'limit')::integer,5000),5000));
  v_start timestamptz;
  v_end timestamptz;
  v_rows jsonb:='[]'::jsonb;
begin
  if not erp_supply.can_access_module('reports','read') then
    raise exception 'No autorizado para exportar Analítica y reportes' using errcode='42501';
  end if;
  if v_from>v_to or (v_to-v_from)>366 then raise exception 'Rango de fechas inválido'; end if;
  v_start:=(v_from::timestamp at time zone v_tz);
  v_end:=((v_to+1)::timestamp at time zone v_tz);

  select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc),'[]'::jsonb)
  into v_rows
  from (
    select
      o.order_number,
      o.client_name,
      d.route_code,
      d.status,
      d.scheduled_at,
      d.dispatched_at,
      d.delivered_at,
      d.received_by,
      d.no_delivery_reason,
      d.carrier,
      d.tracking_number,
      d.carrier_invoice_number,
      d.carrier_cost,
      d.carrier_cost_currency,
      d.distance_km,
      d.distance_source,
      d.distance_recorded_at,
      d.satisfaction_status,
      d.satisfaction_confirmed_at,
      sc.display_name satisfaction_confirmed_by,
      d.satisfaction_note,
      d.metadata#>>'{destination,municipality}' municipality,
      d.metadata#>>'{destination,address}' address,
      case when d.dispatched_at is not null and d.delivered_at is not null
        then greatest(0,extract(epoch from(d.delivered_at-d.dispatched_at))::bigint) end transit_elapsed_seconds,
      case when d.dispatched_at is not null and d.satisfaction_confirmed_at is not null
        then greatest(0,extract(epoch from(d.satisfaction_confirmed_at-d.dispatched_at))::bigint) end satisfaction_elapsed_seconds,
      case when d.delivered_at is not null and d.satisfaction_confirmed_at is not null
        then greatest(0,extract(epoch from(d.satisfaction_confirmed_at-d.delivered_at))::bigint) end post_delivery_confirmation_seconds,
      p.display_name assigned_to,
      d.created_at
    from erp_supply.deliveries d
    join erp_supply.orders o on o.id=d.order_id
    left join erp_supply.profiles p on p.id=d.assigned_profile_id
    left join erp_supply.profiles sc on sc.id=d.satisfaction_confirmed_by
    where o.organization_id=v_org
      and not coalesce(o.is_test,false)
      and d.created_at>=v_start and d.created_at<v_end
    order by d.created_at desc
    limit v_limit
  ) q;

  return jsonb_build_object(
    'dataset','deliveries','from',v_from,'to',v_to,
    'rows',v_rows,'rowCount',jsonb_array_length(v_rows)
  );
end;
$function$;

revoke all on function erp_supply.reports_delivery_export_v1131(jsonb) from public,anon;
grant execute on function erp_supply.reports_delivery_export_v1131(jsonb) to authenticated;

create or replace function public.erp_x_reports_explore(p_payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable security invoker
set search_path=''
as $function$
begin
  if lower(coalesce(p_payload->>'dataset','orders'))='deliveries' then
    return erp_supply.reports_delivery_explore_v1131(coalesce(p_payload,'{}'::jsonb));
  end if;
  return erp_supply.reports_explore_core(coalesce(p_payload,'{}'::jsonb));
end;
$function$;

revoke all on function public.erp_x_reports_explore(jsonb) from public,anon;
grant execute on function public.erp_x_reports_explore(jsonb) to authenticated;

create or replace function public.erp_x_reports_export(p_payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable security invoker
set search_path=''
as $function$
begin
  if lower(coalesce(p_payload->>'dataset','orders'))='deliveries' then
    return erp_supply.reports_delivery_export_v1131(coalesce(p_payload,'{}'::jsonb));
  end if;
  return erp_supply.reports_export_core(coalesce(p_payload,'{}'::jsonb));
end;
$function$;

revoke all on function public.erp_x_reports_export(jsonb) from public,anon;
grant execute on function public.erp_x_reports_export(jsonb) to authenticated;
