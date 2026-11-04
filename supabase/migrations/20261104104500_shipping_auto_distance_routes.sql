-- Envíos: distancia vial automática, no captura manual
-- Se conserva la satisfacción aunque la ruta no sea resoluble. Kilometraje ausente = NULL.
-- Consulta de contexto geográfico para distancia vial automática.
-- Solo envía municipio y departamento; nunca la dirección exacta del cliente.
create or replace function public.erp_x_shipping_distance_context(p_order_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'erp_supply','public','auth','pg_catalog'
as $$
declare
  v_actor uuid:=erp_supply.require_profile();
  v_org uuid:=erp_supply.current_org_id();
  v_order erp_supply.orders%rowtype;
  v_delivery erp_supply.deliveries%rowtype;
  v_settings jsonb;
begin
  if not (erp_supply.has_role('ventas') or erp_supply.has_role('jefe_logistica')
          or erp_supply.has_role('super_admin')) then
    raise exception 'No autorizado para consultar el envío' using errcode='42501';
  end if;
  select * into v_order from erp_supply.orders
  where id=p_order_id and organization_id=v_org and not coalesce(is_test,false);
  if not found then raise exception 'Pedido no encontrado'; end if;
  if erp_supply.has_role('ventas') and not erp_supply.has_role('super_admin')
     and v_order.seller_profile_id is distinct from v_actor then
    raise exception 'Solo el asesor responsable puede consultar este envío' using errcode='42501';
  end if;

  select * into v_delivery from erp_supply.deliveries
  where order_id=v_order.id and dispatched_at is not null
  order by created_at desc limit 1;
  if not found then raise exception 'Este pedido no registra un envío'; end if;
  select settings into v_settings from erp_supply.organizations where id=v_org;
  return jsonb_build_object(
    'route',v_order.delivery_route_code,
    'originCity',nullif(trim(v_settings->>'shippingOriginCity'),''),
    'originDepartment',nullif(trim(v_settings->>'shippingOriginDepartment'),''),
    'destinationCity',coalesce(
      nullif(trim(v_delivery.metadata#>>'{destination,municipality}'),''),
      nullif(trim(v_order.client_city),'')
    ),
    'destinationDepartment',coalesce(
      nullif(trim(v_delivery.metadata#>>'{destination,department}'),''),
      nullif(trim(v_order.metadata->>'clientDepartment'),'')
    ),
    'distanceKm',v_delivery.distance_km,
    'distanceSource',v_delivery.distance_source
  );
end;
$$;
revoke all on function public.erp_x_shipping_distance_context(uuid) from public,anon;
grant execute on function public.erp_x_shipping_distance_context(uuid) to authenticated;

CREATE OR REPLACE FUNCTION public.erp_x_shipping_confirm_satisfaction(p_order_id uuid, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'erp_supply', 'public', 'auth', 'pg_catalog'
AS $function$
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

  -- La distancia es automática: si no existe una ruta vial disponible, la satisfacción
  -- puede confirmarse sin capturar kilómetros manualmente (distancia pendiente).
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
      'postDeliveryReviewVersion','11.47.1'
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
      'version','11.47.1'
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
      'version','11.47.1'
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
