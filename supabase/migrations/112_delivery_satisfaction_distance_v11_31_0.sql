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
