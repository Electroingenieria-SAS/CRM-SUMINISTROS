begin;

alter table public.viajes_despacho
  add column if not exists costo_original numeric,
  add column if not exists costo_ajustes numeric not null default 0,
  add column if not exists revisiones_costo smallint not null default 0;

update public.viajes_despacho
set costo_original=total_viaje
where costo_original is null;

alter table public.viajes_despacho
  alter column costo_original set default 0,
  alter column costo_original set not null;

do $$
begin
  if not exists(select 1 from pg_constraint where conname='viajes_despacho_costo_original_check' and conrelid='public.viajes_despacho'::regclass) then
    alter table public.viajes_despacho add constraint viajes_despacho_costo_original_check check(costo_original>=0);
  end if;
  if not exists(select 1 from pg_constraint where conname='viajes_despacho_costo_ajustes_check' and conrelid='public.viajes_despacho'::regclass) then
    alter table public.viajes_despacho add constraint viajes_despacho_costo_ajustes_check check(costo_ajustes>=0);
  end if;
  if not exists(select 1 from pg_constraint where conname='viajes_despacho_revisiones_costo_check' and conrelid='public.viajes_despacho'::regclass) then
    alter table public.viajes_despacho add constraint viajes_despacho_revisiones_costo_check check(revisiones_costo between 0 and 3);
  end if;
end $$;

create table if not exists public.viajes_despacho_ajustes_costo(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id) on delete cascade,
  trip_id uuid not null references public.viajes_despacho(id) on delete cascade,
  order_id uuid not null references erp_supply.orders(id) on delete cascade,
  delivery_id uuid null references erp_supply.deliveries(id) on delete set null,
  revision_number smallint not null check(revision_number between 1 and 3),
  previous_items jsonb not null default '[]'::jsonb check(jsonb_typeof(previous_items)='array'),
  new_items jsonb not null default '[]'::jsonb check(jsonb_typeof(new_items)='array'),
  previous_total numeric not null check(previous_total>=0),
  adjustment_total numeric not null check(adjustment_total>=0),
  new_total numeric not null check(new_total>=0),
  justification text not null check(char_length(trim(justification)) between 15 and 1000),
  created_by uuid not null references erp_supply.profiles(id),
  created_at timestamptz not null default now(),
  constraint viajes_despacho_ajustes_costo_revision_key unique(trip_id,revision_number)
);

create index if not exists idx_viajes_despacho_ajustes_trip
  on public.viajes_despacho_ajustes_costo(trip_id,revision_number desc);
create index if not exists idx_viajes_despacho_ajustes_org_created
  on public.viajes_despacho_ajustes_costo(organization_id,created_at desc);

alter table public.viajes_despacho_ajustes_costo enable row level security;
revoke all on table public.viajes_despacho_ajustes_costo from public,anon,authenticated;

create or replace function erp_supply.local_dispatch_cost_baseline_sync()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  if coalesce(new.revisiones_costo,0)=0 then
    new.costo_original:=new.total_viaje;
    new.costo_ajustes:=0;
  end if;
  return new;
end;
$$;

revoke all on function erp_supply.local_dispatch_cost_baseline_sync() from public,anon,authenticated;

drop trigger if exists trg_local_dispatch_cost_baseline on public.viajes_despacho;
create trigger trg_local_dispatch_cost_baseline
before insert or update of total_viaje,revisiones_costo
on public.viajes_despacho
for each row execute function erp_supply.local_dispatch_cost_baseline_sync();

