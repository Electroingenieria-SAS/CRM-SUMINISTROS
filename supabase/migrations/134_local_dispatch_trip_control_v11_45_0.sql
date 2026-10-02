begin;

create table if not exists public.viajes_despacho (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organization_id uuid not null references erp_supply.organizations(id),
  order_id uuid not null references erp_supply.orders(id) on delete cascade,
  task_id uuid not null references erp_supply.order_tasks(id) on delete cascade,
  delivery_id uuid null references erp_supply.deliveries(id) on delete set null,
  registered_by uuid not null references erp_supply.profiles(id),
  updated_by uuid null references erp_supply.profiles(id),
  fecha date not null default current_date,
  numero_factura text null,
  ciudad_destino text not null,
  peso_kg numeric not null default 0 check(peso_kg>=0),
  tarifa_base numeric not null default 0 check(tarifa_base>=0),
  kilos_extra numeric not null default 0 check(kilos_extra>=0),
  costo_kilos_extra numeric not null default 0 check(costo_kilos_extra>=0),
  costo_descargue numeric not null default 0 check(costo_descargue>=0),
  costo_desvio numeric not null default 0 check(costo_desvio>=0),
  total_viaje numeric not null default 0 check(total_viaje>=0),
  observaciones text null,
  sucursal text null default 'D0604',
  estado_entrega text not null default 'PENDIENTE' check(estado_entrega in('PENDIENTE','ENTREGADO','NO ENTREGADO')),
  vehiculo_placa text null,
  conductor text null,
  hora_salida timestamptz null,
  hora_retorno timestamptz null,
  estado_viaje text not null default 'DESPACHADO' check(estado_viaje in('DESPACHADO','RETORNADO')),
  constraint viajes_despacho_task_key unique(task_id)
);
create index if not exists idx_viajes_despacho_org_fecha on public.viajes_despacho(organization_id,fecha desc);
create index if not exists idx_viajes_despacho_order on public.viajes_despacho(order_id,created_at desc);
create index if not exists idx_viajes_despacho_destino on public.viajes_despacho(organization_id,ciudad_destino,fecha desc);
alter table public.viajes_despacho enable row level security;
revoke all on table public.viajes_despacho from anon,authenticated;

