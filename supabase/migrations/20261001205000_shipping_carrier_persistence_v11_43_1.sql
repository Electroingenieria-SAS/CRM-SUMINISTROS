create or replace function public.erp_x_shipping_save_guide(p_order_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = erp_supply, public, auth, pg_catalog
as $$
declare
  v_actor uuid:=erp_supply.require_profile();
  v_org uuid:=erp_supply.current_org_id();
  v_order erp_supply.orders%rowtype;
  v_task erp_supply.order_tasks%rowtype;
  v_delivery erp_supply.deliveries%rowtype;

  v_has_tracking boolean:=p_payload ? 'trackingNumber';
  v_has_carrier boolean:=p_payload ? 'carrier';
  v_has_invoice boolean:=p_payload ? 'carrierInvoiceNumber';
  v_has_cost boolean:=p_payload ? 'carrierCost';
  v_has_currency boolean:=p_payload ? 'carrierCostCurrency';

  v_tracking_input text:=nullif(trim(p_payload->>'trackingNumber'),'');
  v_carrier_input text:=nullif(trim(p_payload->>'carrier'),'');
  v_invoice_input text:=nullif(trim(p_payload->>'carrierInvoiceNumber'),'');
  v_cost_input numeric:=case when p_payload ? 'carrierCost' then erp_supply.safe_numeric(p_payload->>'carrierCost') else null end;
  v_currency_input text:=case when p_payload ? 'carrierCostCurrency' then nullif(upper(trim(p_payload->>'carrierCostCurrency')),'') else null end;

  v_tracking text;
  v_carrier text;
  v_carrier_invoice text;
  v_carrier_cost numeric;
  v_carrier_cost_currency text;
  v_guide_file_id text;

  v_destination jsonb;
  v_city text;
  v_address text;
  v_department text;
  v_country text;
begin
  if not (erp_supply.can_access_module('shipping','update') or erp_supply.has_role('super_admin')) then
    raise exception 'No autorizado para gestionar despachos' using errcode='42501';
  end if;

  select * into v_order
  from erp_supply.orders
  where id=p_order_id and organization_id=v_org
  for update;
  if not found or v_order.current_step_code not in('CLIENT_POINT','CLIENT_PICKUP','LOCAL_DISPATCH','NATIONAL_DISPATCH') then
    raise exception 'El pedido no está en una etapa de despacho';
  end if;

  select * into v_task
  from erp_supply.order_tasks
  where order_id=p_order_id
    and step_code=v_order.current_step_code
    and status in('QUEUED','ASSIGNED','IN_PROGRESS','WAITING','BLOCKED')
  order by sequence_no desc limit 1 for update;
  if not found or v_task.status<>'IN_PROGRESS' then raise exception 'Primero debes tomar el pedido'; end if;
  if v_task.assigned_profile_id is distinct from v_actor
     and not (erp_supply.has_role('super_admin') or erp_supply.has_role('jefe_logistica')) then
    raise exception 'El pedido está asignado a otra persona' using errcode='42501';
  end if;

  select * into v_delivery
  from erp_supply.deliveries
  where order_id=p_order_id and status not in('CANCELLED')
  order by created_at desc limit 1 for update;

  if found then
    v_tracking:=case when v_has_tracking then v_tracking_input else nullif(trim(v_delivery.tracking_number),'') end;
    v_carrier:=case when v_has_carrier then v_carrier_input else nullif(trim(v_delivery.carrier),'') end;
    v_carrier_invoice:=case when v_has_invoice then v_invoice_input else nullif(trim(v_delivery.carrier_invoice_number),'') end;
    v_carrier_cost:=case when v_has_cost then v_cost_input else v_delivery.carrier_cost end;
    v_carrier_cost_currency:=case
      when v_has_currency then v_currency_input
      else coalesce(nullif(upper(trim(v_delivery.carrier_cost_currency)),''),'COP')
    end;
    v_guide_file_id:=case
      when p_payload ? 'guideFileId' then nullif(trim(p_payload->>'guideFileId'),'')
      else nullif(trim(v_delivery.metadata->>'guideFileId'),'')
    end;
  else
    v_tracking:=v_tracking_input;
    v_carrier:=v_carrier_input;
    v_carrier_invoice:=v_invoice_input;
    v_carrier_cost:=v_cost_input;
    v_carrier_cost_currency:=coalesce(v_currency_input,'COP');
    v_guide_file_id:=nullif(trim(p_payload->>'guideFileId'),'');
  end if;

  if v_tracking is null then raise exception 'Número de guía requerido'; end if;
  if v_carrier is null then raise exception 'Transportadora requerida'; end if;
  if v_carrier_invoice is null then raise exception 'Factura de transportadora requerida'; end if;
  if v_carrier_cost is null or v_carrier_cost<=0 then raise exception 'Costo de flete debe ser mayor que 0'; end if;
  if v_carrier_cost_currency<>'COP' then raise exception 'La moneda del flete debe ser COP'; end if;

  v_city:=coalesce(nullif(v_order.metadata->>'clientCity',''),nullif(v_order.client_city,''));
  v_address:=coalesce(nullif(v_order.metadata->>'clientAddress',''),nullif(v_order.client_address,''));
  v_department:=nullif(v_order.metadata->>'clientDepartment','');
  v_country:=coalesce(nullif(v_order.metadata->>'clientCountry',''),'Colombia');
  if v_city is null or v_address is null then
    raise exception 'Ventas debe registrar municipio y dirección antes de despachar';
  end if;

  v_destination:=jsonb_strip_nulls(jsonb_build_object(
    'country',v_country,
    'department',v_department,
    'municipality',v_city,
    'address',v_address,
    'source','SALES_ORDER_ADDRESS',
    'capturedAt',now(),
    'snapshotVersion','11.43.1'
  ));

  if v_delivery.id is null then
    insert into erp_supply.deliveries(
      order_id,
      route_code,
      status,
      carrier,
      tracking_number,
      assigned_profile_id,
      carrier_invoice_number,
      carrier_cost,
      carrier_cost_currency,
      carrier_cost_recorded_by,
      carrier_cost_recorded_at,
      metadata
    ) values(
      p_order_id,
      v_order.delivery_route_code,
      'PLANNED',
      v_carrier,
      v_tracking,
      v_actor,
      v_carrier_invoice,
      v_carrier_cost,
      v_carrier_cost_currency,
      v_actor,
      now(),
      jsonb_build_object(
        'taskId',v_task.id,
        'guideAddedAt',now(),
        'guideFileId',v_guide_file_id,
        'destination',v_destination,
        'shippingVersion','11.43.1'
      )
    ) returning * into v_delivery;
  else
    update erp_supply.deliveries
       set carrier=v_carrier,
           tracking_number=v_tracking,
           assigned_profile_id=v_actor,
           carrier_invoice_number=v_carrier_invoice,
           carrier_cost=v_carrier_cost,
           carrier_cost_currency=v_carrier_cost_currency,
           carrier_cost_recorded_by=case when v_has_cost then v_actor else carrier_cost_recorded_by end,
           carrier_cost_recorded_at=case when v_has_cost then now() else carrier_cost_recorded_at end,
           metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
             'taskId',v_task.id,
             'guideAddedAt',now(),
             'guideFileId',v_guide_file_id,
             'destination',v_destination,
             'shippingVersion','11.43.1'
           ),
           updated_at=now()
     where id=v_delivery.id
     returning * into v_delivery;
  end if;

  insert into erp_supply.delivery_milestones(
    organization_id,order_id,task_id,delivery_id,milestone_code,actor_profile_id,metadata
  ) values(
    v_org,p_order_id,v_task.id,v_delivery.id,'GUIDE_ADDED',v_actor,
    jsonb_build_object(
      'trackingNumber',v_tracking,
      'carrier',v_carrier,
      'guideFileId',v_guide_file_id,
      'carrierInvoiceNumber',v_carrier_invoice,
      'carrierCost',v_carrier_cost,
      'carrierCostCurrency',v_carrier_cost_currency,
      'version','11.43.1'
    )
  );

  insert into erp_supply.order_events(
    organization_id,order_id,task_id,event_type,action_code,from_step_code,to_step_code,
    from_status,to_status,actor_profile_id,actor_role_code,payload
  ) values(
    v_org,p_order_id,v_task.id,'DOMAIN_RECORD','SHIPPING_GUIDE',
    v_order.current_step_code,v_order.current_step_code,v_order.status,v_order.status,
    v_actor,(erp_supply.current_roles())[1],
    jsonb_build_object(
      'trackingNumber',v_tracking,
      'carrier',v_carrier,
      'carrierInvoiceNumber',v_carrier_invoice,
      'carrierCost',v_carrier_cost,
      'carrierCostCurrency',v_carrier_cost_currency,
      'destinationSource','SALES_ORDER_ADDRESS',
      'version','11.43.1'
    )
  );

  return jsonb_build_object('success',true,'delivery',to_jsonb(v_delivery),'version','11.43.1');
end;
$$;

revoke all on function public.erp_x_shipping_save_guide(uuid,jsonb) from public,anon;
grant execute on function public.erp_x_shipping_save_guide(uuid,jsonb) to authenticated,service_role;

do $$
declare
  v_def text:=pg_get_functiondef(to_regprocedure('public.erp_x_shipping_save_guide(uuid,jsonb)'));
begin
  if position('carrier_invoice_number=v_carrier_invoice' in v_def)=0
     or position('carrier_cost=v_carrier_cost' in v_def)=0
     or position('carrier_cost_currency=v_carrier_cost_currency' in v_def)=0
     or position('p_payload ? ''carrierCost''' in v_def)=0 then
    raise exception 'Shipping guide persistence contract incomplete';
  end if;
end;
$$;

select pg_notify('pgrst','reload schema');