create or replace function public.erp_x_local_dispatch_cost_detail(p_trip_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid:=erp_supply.require_profile();
  v_org uuid:=erp_supply.current_org_id();
  v_trip public.viajes_despacho%rowtype;
  v_items jsonb:='[]'::jsonb;
  v_history jsonb:='[]'::jsonb;
  v_can_update boolean;
begin
  if not(erp_supply.can_access_module('shipping','read') or erp_supply.has_role('super_admin')) then
    raise exception 'No autorizado para consultar costos de despacho local' using errcode='42501';
  end if;

  select * into v_trip
  from public.viajes_despacho
  where id=p_trip_id and organization_id=v_org;

  if not found then
    raise exception 'Viaje local no disponible' using errcode='42501';
  end if;

  select a.new_items into v_items
  from public.viajes_despacho_ajustes_costo a
  where a.trip_id=v_trip.id and a.organization_id=v_org
  order by a.revision_number desc
  limit 1;

  v_items:=coalesce(v_items,'[]'::jsonb);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',x.id,
        'revisionNumber',x.revision_number,
        'previousItems',x.previous_items,
        'newItems',x.new_items,
        'previousTotal',x.previous_total,
        'adjustmentTotal',x.adjustment_total,
        'newTotal',x.new_total,
        'justification',x.justification,
        'createdAt',x.created_at,
        'createdBy',x.display_name,
        'createdByProfileId',x.created_by
      )
      order by x.revision_number desc
    ),
    '[]'::jsonb
  )
  into v_history
  from (
    select a.*,p.display_name
    from public.viajes_despacho_ajustes_costo a
    left join erp_supply.profiles p on p.id=a.created_by
    where a.trip_id=v_trip.id and a.organization_id=v_org
  ) x;

  v_can_update:=(erp_supply.can_access_module('shipping','update') or erp_supply.has_role('super_admin'))
    and v_trip.revisiones_costo<3;

  return jsonb_build_object(
    'tripId',v_trip.id,
    'orderId',v_trip.order_id,
    'deliveryId',v_trip.delivery_id,
    'originalCost',v_trip.costo_original,
    'initialBreakdown',jsonb_build_object(
      'tariffBase',v_trip.tarifa_base,
      'extraWeightCost',v_trip.costo_kilos_extra,
      'unloadingCost',v_trip.costo_descargue,
      'diversionCost',v_trip.costo_desvio
    ),
    'currentAdjustments',v_items,
    'adjustmentTotal',v_trip.costo_ajustes,
    'currentTotal',v_trip.total_viaje,
    'revisionsUsed',v_trip.revisiones_costo,
    'revisionsRemaining',greatest(0,3-v_trip.revisiones_costo),
    'canUpdate',v_can_update,
    'history',v_history,
    'version','11.46.0'
  );
end;
$$;