create table if not exists erp_supply.local_dispatch_tariffs(
  destination_code text primary key,
  zone_code text not null,
  base_cost numeric not null check(base_cost>=0),
  extra_per_kg numeric not null default 0 check(extra_per_kg>=0),
  limit_kg numeric not null default 1000 check(limit_kg>0),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table erp_supply.local_dispatch_tariffs enable row level security;
revoke all on table erp_supply.local_dispatch_tariffs from anon,authenticated;
insert into erp_supply.local_dispatch_tariffs(destination_code,zone_code,base_cost,extra_per_kg,limit_kg,active) values
('URBANO','URBANO_LOCAL',30000,0,1000,true),
('RURAL','URBANO_LOCAL',50000,0,1000,true),
('ANDALUCIA','NORTE_VALLE',50000,400,1000,true),
('BUGALAGRANDE','NORTE_VALLE',50000,400,1000,true),
('CAMP. LA LUISA','NORTE_VALLE',50000,400,1000,true),
('NESTLE','NORTE_VALLE',60000,400,1000,true),
('RIO FRIO','NORTE_VALLE',60000,400,1000,true),
('LA MARINA','NORTE_VALLE',70000,400,1000,true),
('EL OVERO','NORTE_VALLE',80000,400,1000,true),
('BOLIVAR','NORTE_VALLE',140000,400,1000,true),
('ING. RIO PAILA','NORTE_VALLE',140000,400,1000,true),
('LA PAILA','NORTE_VALLE',140000,400,1000,true),
('ZARZAL','NORTE_VALLE',150000,400,1000,true),
('ROLDANILLO','NORTE_VALLE',160000,400,1000,true),
('LA UNION','NORTE_VALLE',200000,400,1000,true),
('LA VICTORIA','NORTE_VALLE',200000,400,1000,true),
('SEVILLA','NORTE_VALLE',200000,400,1000,true),
('CARTAGO','NORTE_VALLE',240000,400,1000,true),
('CAICEDONIA','NORTE_VALLE',260000,400,1000,true),
('TRUJILLO','OCCIDENTE',120000,400,1000,true),
('SALONICA','OCCIDENTE',120000,400,1000,true),
('MEDIA CANOA','OCCIDENTE',120000,400,1000,true),
('FENICIA','OCCIDENTE',170000,400,1000,true),
('ING. CARMELITA','OCCIDENTE',80000,400,1000,true),
('POR.PIEDRAS','OCCIDENTE',80000,400,1000,true),
('YOTOCO','OCCIDENTE',160000,400,1000,true),
('CALIMA','OCCIDENTE',180000,400,1000,true),
('RESTREPO','OCCIDENTE',180000,400,1000,true),
('ING. SAN CARLOS','SUR',70000,400,1000,true),
('SAN PEDRO','SUR',60000,400,1000,true),
('SAN JOSE','SUR',60000,400,1000,true),
('PRESIDENTE','SUR',70000,400,1000,true),
('TODOS LOS SANTOS','SUR',120000,400,1000,true),
('BUGA','SUR',140000,400,1000,true),
('LA HABANA','SUR',190000,400,1000,true),
('OBANDO','SUR',160000,400,1000,true),
('ING. PICHICHI','SUR',190000,400,1000,true),
('GINEBRA','SUR',190000,400,1000,true),
('PALMIRA','SUR',250000,400,1000,true),
('YUMBO','SUR',350000,400,1000,true),
('CALI NORTE','SUR',350000,400,1000,true),
('CALI SUR','SUR',450000,400,1000,true),
('JAMUNDI','SUR',450000,400,1000,true),
('ING. CASTILLA','SUR',350000,400,1000,true),
('CANDELARIA','SUR',350000,400,1000,true),
('FLORIDA','SUR',350000,400,1000,true),
('ING. MAYAGUEZ','SUR',350000,400,1000,true),
('ARMENIA','EJE_CAFETERO',400000,600,1000,true),
('PUEBLO TAPADO','EJE_CAFETERO',350000,600,1000,true),
('MONTENEGRO','EJE_CAFETERO',350000,600,1000,true),
('QUIMBAYA','EJE_CAFETERO',350000,600,1000,true),
('FILANDIA','EJE_CAFETERO',420000,600,1000,true),
('SALENTO','EJE_CAFETERO',420000,600,1000,true),
('PEREIRA','EJE_CAFETERO',400000,600,1000,true),
('DOSQUEBRADAS','EJE_CAFETERO',450000,600,1000,true),
('SANTA ROSA','EJE_CAFETERO',500000,600,1000,true),
('CHINCHINA','EJE_CAFETERO',500000,600,1000,true),
('VILLAMARIA','EJE_CAFETERO',600000,600,1000,true),
('MANIZALES','EJE_CAFETERO',700000,600,1000,true),
('POPAYAN','EJE_CAFETERO',800000,600,1000,true)
on conflict(destination_code) do update set zone_code=excluded.zone_code,base_cost=excluded.base_cost,extra_per_kg=excluded.extra_per_kg,limit_kg=excluded.limit_kg,active=excluded.active,updated_at=now();

create or replace function public.erp_x_local_dispatch_save(p_order_id uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 v_actor uuid:=erp_supply.require_profile();v_org uuid:=erp_supply.current_org_id();
 v_order erp_supply.orders%rowtype;v_task erp_supply.order_tasks%rowtype;v_delivery erp_supply.deliveries%rowtype;
 v_trip public.viajes_despacho%rowtype;v_tariff erp_supply.local_dispatch_tariffs%rowtype;
 v_city text:=upper(trim(coalesce(p_payload->>'ciudadDestino','')));v_invoice text:=nullif(trim(p_payload->>'numeroFactura'),'');
 v_branch text:=nullif(trim(p_payload->>'sucursal'),'');v_plate text:=upper(nullif(trim(p_payload->>'vehiculoPlaca'),''));
 v_driver text:=nullif(trim(p_payload->>'conductor'),'');v_notes text:=nullif(trim(p_payload->>'observaciones'),'');
 v_weight numeric:=greatest(0,coalesce(erp_supply.safe_numeric(p_payload->>'pesoKg'),0));
 v_unloading numeric:=greatest(0,coalesce(erp_supply.safe_numeric(p_payload->>'costoDescargue'),0));
 v_diversion numeric:=greatest(0,coalesce(erp_supply.safe_numeric(p_payload->>'costoDesvio'),0));
 v_extra_kg numeric;v_extra_cost numeric;v_total numeric;v_date date;v_tracking text;v_destination jsonb;
begin
 if not(erp_supply.can_access_module('shipping','update') or erp_supply.has_role('super_admin')) then raise exception 'No autorizado para gestionar despachos locales' using errcode='42501';end if;
 if v_city='' then raise exception 'Destino tarifario requerido';end if;
 if v_invoice is null then raise exception 'Número de factura requerido';end if;
 if v_branch is null then raise exception 'Sucursal requerida';end if;
 if v_plate is null then raise exception 'Placa del vehículo requerida';end if;
 if v_driver is null then raise exception 'Conductor requerido';end if;
 if v_weight<=0 then raise exception 'Peso total requerido';end if;
 v_date:=case when nullif(trim(coalesce(p_payload->>'fecha','')),'') is null then current_date else (p_payload->>'fecha')::date end;

 select * into v_order from erp_supply.orders where id=p_order_id and organization_id=v_org for update;
 if not found or v_order.current_step_code<>'LOCAL_DISPATCH' then raise exception 'El pedido no está en Despacho local';end if;
 select * into v_task from erp_supply.order_tasks where order_id=p_order_id and step_code='LOCAL_DISPATCH' and status in('QUEUED','ASSIGNED','IN_PROGRESS','WAITING','BLOCKED') order by sequence_no desc,created_at desc limit 1 for update;
 if not found or v_task.status<>'IN_PROGRESS' then raise exception 'Primero debes tomar el pedido';end if;
 if v_task.assigned_profile_id is distinct from v_actor and not(erp_supply.has_role('super_admin') or erp_supply.has_role('jefe_logistica')) then raise exception 'El pedido está asignado a otra persona' using errcode='42501';end if;

 select * into v_tariff from erp_supply.local_dispatch_tariffs where destination_code=v_city and active;
 if not found then raise exception 'El destino no tiene una tarifa local activa';end if;
 v_extra_kg:=greatest(0,v_weight-v_tariff.limit_kg);v_extra_cost:=v_extra_kg*v_tariff.extra_per_kg;v_total:=v_tariff.base_cost+v_extra_cost+v_unloading+v_diversion;

 insert into public.viajes_despacho(organization_id,order_id,task_id,registered_by,updated_by,fecha,numero_factura,sucursal,ciudad_destino,peso_kg,tarifa_base,kilos_extra,costo_kilos_extra,costo_descargue,costo_desvio,total_viaje,observaciones,estado_entrega,vehiculo_placa,conductor,hora_salida,estado_viaje)
 values(v_org,p_order_id,v_task.id,v_actor,v_actor,v_date,v_invoice,v_branch,v_city,v_weight,v_tariff.base_cost,v_extra_kg,v_extra_cost,v_unloading,v_diversion,v_total,v_notes,'PENDIENTE',v_plate,v_driver,now(),'DESPACHADO')
 on conflict(task_id) do update set updated_at=now(),updated_by=v_actor,fecha=excluded.fecha,numero_factura=excluded.numero_factura,sucursal=excluded.sucursal,ciudad_destino=excluded.ciudad_destino,peso_kg=excluded.peso_kg,tarifa_base=excluded.tarifa_base,kilos_extra=excluded.kilos_extra,costo_kilos_extra=excluded.costo_kilos_extra,costo_descargue=excluded.costo_descargue,costo_desvio=excluded.costo_desvio,total_viaje=excluded.total_viaje,observaciones=excluded.observaciones,vehiculo_placa=excluded.vehiculo_placa,conductor=excluded.conductor,hora_salida=coalesce(public.viajes_despacho.hora_salida,excluded.hora_salida)
 returning * into v_trip;

 v_tracking:='LOCAL-'||regexp_replace(v_order.order_number,'[^A-Za-z0-9]+','','g')||'-'||right(replace(v_task.id::text,'-',''),6);
 v_destination:=jsonb_strip_nulls(jsonb_build_object('country',coalesce(nullif(v_order.metadata->>'clientCountry',''),'Colombia'),'department',nullif(v_order.metadata->>'clientDepartment',''),'municipality',coalesce(nullif(v_order.metadata->>'clientCity',''),nullif(v_order.client_city,''),v_city),'address',coalesce(nullif(v_order.metadata->>'clientAddress',''),nullif(v_order.client_address,'')),'source','SALES_ORDER_ADDRESS'));
 select * into v_delivery from erp_supply.deliveries where order_id=p_order_id and status<>'CANCELLED' order by created_at desc limit 1 for update;

 if not found then
  insert into erp_supply.deliveries(order_id,route_code,status,carrier,tracking_number,assigned_profile_id,carrier_invoice_number,carrier_cost,carrier_cost_currency,carrier_cost_recorded_by,carrier_cost_recorded_at,metadata)
  values(p_order_id,'LOCAL_DISPATCH','PLANNED','VEHÍCULO LOCAL',v_tracking,v_actor,v_invoice,v_total,'COP',v_actor,now(),jsonb_build_object('taskId',v_task.id,'destination',v_destination,'localDispatch',jsonb_build_object('tripId',v_trip.id,'date',v_trip.fecha,'invoiceNumber',v_invoice,'branch',v_branch,'cityDestination',v_city,'weightKg',v_weight,'tariffBase',v_tariff.base_cost,'extraKg',v_extra_kg,'extraCost',v_extra_cost,'unloadingCost',v_unloading,'diversionCost',v_diversion,'totalTrip',v_total,'vehiclePlate',v_plate,'driverName',v_driver,'observations',v_notes,'deliveryStatus','PENDIENTE')))
  returning * into v_delivery;
 else
  update erp_supply.deliveries set route_code='LOCAL_DISPATCH',carrier='VEHÍCULO LOCAL',tracking_number=v_tracking,assigned_profile_id=v_actor,carrier_invoice_number=v_invoice,carrier_cost=v_total,carrier_cost_currency='COP',carrier_cost_recorded_by=v_actor,carrier_cost_recorded_at=now(),metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('taskId',v_task.id,'destination',v_destination,'localDispatch',jsonb_build_object('tripId',v_trip.id,'date',v_trip.fecha,'invoiceNumber',v_invoice,'branch',v_branch,'cityDestination',v_city,'weightKg',v_weight,'tariffBase',v_tariff.base_cost,'extraKg',v_extra_kg,'extraCost',v_extra_cost,'unloadingCost',v_unloading,'diversionCost',v_diversion,'totalTrip',v_total,'vehiclePlate',v_plate,'driverName',v_driver,'observations',v_notes,'deliveryStatus',v_trip.estado_entrega)),updated_at=now()
  where id=v_delivery.id returning * into v_delivery;
 end if;
 update public.viajes_despacho set delivery_id=v_delivery.id where id=v_trip.id returning * into v_trip;
 insert into erp_supply.delivery_milestones(organization_id,order_id,task_id,delivery_id,milestone_code,actor_profile_id,metadata) values(v_org,p_order_id,v_task.id,v_delivery.id,'LOCAL_LOAD_REGISTERED',v_actor,jsonb_build_object('tripId',v_trip.id,'vehiclePlate',v_plate,'driverName',v_driver,'weightKg',v_weight,'totalTrip',v_total));
 insert into erp_supply.order_events(organization_id,order_id,task_id,event_type,action_code,from_step_code,to_step_code,from_status,to_status,actor_profile_id,actor_role_code,payload) values(v_org,p_order_id,v_task.id,'DOMAIN_RECORD','LOCAL_DISPATCH_TRIP',v_order.current_step_code,v_order.current_step_code,v_order.status,v_order.status,v_actor,(erp_supply.current_roles())[1],jsonb_build_object('tripId',v_trip.id,'destination',v_city,'vehiclePlate',v_plate,'weightKg',v_weight,'totalTrip',v_total));
 return jsonb_build_object('success',true,'trip',to_jsonb(v_trip),'delivery',to_jsonb(v_delivery),'version','11.45.0');
end;$$;

create or replace function public.erp_x_local_dispatch_trips(p_date_from date default null,p_date_to date default null,p_destination text default null,p_page integer default 1,p_page_size integer default 100)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 v_actor uuid:=erp_supply.require_profile();v_org uuid:=erp_supply.current_org_id();v_from date:=coalesce(p_date_from,current_date);v_to date:=coalesce(p_date_to,p_date_from,current_date);v_destination text:=nullif(upper(trim(coalesce(p_destination,''))),'');v_page integer:=greatest(1,coalesce(p_page,1));v_size integer:=least(500,greatest(1,coalesce(p_page_size,100)));v_total bigint;v_items jsonb;v_metrics jsonb;v_can_update boolean;
begin
 if not(erp_supply.can_access_module('shipping','read') or erp_supply.has_role('super_admin')) then raise exception 'No autorizado para consultar despachos locales' using errcode='42501';end if;
 if v_from>v_to then raise exception 'Rango de fechas inválido';end if;
 v_can_update:=erp_supply.can_access_module('shipping','update') or erp_supply.has_role('super_admin');
 select count(*) into v_total from public.viajes_despacho t where t.organization_id=v_org and t.fecha between v_from and v_to and(v_destination is null or t.ciudad_destino=v_destination);
 select coalesce(jsonb_agg(to_jsonb(q) order by q.fecha desc,q.created_at desc),'[]'::jsonb) into v_items from(
  select t.id,t.fecha,t.numero_factura "numeroFactura",t.sucursal,t.ciudad_destino "ciudadDestino",t.peso_kg "pesoKg",t.tarifa_base "tarifaBase",t.kilos_extra "kilosExtra",t.costo_kilos_extra "costoKilosExtra",t.costo_descargue "costoDescargue",t.costo_desvio "costoDesvio",t.total_viaje "totalViaje",t.observaciones,t.estado_entrega "estadoEntrega",t.vehiculo_placa "vehiculoPlaca",t.conductor,t.hora_salida "horaSalida",t.hora_retorno "horaRetorno",t.estado_viaje "estadoViaje",t.created_at,o.order_number "orderNumber",o.client_name "clientName"
  from public.viajes_despacho t join erp_supply.orders o on o.id=t.order_id
  where t.organization_id=v_org and t.fecha between v_from and v_to and(v_destination is null or t.ciudad_destino=v_destination)
  order by t.fecha desc,t.created_at desc offset(v_page-1)*v_size limit v_size
 )q;
 select jsonb_build_object('tripCount',count(*),'deliveredCount',count(*) filter(where estado_entrega='ENTREGADO'),'notDeliveredCount',count(*) filter(where estado_entrega='NO ENTREGADO'),'pendingCount',count(*) filter(where estado_entrega='PENDIENTE'),'closedTotal',coalesce(sum(case when estado_entrega='ENTREGADO' then total_viaje else 0 end),0),'estimatedTotal',coalesce(sum(total_viaje),0)) into v_metrics
 from public.viajes_despacho t where t.organization_id=v_org and t.fecha between v_from and v_to and(v_destination is null or t.ciudad_destino=v_destination);
 return jsonb_build_object('items',v_items,'metrics',v_metrics,'canUpdate',v_can_update,'pagination',jsonb_build_object('page',v_page,'pageSize',v_size,'totalItems',v_total,'totalPages',greatest(1,ceil(v_total::numeric/v_size)::int)),'filters',jsonb_build_object('dateFrom',v_from,'dateTo',v_to,'destination',v_destination),'version','11.45.0');
end;$$;

create or replace function public.erp_x_local_dispatch_return(p_trip_id uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 v_actor uuid:=erp_supply.require_profile();v_org uuid:=erp_supply.current_org_id();v_trip public.viajes_despacho%rowtype;v_delivery erp_supply.deliveries%rowtype;v_order erp_supply.orders%rowtype;
 v_status text:=upper(trim(coalesce(p_payload->>'estadoEntrega','')));v_unloading numeric:=greatest(0,coalesce(erp_supply.safe_numeric(p_payload->>'costoDescargue'),0));v_diversion numeric:=greatest(0,coalesce(erp_supply.safe_numeric(p_payload->>'costoDesvio'),0));v_notes text:=nullif(trim(p_payload->>'observaciones'),'');v_total numeric;
begin
 if not(erp_supply.can_access_module('shipping','update') or erp_supply.has_role('super_admin')) then raise exception 'No autorizado para registrar el retorno' using errcode='42501';end if;
 if v_status not in('ENTREGADO','NO ENTREGADO') then raise exception 'Estado de entrega inválido';end if;
 select * into v_trip from public.viajes_despacho where id=p_trip_id and organization_id=v_org for update;
 if not found then raise exception 'Viaje local no disponible' using errcode='42501';end if;
 v_total:=v_trip.tarifa_base+v_trip.costo_kilos_extra+v_unloading+v_diversion;
 update public.viajes_despacho set updated_at=now(),updated_by=v_actor,estado_entrega=v_status,costo_descargue=v_unloading,costo_desvio=v_diversion,total_viaje=v_total,observaciones=v_notes,hora_retorno=now(),estado_viaje='RETORNADO' where id=v_trip.id returning * into v_trip;
 select * into v_order from erp_supply.orders where id=v_trip.order_id and organization_id=v_org;
 select * into v_delivery from erp_supply.deliveries where id=v_trip.delivery_id for update;
 if found then
  update erp_supply.deliveries set status=case when v_status='ENTREGADO' then 'DELIVERED' else 'REPROGRAMMED' end,delivered_at=case when v_status='ENTREGADO' then coalesce(delivered_at,now()) else null end,no_delivery_reason=case when v_status='NO ENTREGADO' then coalesce(v_notes,'Viaje local marcado como no entregado') else null end,carrier_cost=v_total,metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('localDispatch',coalesce(metadata->'localDispatch','{}'::jsonb)||jsonb_build_object('deliveryStatus',v_status,'unloadingCost',v_unloading,'diversionCost',v_diversion,'totalTrip',v_total,'observations',v_notes,'returnedAt',now())),updated_at=now()
  where id=v_delivery.id returning * into v_delivery;
 end if;
 insert into erp_supply.delivery_milestones(organization_id,order_id,task_id,delivery_id,milestone_code,actor_profile_id,metadata) values(v_org,v_trip.order_id,v_trip.task_id,v_trip.delivery_id,'LOCAL_RETURN_RECORDED',v_actor,jsonb_build_object('tripId',v_trip.id,'deliveryStatus',v_status,'totalTrip',v_total));
 insert into erp_supply.order_events(organization_id,order_id,task_id,event_type,action_code,from_step_code,to_step_code,from_status,to_status,actor_profile_id,actor_role_code,payload) values(v_org,v_trip.order_id,v_trip.task_id,'DOMAIN_RECORD','LOCAL_DISPATCH_RETURN',v_order.current_step_code,v_order.current_step_code,v_order.status,v_order.status,v_actor,(erp_supply.current_roles())[1],jsonb_build_object('tripId',v_trip.id,'deliveryStatus',v_status,'totalTrip',v_total,'observations',v_notes));
 return jsonb_build_object('success',true,'trip',to_jsonb(v_trip),'delivery',case when v_delivery.id is null then null else to_jsonb(v_delivery) end,'version','11.45.0');
end;$$;

revoke all on function public.erp_x_local_dispatch_save(uuid,jsonb) from public,anon;
revoke all on function public.erp_x_local_dispatch_trips(date,date,text,integer,integer) from public,anon;
revoke all on function public.erp_x_local_dispatch_return(uuid,jsonb) from public,anon;
grant execute on function public.erp_x_local_dispatch_save(uuid,jsonb) to authenticated;
grant execute on function public.erp_x_local_dispatch_trips(date,date,text,integer,integer) to authenticated;
grant execute on function public.erp_x_local_dispatch_return(uuid,jsonb) to authenticated;
comment on table public.viajes_despacho is 'V11.45.0: cargue, liquidación y retorno de vehículos para Despacho local, vinculado al pedido y tarea CRM.';
comment on table erp_supply.local_dispatch_tariffs is 'V11.45.0: matriz tarifaria autoritativa de despachos locales.';
notify pgrst,'reload schema';
commit;
