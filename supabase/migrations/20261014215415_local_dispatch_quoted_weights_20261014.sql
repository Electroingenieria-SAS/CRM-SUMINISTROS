-- Alignment with uploaded local tariff CSV, maintaining the original RBAC, trip rows, and audit workflow.
-- Replaces only calculation/validation logic from the existing save RPC.
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
 -- Preserve earlier trip calculations; enforce supplied CSV's upper boundary and whole-chargeable-kg rule for new routes.
 if v_tariff.source_version='LUIS_IBARRA_CSV_2026_10_14' then
   if (v_unloading+v_diversion)>0 and length(btrim(coalesce(v_notes,'')))<8 then
     raise exception 'Explica en observaciones por qué se requiere auxiliar o desvío' using errcode='22023';
   end if;
   if v_weight>coalesce(v_tariff.max_weight_kg,2500) then
     raise exception 'La ruta local solo tiene tarifa hasta 2.500 kg; solicita valor especial' using errcode='22023';
   end if;
   v_extra_kg:=greatest(0,ceil(v_weight-v_tariff.limit_kg));
   v_extra_cost:=round(v_extra_kg*v_tariff.extra_per_kg,0);
 else
   v_extra_kg:=greatest(0,v_weight-v_tariff.limit_kg);
   v_extra_cost:=v_extra_kg*v_tariff.extra_per_kg;
 end if;
 v_total:=v_tariff.base_cost+v_extra_cost+v_unloading+v_diversion;

 insert into public.viajes_despacho(organization_id,order_id,task_id,registered_by,updated_by,fecha,numero_factura,sucursal,ciudad_destino,peso_kg,tarifa_base,kilos_extra,costo_kilos_extra,costo_descargue,costo_desvio,total_viaje,observaciones,estado_entrega,vehiculo_placa,conductor,hora_salida,estado_viaje)
 values(v_org,p_order_id,v_task.id,v_actor,v_actor,v_date,v_invoice,v_branch,v_city,v_weight,v_tariff.base_cost,v_extra_kg,v_extra_cost,v_unloading,v_diversion,v_total,v_notes,'PENDIENTE',v_plate,v_driver,now(),'DESPACHADO')
 on conflict(task_id) do update set updated_at=now(),updated_by=v_actor,fecha=excluded.fecha,numero_factura=excluded.numero_factura,sucursal=excluded.sucursal,ciudad_destino=excluded.ciudad_destino,peso_kg=excluded.peso_kg,tarifa_base=excluded.tarifa_base,kilos_extra=excluded.kilos_extra,costo_kilos_extra=excluded.costo_kilos_extra,costo_descargue=excluded.costo_descargue,costo_desvio=excluded.costo_desvio,total_viaje=excluded.total_viaje,observaciones=excluded.observaciones,vehiculo_placa=excluded.vehiculo_placa,conductor=excluded.conductor,hora_salida=coalesce(public.viajes_despacho.hora_salida,excluded.hora_salida)
 returning * into v_trip;

 v_tracking:='LOCAL-'||regexp_replace(v_order.order_number,'[^A-Za-z0-9]+','','g')||'-'||right(replace(v_task.id::text,'-',''),6);
 v_destination:=jsonb_strip_nulls(jsonb_build_object('country',coalesce(nullif(v_order.metadata->>'clientCountry',''),'Colombia'),'department',nullif(v_order.metadata->>'clientDepartment',''),'municipality',coalesce(nullif(v_order.metadata->>'clientCity',''),nullif(v_order.client_city,''),v_city),'address',coalesce(nullif(v_order.metadata->>'clientAddress',''),nullif(v_order.client_address,'')),'source','SALES_ORDER_ADDRESS'));
 select * into v_delivery from erp_supply.deliveries where order_id=p_order_id and status<>'CANCELLED' order by created_at desc limit 1 for update;

 if not found then
  insert into erp_supply.deliveries(order_id,route_code,status,carrier,tracking_number,assigned_profile_id,carrier_invoice_number,carrier_cost,carrier_cost_currency,carrier_cost_recorded_by,carrier_cost_recorded_at,metadata)
  values(p_order_id,'LOCAL_DISPATCH','PLANNED','VEHÍCULO LOCAL',v_tracking,v_actor,v_invoice,v_total,'COP',v_actor,now(),jsonb_build_object('taskId',v_task.id,'destination',v_destination,'localDispatch',jsonb_build_object('tripId',v_trip.id,'tariffVersion',v_tariff.source_version,'date',v_trip.fecha,'invoiceNumber',v_invoice,'branch',v_branch,'cityDestination',v_city,'weightKg',v_weight,'tariffBase',v_tariff.base_cost,'extraKg',v_extra_kg,'extraCost',v_extra_cost,'unloadingCost',v_unloading,'diversionCost',v_diversion,'totalTrip',v_total,'vehiclePlate',v_plate,'driverName',v_driver,'observations',v_notes,'deliveryStatus','PENDIENTE')))
  returning * into v_delivery;
 else
  update erp_supply.deliveries set route_code='LOCAL_DISPATCH',carrier='VEHÍCULO LOCAL',tracking_number=v_tracking,assigned_profile_id=v_actor,carrier_invoice_number=v_invoice,carrier_cost=v_total,carrier_cost_currency='COP',carrier_cost_recorded_by=v_actor,carrier_cost_recorded_at=now(),metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('taskId',v_task.id,'destination',v_destination,'localDispatch',jsonb_build_object('tripId',v_trip.id,'tariffVersion',v_tariff.source_version,'date',v_trip.fecha,'invoiceNumber',v_invoice,'branch',v_branch,'cityDestination',v_city,'weightKg',v_weight,'tariffBase',v_tariff.base_cost,'extraKg',v_extra_kg,'extraCost',v_extra_cost,'unloadingCost',v_unloading,'diversionCost',v_diversion,'totalTrip',v_total,'vehiclePlate',v_plate,'driverName',v_driver,'observations',v_notes,'deliveryStatus',v_trip.estado_entrega)),updated_at=now()
  where id=v_delivery.id returning * into v_delivery;
 end if;
 update public.viajes_despacho set delivery_id=v_delivery.id where id=v_trip.id returning * into v_trip;
 insert into erp_supply.delivery_milestones(organization_id,order_id,task_id,delivery_id,milestone_code,actor_profile_id,metadata) values(v_org,p_order_id,v_task.id,v_delivery.id,'LOCAL_LOAD_REGISTERED',v_actor,jsonb_build_object('tripId',v_trip.id,'vehiclePlate',v_plate,'driverName',v_driver,'weightKg',v_weight,'totalTrip',v_total));
 insert into erp_supply.order_events(organization_id,order_id,task_id,event_type,action_code,from_step_code,to_step_code,from_status,to_status,actor_profile_id,actor_role_code,payload) values(v_org,p_order_id,v_task.id,'DOMAIN_RECORD','LOCAL_DISPATCH_TRIP',v_order.current_step_code,v_order.current_step_code,v_order.status,v_order.status,v_actor,(erp_supply.current_roles())[1],jsonb_build_object('tripId',v_trip.id,'destination',v_city,'vehiclePlate',v_plate,'weightKg',v_weight,'totalTrip',v_total));
 return jsonb_build_object('success',true,'trip',to_jsonb(v_trip),'delivery',to_jsonb(v_delivery),'version','11.45.0');
end;$$;
revoke all on function public.erp_x_local_dispatch_save(uuid,jsonb) from public,anon;
grant execute on function public.erp_x_local_dispatch_save(uuid,jsonb) to authenticated;