create or replace function public.erp_x_local_dispatch_cost_adjust(p_trip_id uuid,p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid:=erp_supply.require_profile();
  v_org uuid:=erp_supply.current_org_id();
  v_trip public.viajes_despacho%rowtype;
  v_order erp_supply.orders%rowtype;
  v_delivery erp_supply.deliveries%rowtype;
  v_previous_items jsonb:='[]'::jsonb;
  v_input jsonb:=coalesce(p_payload->'items','[]'::jsonb);
  v_normalized jsonb:='[]'::jsonb;
  v_item jsonb;
  v_concept text;
  v_description text;
  v_value numeric;
  v_adjustment_total numeric:=0;
  v_previous_total numeric;
  v_new_total numeric;
  v_used integer;
  v_next integer;
  v_justification text:=trim(coalesce(p_payload->>'justification',''));
  v_adjustment public.viajes_despacho_ajustes_costo%rowtype;
begin
  if not(erp_supply.can_access_module('shipping','update') or erp_supply.has_role('super_admin')) then
    raise exception 'No autorizado para modificar costos de despacho local' using errcode='42501';
  end if;

  if char_length(v_justification)<15 or char_length(v_justification)>1000 then
    raise exception 'La justificación debe tener entre 15 y 1000 caracteres';
  end if;

  if jsonb_typeof(v_input)<>'array' then
    raise exception 'El detalle de costos debe ser una lista';
  end if;

  select * into v_trip
  from public.viajes_despacho
  where id=p_trip_id and organization_id=v_org
  for update;

  if not found then
    raise exception 'Viaje local no disponible' using errcode='42501';
  end if;

  select count(*)::integer into v_used
  from public.viajes_despacho_ajustes_costo
  where trip_id=v_trip.id and organization_id=v_org;

  if v_used>=3 then
    raise exception 'Se alcanzó el máximo de 3 modificaciones permitidas para este flete';
  end if;

  v_next:=v_used+1;

  select a.new_items into v_previous_items
  from public.viajes_despacho_ajustes_costo a
  where a.trip_id=v_trip.id and a.organization_id=v_org
  order by a.revision_number desc
  limit 1;

  v_previous_items:=coalesce(v_previous_items,'[]'::jsonb);

  for v_item in select value from jsonb_array_elements(v_input)
  loop
    if jsonb_typeof(v_item)<>'object' then
      raise exception 'Cada costo adicional debe ser un objeto válido';
    end if;

    v_concept:=upper(trim(coalesce(v_item->>'concept','')));
    v_description:=nullif(trim(coalesce(v_item->>'description','')),'');
    v_value:=erp_supply.safe_numeric(v_item->>'value');

    if v_concept not in ('AYUDANTE','PARADA_ADICIONAL','PEAJE','DESCARGUE','DESVIO','PARQUEADERO','TIEMPO_ESPERA','OTRO') then
      raise exception 'Concepto de costo no permitido: %',coalesce(v_concept,'');
    end if;

    if v_value is null or v_value<=0 or v_value>1000000000 then
      raise exception 'Cada costo adicional debe ser mayor que cero y estar dentro del rango permitido';
    end if;

    if v_concept='OTRO' and coalesce(char_length(v_description),0)<3 then
      raise exception 'Describe el concepto OTRO';
    end if;

    v_normalized:=v_normalized||jsonb_build_array(
      jsonb_strip_nulls(
        jsonb_build_object(
          'concept',v_concept,
          'description',v_description,
          'value',v_value
        )
      )
    );
    v_adjustment_total:=v_adjustment_total+v_value;
  end loop;

  if v_normalized=v_previous_items then
    raise exception 'No existen cambios en el desglose de costos';
  end if;

  v_previous_total:=v_trip.total_viaje;
  v_new_total:=v_trip.costo_original+v_adjustment_total;

  insert into public.viajes_despacho_ajustes_costo(
    organization_id,trip_id,order_id,delivery_id,revision_number,
    previous_items,new_items,previous_total,adjustment_total,new_total,
    justification,created_by
  )
  values(
    v_org,v_trip.id,v_trip.order_id,v_trip.delivery_id,v_next,
    v_previous_items,v_normalized,v_previous_total,v_adjustment_total,v_new_total,
    v_justification,v_actor
  )
  returning * into v_adjustment;

  update public.viajes_despacho
  set updated_at=now(),
      updated_by=v_actor,
      costo_ajustes=v_adjustment_total,
      revisiones_costo=v_next,
      total_viaje=v_new_total
  where id=v_trip.id
  returning * into v_trip;

  if v_trip.delivery_id is not null then
    select * into v_delivery
    from erp_supply.deliveries
    where id=v_trip.delivery_id
    for update;

    if found then
      update erp_supply.deliveries
      set carrier_cost=v_new_total,
          carrier_cost_currency='COP',
          carrier_cost_recorded_by=v_actor,
          carrier_cost_recorded_at=now(),
          metadata=coalesce(metadata,'{}'::jsonb)
            || jsonb_build_object(
              'localDispatch',
              coalesce(metadata->'localDispatch','{}'::jsonb)
              || jsonb_build_object(
                'originalCost',v_trip.costo_original,
                'adjustmentTotal',v_adjustment_total,
                'costRevisionCount',v_next,
                'costAdjustments',v_normalized,
                'totalTrip',v_new_total
              )
            ),
          updated_at=now()
      where id=v_delivery.id
      returning * into v_delivery;
    end if;
  end if;

  select * into v_order
  from erp_supply.orders
  where id=v_trip.order_id and organization_id=v_org;

  insert into erp_supply.order_events(
    organization_id,order_id,task_id,event_type,action_code,
    from_step_code,to_step_code,from_status,to_status,
    actor_profile_id,actor_role_code,payload
  )
  values(
    v_org,v_trip.order_id,v_trip.task_id,'DOMAIN_RECORD','LOCAL_DISPATCH_COST_ADJUSTED',
    v_order.current_step_code,v_order.current_step_code,v_order.status,v_order.status,
    v_actor,(erp_supply.current_roles())[1],
    jsonb_build_object(
      'tripId',v_trip.id,
      'revisionNumber',v_next,
      'previousTotal',v_previous_total,
      'newTotal',v_new_total,
      'adjustmentTotal',v_adjustment_total,
      'justification',v_justification,
      'items',v_normalized
    )
  );

  return jsonb_build_object(
    'success',true,
    'revisionNumber',v_next,
    'revisionsRemaining',greatest(0,3-v_next),
    'originalCost',v_trip.costo_original,
    'adjustmentTotal',v_adjustment_total,
    'total',v_new_total,
    'items',v_normalized,
    'adjustment',to_jsonb(v_adjustment),
    'version','11.46.0'
  );
end;
$$;

create or replace function public.erp_x_local_dispatch_trips(
  p_date_from date default null,
  p_date_to date default null,
  p_destination text default null,
  p_page integer default 1,
  p_page_size integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid:=erp_supply.require_profile();
  v_org uuid:=erp_supply.current_org_id();
  v_from date:=coalesce(p_date_from,current_date);
  v_to date:=coalesce(p_date_to,p_date_from,current_date);
  v_destination text:=nullif(upper(trim(coalesce(p_destination,''))),'');
  v_page integer:=greatest(1,coalesce(p_page,1));
  v_size integer:=least(500,greatest(1,coalesce(p_page_size,100)));
  v_total bigint;
  v_items jsonb;
  v_metrics jsonb;
  v_can_update boolean;
begin
  if not(erp_supply.can_access_module('shipping','read') or erp_supply.has_role('super_admin')) then
    raise exception 'No autorizado para consultar despachos locales' using errcode='42501';
  end if;
  if v_from>v_to then raise exception 'Rango de fechas inválido';end if;

  v_can_update:=erp_supply.can_access_module('shipping','update') or erp_supply.has_role('super_admin');

  select count(*) into v_total
  from public.viajes_despacho t
  where t.organization_id=v_org
    and t.fecha between v_from and v_to
    and(v_destination is null or t.ciudad_destino=v_destination);

  select coalesce(jsonb_agg(to_jsonb(q) order by q.fecha desc,q.created_at desc),'[]'::jsonb)
  into v_items
  from(
    select
      t.id,t.fecha,t.numero_factura "numeroFactura",t.sucursal,t.ciudad_destino "ciudadDestino",
      t.peso_kg "pesoKg",t.tarifa_base "tarifaBase",t.kilos_extra "kilosExtra",
      t.costo_kilos_extra "costoKilosExtra",t.costo_descargue "costoDescargue",
      t.costo_desvio "costoDesvio",t.costo_original "costoOriginal",
      t.costo_ajustes "costoAjustes",t.revisiones_costo "revisionesCosto",
      coalesce(adj.new_items,'[]'::jsonb) "ajustesCosto",
      t.total_viaje "totalViaje",t.observaciones,t.estado_entrega "estadoEntrega",
      t.vehiculo_placa "vehiculoPlaca",t.conductor,t.hora_salida "horaSalida",
      t.hora_retorno "horaRetorno",t.estado_viaje "estadoViaje",t.created_at,
      o.order_number "orderNumber",o.client_name "clientName"
    from public.viajes_despacho t
    join erp_supply.orders o on o.id=t.order_id
    left join lateral(
      select a.new_items
      from public.viajes_despacho_ajustes_costo a
      where a.trip_id=t.id and a.organization_id=v_org
      order by a.revision_number desc
      limit 1
    ) adj on true
    where t.organization_id=v_org
      and t.fecha between v_from and v_to
      and(v_destination is null or t.ciudad_destino=v_destination)
    order by t.fecha desc,t.created_at desc
    offset(v_page-1)*v_size limit v_size
  )q;

  select jsonb_build_object(
    'tripCount',count(*),
    'deliveredCount',count(*) filter(where estado_entrega='ENTREGADO'),
    'notDeliveredCount',count(*) filter(where estado_entrega='NO ENTREGADO'),
    'pendingCount',count(*) filter(where estado_entrega='PENDIENTE'),
    'closedTotal',coalesce(sum(case when estado_entrega='ENTREGADO' then total_viaje else 0 end),0),
    'estimatedTotal',coalesce(sum(total_viaje),0),
    'adjustmentTotal',coalesce(sum(costo_ajustes),0)
  )
  into v_metrics
  from public.viajes_despacho t
  where t.organization_id=v_org
    and t.fecha between v_from and v_to
    and(v_destination is null or t.ciudad_destino=v_destination);

  return jsonb_build_object(
    'items',v_items,
    'metrics',v_metrics,
    'canUpdate',v_can_update,
    'pagination',jsonb_build_object(
      'page',v_page,'pageSize',v_size,'totalItems',v_total,
      'totalPages',greatest(1,ceil(v_total::numeric/v_size)::int)
    ),
    'filters',jsonb_build_object('dateFrom',v_from,'dateTo',v_to,'destination',v_destination),
    'version','11.46.0'
  );
end;
$$;

create or replace function public.erp_x_local_dispatch_return(p_trip_id uuid,p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid:=erp_supply.require_profile();
  v_org uuid:=erp_supply.current_org_id();
  v_trip public.viajes_despacho%rowtype;
  v_delivery erp_supply.deliveries%rowtype;
  v_order erp_supply.orders%rowtype;
  v_status text:=upper(trim(coalesce(p_payload->>'estadoEntrega','')));
  v_notes text:=nullif(trim(p_payload->>'observaciones'),'');
begin
  if not(erp_supply.can_access_module('shipping','update') or erp_supply.has_role('super_admin')) then
    raise exception 'No autorizado para registrar el retorno' using errcode='42501';
  end if;
  if v_status not in('ENTREGADO','NO ENTREGADO') then
    raise exception 'Estado de entrega inválido';
  end if;

  select * into v_trip
  from public.viajes_despacho
  where id=p_trip_id and organization_id=v_org
  for update;

  if not found then
    raise exception 'Viaje local no disponible' using errcode='42501';
  end if;

  update public.viajes_despacho
  set updated_at=now(),
      updated_by=v_actor,
      estado_entrega=v_status,
      observaciones=v_notes,
      hora_retorno=now(),
      estado_viaje='RETORNADO'
  where id=v_trip.id
  returning * into v_trip;

  select * into v_order
  from erp_supply.orders
  where id=v_trip.order_id and organization_id=v_org;

  if v_trip.delivery_id is not null then
    select * into v_delivery
    from erp_supply.deliveries
    where id=v_trip.delivery_id
    for update;

    if found then
      update erp_supply.deliveries
      set status=case when v_status='ENTREGADO' then 'DELIVERED' else 'REPROGRAMMED' end,
          delivered_at=case when v_status='ENTREGADO' then coalesce(delivered_at,now()) else null end,
          no_delivery_reason=case when v_status='NO ENTREGADO' then coalesce(v_notes,'Viaje local marcado como no entregado') else null end,
          carrier_cost=v_trip.total_viaje,
          metadata=coalesce(metadata,'{}'::jsonb)
            || jsonb_build_object(
              'localDispatch',
              coalesce(metadata->'localDispatch','{}'::jsonb)
              || jsonb_build_object(
                'deliveryStatus',v_status,
                'totalTrip',v_trip.total_viaje,
                'observations',v_notes,
                'returnedAt',now()
              )
            ),
          updated_at=now()
      where id=v_delivery.id
      returning * into v_delivery;
    end if;
  end if;

  insert into erp_supply.delivery_milestones(
    organization_id,order_id,task_id,delivery_id,milestone_code,actor_profile_id,metadata
  )
  values(
    v_org,v_trip.order_id,v_trip.task_id,v_trip.delivery_id,'LOCAL_RETURN_RECORDED',v_actor,
    jsonb_build_object('tripId',v_trip.id,'deliveryStatus',v_status,'totalTrip',v_trip.total_viaje)
  );

  insert into erp_supply.order_events(
    organization_id,order_id,task_id,event_type,action_code,
    from_step_code,to_step_code,from_status,to_status,
    actor_profile_id,actor_role_code,payload
  )
  values(
    v_org,v_trip.order_id,v_trip.task_id,'DOMAIN_RECORD','LOCAL_DISPATCH_RETURN',
    v_order.current_step_code,v_order.current_step_code,v_order.status,v_order.status,
    v_actor,(erp_supply.current_roles())[1],
    jsonb_build_object(
      'tripId',v_trip.id,
      'deliveryStatus',v_status,
      'totalTrip',v_trip.total_viaje,
      'observations',v_notes
    )
  );

  return jsonb_build_object(
    'success',true,
    'trip',to_jsonb(v_trip),
    'delivery',case when v_delivery.id is null then null else to_jsonb(v_delivery) end,
    'version','11.46.0'
  );
end;
$$;

revoke all on function public.erp_x_local_dispatch_cost_detail(uuid) from public,anon;
revoke all on function public.erp_x_local_dispatch_cost_adjust(uuid,jsonb) from public,anon;
revoke all on function public.erp_x_local_dispatch_trips(date,date,text,integer,integer) from public,anon;
revoke all on function public.erp_x_local_dispatch_return(uuid,jsonb) from public,anon;

grant execute on function public.erp_x_local_dispatch_cost_detail(uuid) to authenticated;
grant execute on function public.erp_x_local_dispatch_cost_adjust(uuid,jsonb) to authenticated;
grant execute on function public.erp_x_local_dispatch_trips(date,date,text,integer,integer) to authenticated;
grant execute on function public.erp_x_local_dispatch_return(uuid,jsonb) to authenticated;

comment on table public.viajes_despacho_ajustes_costo is
  'V11.46.0: historial inmutable de hasta tres revisiones justificadas del costo logístico de cada despacho local.';

notify pgrst,'reload schema';
commit;
