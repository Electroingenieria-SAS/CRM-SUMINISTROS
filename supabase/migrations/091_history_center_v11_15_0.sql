-- CRM Suministros · V11.15.0
-- Centro Histórico profesional: consulta, detalle, lotes, exportación y hardening de importación.

create index if not exists idx_orders_history_org_created_v11150
  on erp_supply.orders(organization_id,is_history,created_at desc)
  where not coalesce(is_test,false);
create index if not exists idx_orders_history_org_status_closed_v11150
  on erp_supply.orders(organization_id,status,closed_at desc)
  where not coalesce(is_test,false) and (is_history or status in ('CLOSED','CANCELLED'));
create index if not exists idx_import_batches_history_org_created_v11150
  on erp_supply.import_batches(organization_id,import_type,created_at desc);

create or replace function erp_supply.history_center_core(p_payload jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_actor uuid:=erp_supply.require_profile();
  v_org uuid:=erp_supply.current_org_id();
  v_search text:=nullif(btrim(coalesce(p_payload->>'search','')),'');
  v_source text:=upper(coalesce(nullif(btrim(p_payload->>'source'),''),'ALL'));
  v_status text:=upper(coalesce(nullif(btrim(p_payload->>'status'),''),'ALL'));
  v_type text:=upper(coalesce(nullif(btrim(p_payload->>'orderType'),''),'ALL'));
  v_route text:=upper(coalesce(nullif(btrim(p_payload->>'route'),''),'ALL'));
  v_city text:=nullif(btrim(coalesce(p_payload->>'city','')),'');
  v_from date:=nullif(p_payload->>'from','')::date;
  v_to date:=nullif(p_payload->>'to','')::date;
  v_page integer:=greatest(1,coalesce((p_payload->>'page')::integer,1));
  v_page_size integer:=greatest(10,least(coalesce((p_payload->>'pageSize')::integer,50),250));
  v_offset integer;
  v_result jsonb;
begin
  if not erp_supply.can_access_module('imports','read') then
    raise exception 'No autorizado para consultar el histórico' using errcode='42501';
  end if;
  if v_source not in('ALL','IMPORTED','NATIVE') then raise exception 'Fuente histórica no permitida'; end if;
  if v_from is not null and v_to is not null and v_from>v_to then raise exception 'Rango de fechas inválido'; end if;
  v_offset:=(v_page-1)*v_page_size;

  with base as (
    select o.*,
      case when o.is_history then 'IMPORTED' else 'NATIVE' end history_source,
      nullif(o.metadata->>'importBatchId','')::uuid import_batch_id,
      o.metadata->>'importFileName' import_file_name
    from erp_supply.orders o
    where o.organization_id=v_org
      and not coalesce(o.is_test,false)
      and (coalesce(o.is_history,false) or o.status in('CLOSED','CANCELLED'))
      and (v_source='ALL' or (v_source='IMPORTED' and o.is_history) or (v_source='NATIVE' and not coalesce(o.is_history,false)))
      and (v_status='ALL' or o.status=v_status)
      and (v_type='ALL' or o.order_type_code=v_type)
      and (v_route='ALL' or o.delivery_route_code=v_route)
      and (v_city is null or lower(coalesce(o.client_city,''))=lower(v_city))
      and (v_from is null or (coalesce(o.closed_at,o.cancelled_at,o.updated_at,o.created_at) at time zone 'America/Bogota')::date>=v_from)
      and (v_to is null or (coalesce(o.closed_at,o.cancelled_at,o.updated_at,o.created_at) at time zone 'America/Bogota')::date<=v_to)
      and (v_search is null or
        o.order_number ilike '%'||v_search||'%' or
        coalesce(o.external_reference,'') ilike '%'||v_search||'%' or
        coalesce(o.client_name,'') ilike '%'||v_search||'%' or
        coalesce(o.client_document,'') ilike '%'||v_search||'%' or
        coalesce(o.client_city,'') ilike '%'||v_search||'%')
  ), page_rows as (
    select b.*,
      p.display_name seller_name,
      coalesce((select sum(i.amount) from erp_supply.invoices i where i.order_id=b.id),0) invoice_amount,
      (select count(*) from erp_supply.order_items oi where oi.order_id=b.id) item_lines,
      (select count(*) from erp_supply.order_tasks ot where ot.order_id=b.id) task_count,
      (select max(d.delivered_at) from erp_supply.deliveries d where d.order_id=b.id) delivered_at
    from base b
    left join erp_supply.profiles p on p.id=b.seller_profile_id
    order by coalesce(b.closed_at,b.cancelled_at,b.updated_at,b.created_at) desc,b.order_number desc
    offset v_offset limit v_page_size
  ), summary as (
    select jsonb_build_object(
      'total',count(*),
      'imported',count(*) filter(where history_source='IMPORTED'),
      'native',count(*) filter(where history_source='NATIVE'),
      'closed',count(*) filter(where status='CLOSED'),
      'cancelled',count(*) filter(where status='CANCELLED'),
      'uniqueClients',count(distinct nullif(client_document,'')),
      'oldest',min(coalesce(closed_at,cancelled_at,updated_at,created_at)),
      'newest',max(coalesce(closed_at,cancelled_at,updated_at,created_at)),
      'avgCycleSeconds',round(avg(case when closed_at is not null then greatest(0,extract(epoch from(closed_at-created_at))) end))::bigint,
      'withInvoice',count(*) filter(where exists(select 1 from erp_supply.invoices i where i.order_id=base.id)),
      'withDelivery',count(*) filter(where exists(select 1 from erp_supply.deliveries d where d.order_id=base.id and d.delivered_at is not null))
    ) data from base
  ), invoice_summary as (
    select coalesce(sum(i.amount),0) amount
    from erp_supply.invoices i join base b on b.id=i.order_id
  ), facets as (
    select jsonb_build_object(
      'status',coalesce((select jsonb_agg(jsonb_build_object('label',status,'value',cnt) order by cnt desc) from (select coalesce(status,'SIN_ESTADO') status,count(*) cnt from base group by 1) q),'[]'::jsonb),
      'types',coalesce((select jsonb_agg(jsonb_build_object('label',typ,'value',cnt) order by cnt desc) from (select coalesce(order_type_code,'SIN_TIPO') typ,count(*) cnt from base group by 1) q),'[]'::jsonb),
      'routes',coalesce((select jsonb_agg(jsonb_build_object('label',route,'value',cnt) order by cnt desc) from (select coalesce(delivery_route_code,'SIN_RUTA') route,count(*) cnt from base group by 1) q),'[]'::jsonb),
      'cities',coalesce((select jsonb_agg(jsonb_build_object('label',city,'value',cnt) order by cnt desc) from (select coalesce(nullif(btrim(client_city),''),'SIN_CIUDAD') city,count(*) cnt from base group by 1 order by 2 desc limit 25) q),'[]'::jsonb),
      'years',coalesce((select jsonb_agg(jsonb_build_object('label',yr,'value',cnt) order by yr desc) from (select extract(year from coalesce(closed_at,cancelled_at,updated_at,created_at))::int yr,count(*) cnt from base group by 1) q),'[]'::jsonb)
    ) data
  )
  select jsonb_build_object(
    'filters',jsonb_build_object('search',v_search,'source',v_source,'status',v_status,'orderType',v_type,'route',v_route,'city',v_city,'from',v_from,'to',v_to),
    'page',v_page,'pageSize',v_page_size,'summary',(select data||jsonb_build_object('invoiceAmount',(select amount from invoice_summary)) from summary),
    'facets',(select data from facets),
    'rows',coalesce((select jsonb_agg(jsonb_build_object(
      'id',r.id,'orderNumber',r.order_number,'externalReference',r.external_reference,'clientName',r.client_name,'clientDocument',r.client_document,'clientCity',r.client_city,
      'orderType',r.order_type_code,'paymentCondition',r.payment_condition_code,'route',r.delivery_route_code,'status',r.status,'priority',r.priority,
      'source',r.history_source,'importBatchId',r.import_batch_id,'importFileName',r.import_file_name,'sellerName',r.seller_name,
      'createdAt',r.created_at,'updatedAt',r.updated_at,'closedAt',r.closed_at,'cancelledAt',r.cancelled_at,'deliveredAt',r.delivered_at,
      'invoiceAmount',r.invoice_amount,'itemLines',r.item_lines,'taskCount',r.task_count
    ) order by coalesce(r.closed_at,r.cancelled_at,r.updated_at,r.created_at) desc,r.order_number desc) from page_rows r),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;$$;
revoke execute on function erp_supply.history_center_core(jsonb) from public,anon;
grant execute on function erp_supply.history_center_core(jsonb) to authenticated;

create or replace function public.erp_x_history_center(p_payload jsonb default '{}'::jsonb)
returns jsonb language sql stable security invoker set search_path=''
as $$ select erp_supply.history_center_core(coalesce(p_payload,'{}'::jsonb)); $$;
revoke execute on function public.erp_x_history_center(jsonb) from public,anon;
grant execute on function public.erp_x_history_center(jsonb) to authenticated;

create or replace function erp_supply.history_detail_core(p_order_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_actor uuid:=erp_supply.require_profile(); v_org uuid:=erp_supply.current_org_id(); v_result jsonb;
begin
  if not erp_supply.can_access_module('imports','read') then raise exception 'No autorizado para consultar el histórico' using errcode='42501'; end if;
  if not exists(select 1 from erp_supply.orders o where o.id=p_order_id and o.organization_id=v_org and not coalesce(o.is_test,false) and (o.is_history or o.status in('CLOSED','CANCELLED'))) then raise exception 'Registro histórico no encontrado'; end if;
  select jsonb_build_object(
    'order',(select to_jsonb(q) from (
      select o.id,o.order_number,o.external_reference,o.order_type_code,o.payment_condition_code,o.delivery_route_code,o.client_name,o.client_document,o.client_city,o.client_address,o.client_phone,
        p.display_name seller_name,o.current_step_code,o.status,o.priority,o.requires_cut,o.requires_purchase,o.source,o.is_history,o.metadata,o.created_at,o.updated_at,o.closed_at,o.cancelled_at,
        case when o.is_history then 'IMPORTED' else 'NATIVE' end history_source
      from erp_supply.orders o left join erp_supply.profiles p on p.id=o.seller_profile_id where o.id=p_order_id) q),
    'items',coalesce((select jsonb_agg(to_jsonb(q) order by q.line_number) from (select line_number,sku,reference,description,quantity,unit,warehouse_location,requires_cut,requested_cut_length,item_status,metadata from erp_supply.order_items where order_id=p_order_id) q),'[]'::jsonb),
    'invoices',coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at) from (select invoice_number,invoice_date,amount,currency,status,package_weight_kg,package_quantity,weight_per_unit_kg,created_at from erp_supply.invoices where order_id=p_order_id) q),'[]'::jsonb),
    'deliveries',coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at) from (select route_code,status,scheduled_at,dispatched_at,delivered_at,received_by,no_delivery_reason,carrier,tracking_number,carrier_invoice_number,carrier_cost,carrier_cost_currency,created_at from erp_supply.deliveries where order_id=p_order_id) q),'[]'::jsonb),
    'tasks',coalesce((select jsonb_agg(to_jsonb(q) order by q.sequence_no,q.created_at) from (select step_code,sequence_no,queue_code,status,assigned_at,started_at,completed_at,blocked_at,raw_seconds,business_seconds,result_code,result_detail,created_at from erp_supply.order_tasks where order_id=p_order_id) q),'[]'::jsonb),
    'issues',coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at) from (select issue_type,source_code,title,detail,status,blocking,resolution,resolution_code,created_at,resolved_at from erp_supply.order_issues where order_id=p_order_id) q),'[]'::jsonb),
    'audit',coalesce((select jsonb_agg(jsonb_build_object('action',a.action,'entityType',a.entity_type,'before',a.before_data,'after',a.after_data,'metadata',a.metadata,'createdAt',a.created_at,'actor',p.display_name) order by a.created_at) from erp_supply.system_audit a left join erp_supply.profiles p on p.id=a.actor_profile_id where a.organization_id=v_org and (a.entity_id=p_order_id::text or a.after_data->>'orderId'=p_order_id::text or a.metadata->>'orderId'=p_order_id::text)),'[]'::jsonb),
    'batch',(select to_jsonb(q) from (
      select b.id,b.file_name,b.status,b.total_rows,b.inserted_rows,b.rejected_rows,b.created_at,b.completed_at,p.display_name imported_by,b.summary
      from erp_supply.orders o join erp_supply.import_batches b on b.id=nullif(o.metadata->>'importBatchId','')::uuid left join erp_supply.profiles p on p.id=b.imported_by where o.id=p_order_id
    ) q)
  ) into v_result;
  return v_result;
end;$$;
revoke execute on function erp_supply.history_detail_core(uuid) from public,anon;
grant execute on function erp_supply.history_detail_core(uuid) to authenticated;

create or replace function public.erp_x_history_detail(p_order_id uuid)
returns jsonb language sql stable security invoker set search_path=''
as $$ select erp_supply.history_detail_core(p_order_id); $$;
revoke execute on function public.erp_x_history_detail(uuid) from public,anon;
grant execute on function public.erp_x_history_detail(uuid) to authenticated;

create or replace function erp_supply.history_batches_core(p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_actor uuid:=erp_supply.require_profile(); v_org uuid:=erp_supply.current_org_id();
begin
  if not erp_supply.can_access_module('imports','read') then raise exception 'No autorizado para consultar importaciones históricas' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id',b.id,'fileName',b.file_name,'status',b.status,'totalRows',b.total_rows,'insertedRows',b.inserted_rows,'rejectedRows',b.rejected_rows,
    'createdAt',b.created_at,'completedAt',b.completed_at,'importedBy',p.display_name,'summary',b.summary,
    'errors',coalesce((select jsonb_agg(jsonb_build_object('rowNumber',e.row_number,'code',e.error_code,'message',e.error_message,'rawRow',e.raw_row,'createdAt',e.created_at) order by e.row_number) from (select * from erp_supply.import_errors where batch_id=b.id order by row_number limit 10) e),'[]'::jsonb)
  ) order by b.created_at desc)
  from (select * from erp_supply.import_batches where organization_id=v_org and import_type='ORDER_HISTORY' order by created_at desc limit greatest(1,least(coalesce(p_limit,50),200))) b
  left join erp_supply.profiles p on p.id=b.imported_by),'[]'::jsonb);
end;$$;
revoke execute on function erp_supply.history_batches_core(integer) from public,anon;
grant execute on function erp_supply.history_batches_core(integer) to authenticated;

create or replace function public.erp_x_history_batches(p_limit integer default 50)
returns jsonb language sql stable security invoker set search_path=''
as $$ select erp_supply.history_batches_core(p_limit); $$;
revoke execute on function public.erp_x_history_batches(integer) from public,anon;
grant execute on function public.erp_x_history_batches(integer) to authenticated;

create or replace function erp_supply.history_export_core(p_payload jsonb)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
  v_actor uuid:=erp_supply.require_profile(); v_org uuid:=erp_supply.current_org_id();
  v_search text:=nullif(btrim(coalesce(p_payload->>'search','')),'');
  v_source text:=upper(coalesce(nullif(btrim(p_payload->>'source'),''),'ALL'));
  v_status text:=upper(coalesce(nullif(btrim(p_payload->>'status'),''),'ALL'));
  v_type text:=upper(coalesce(nullif(btrim(p_payload->>'orderType'),''),'ALL'));
  v_route text:=upper(coalesce(nullif(btrim(p_payload->>'route'),''),'ALL'));
  v_from date:=nullif(p_payload->>'from','')::date; v_to date:=nullif(p_payload->>'to','')::date;
  v_limit integer:=greatest(1,least(coalesce((p_payload->>'limit')::integer,5000),5000));
begin
  if not erp_supply.can_access_module('imports','read') then raise exception 'No autorizado para exportar el histórico' using errcode='42501'; end if;
  return jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(q) order by q.history_date desc,q.order_number desc) from (
    select o.order_number,o.external_reference,o.client_name,o.client_document,o.client_city,o.order_type_code,o.payment_condition_code,o.delivery_route_code,o.status,o.priority,
      case when o.is_history then 'IMPORTED' else 'NATIVE' end history_source,o.source,
      coalesce(o.closed_at,o.cancelled_at,o.updated_at,o.created_at) history_date,o.created_at,o.updated_at,o.closed_at,o.cancelled_at,
      coalesce((select sum(i.amount) from erp_supply.invoices i where i.order_id=o.id),0) invoice_amount,
      (select count(*) from erp_supply.order_items oi where oi.order_id=o.id) item_lines,
      o.metadata->>'importBatchId' import_batch_id,o.metadata->>'importFileName' import_file_name
    from erp_supply.orders o
    where o.organization_id=v_org and not coalesce(o.is_test,false) and (o.is_history or o.status in('CLOSED','CANCELLED'))
      and (v_source='ALL' or (v_source='IMPORTED' and o.is_history) or (v_source='NATIVE' and not coalesce(o.is_history,false)))
      and (v_status='ALL' or o.status=v_status) and (v_type='ALL' or o.order_type_code=v_type) and (v_route='ALL' or o.delivery_route_code=v_route)
      and (v_from is null or (coalesce(o.closed_at,o.cancelled_at,o.updated_at,o.created_at) at time zone 'America/Bogota')::date>=v_from)
      and (v_to is null or (coalesce(o.closed_at,o.cancelled_at,o.updated_at,o.created_at) at time zone 'America/Bogota')::date<=v_to)
      and (v_search is null or o.order_number ilike '%'||v_search||'%' or coalesce(o.external_reference,'') ilike '%'||v_search||'%' or coalesce(o.client_name,'') ilike '%'||v_search||'%' or coalesce(o.client_document,'') ilike '%'||v_search||'%' or coalesce(o.client_city,'') ilike '%'||v_search||'%')
    order by coalesce(o.closed_at,o.cancelled_at,o.updated_at,o.created_at) desc,o.order_number desc limit v_limit
  ) q),'[]'::jsonb),'limit',v_limit);
end;$$;
revoke execute on function erp_supply.history_export_core(jsonb) from public,anon;
grant execute on function erp_supply.history_export_core(jsonb) to authenticated;

create or replace function public.erp_x_history_export(p_payload jsonb default '{}'::jsonb)
returns jsonb language sql stable security invoker set search_path=''
as $$ select erp_supply.history_export_core(coalesce(p_payload,'{}'::jsonb)); $$;
revoke execute on function public.erp_x_history_export(jsonb) from public,anon;
grant execute on function public.erp_x_history_export(jsonb) to authenticated;

-- Harden imported history: never reclassify an existing native order as history.
create or replace function public.erp_x_import_history(p_file_name text,p_rows jsonb,p_batch_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path to 'erp_supply','public','auth'
as $$
declare
  v_actor uuid:=erp_supply.require_profile(); v_org uuid:=erp_supply.current_org_id(); v_batch erp_supply.import_batches%rowtype; v_row jsonb;
  v_n integer:=0; v_ok integer:=0; v_bad integer:=0; v_status text; v_step text; v_type text; v_payment text; v_route text; v_priority text;
  v_created timestamptz; v_updated timestamptz; v_closed timestamptz; v_cancelled timestamptz;
begin
  if not erp_supply.can_access_module('imports','create') then raise exception 'No autorizado para importar históricos' using errcode='42501'; end if;
  if jsonb_typeof(coalesce(p_rows,'null'::jsonb))<>'array' then raise exception 'p_rows debe ser un arreglo JSON'; end if;
  if jsonb_array_length(p_rows)=0 then raise exception 'El lote no contiene filas'; end if;
  if jsonb_array_length(p_rows)>500 then raise exception 'Máximo 500 filas por lote'; end if;
  if nullif(btrim(p_file_name),'') is null then raise exception 'Nombre de archivo requerido'; end if;

  if p_batch_id is null then
    insert into erp_supply.import_batches(organization_id,import_type,file_name,imported_by,total_rows,status)
    values(v_org,'ORDER_HISTORY',btrim(p_file_name),v_actor,jsonb_array_length(p_rows),'PROCESSING') returning * into v_batch;
  else
    select * into v_batch from erp_supply.import_batches where id=p_batch_id and organization_id=v_org and import_type='ORDER_HISTORY' for update;
    if not found then raise exception 'Lote de importación no encontrado'; end if;
    update erp_supply.import_batches set total_rows=total_rows+jsonb_array_length(p_rows),status='PROCESSING',completed_at=null where id=v_batch.id returning * into v_batch;
  end if;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_n:=v_n+1;
    begin
      if nullif(btrim(v_row->>'orderNumber'),'') is null then raise exception 'Número de pedido requerido'; end if;
      if nullif(btrim(v_row->>'clientName'),'') is null then raise exception 'Cliente requerido'; end if;
      if exists(select 1 from erp_supply.orders o where o.organization_id=v_org and o.order_number=btrim(v_row->>'orderNumber') and not coalesce(o.is_history,false)) then
        raise exception 'El pedido % ya existe como registro operativo y no puede convertirse en histórico',btrim(v_row->>'orderNumber');
      end if;

      v_type:=upper(coalesce(nullif(btrim(v_row->>'orderType'),''),'PVC'));
      v_payment:=upper(coalesce(nullif(btrim(v_row->>'paymentCondition'),''),'CREDIT'));
      v_route:=upper(coalesce(nullif(btrim(v_row->>'deliveryRoute'),''),'LOCAL_DISPATCH'));
      v_priority:=upper(coalesce(nullif(btrim(v_row->>'priority'),''),'MEDIUM'));
      v_status:=upper(coalesce(nullif(btrim(v_row->>'status'),''),'CLOSED'));
      if not exists(select 1 from erp_supply.order_types where code=v_type and active) then raise exception 'Tipo de pedido inválido: %',v_type; end if;
      if not exists(select 1 from erp_supply.payment_conditions where code=v_payment and active) then raise exception 'Condición de pago inválida: %',v_payment; end if;
      if not exists(select 1 from erp_supply.delivery_routes where code=v_route and active) then raise exception 'Ruta inválida: %',v_route; end if;
      if v_priority not in('LOW','MEDIUM','HIGH','URGENT','CRITICAL') then raise exception 'Prioridad inválida: %',v_priority; end if;
      if v_status not in('CLOSED','CANCELLED') then v_status:='CLOSED'; end if;
      v_step:=case when v_status='CLOSED' then 'CLOSED' else coalesce(nullif(upper(v_row->>'currentStep'),''),'CLOSED') end;
      if not exists(select 1 from erp_supply.workflow_steps where code=v_step) then v_step:='CLOSED'; end if;
      v_created:=erp_supply.try_timestamptz(v_row->>'createdAt',now()); v_updated:=erp_supply.try_timestamptz(v_row->>'updatedAt',v_created);
      v_closed:=case when v_status='CLOSED' then erp_supply.try_timestamptz(v_row->>'closedAt',v_updated) end;
      v_cancelled:=case when v_status='CANCELLED' then erp_supply.try_timestamptz(v_row->>'cancelledAt',v_updated) end;

      insert into erp_supply.orders(organization_id,order_number,external_reference,order_type_code,payment_condition_code,delivery_route_code,client_name,client_document,client_city,current_step_code,status,priority,requires_cut,requires_purchase,source,is_history,metadata,created_at,updated_at,closed_at,cancelled_at)
      values(v_org,btrim(v_row->>'orderNumber'),nullif(btrim(v_row->>'externalReference'),''),v_type,v_payment,v_route,btrim(v_row->>'clientName'),nullif(btrim(v_row->>'clientDocument'),''),nullif(btrim(v_row->>'clientCity'),''),v_step,v_status,v_priority,erp_supply.try_boolean(v_row->>'requiresCut',false),erp_supply.try_boolean(v_row->>'requiresPurchase',v_type='PVE'),'CSV_HISTORY',true,v_row||jsonb_build_object('importBatchId',v_batch.id,'importFileName',v_batch.file_name,'historyImportedAt',now()),v_created,v_updated,v_closed,v_cancelled)
      on conflict(organization_id,order_number) do update set
        external_reference=coalesce(excluded.external_reference,erp_supply.orders.external_reference),order_type_code=excluded.order_type_code,payment_condition_code=excluded.payment_condition_code,delivery_route_code=excluded.delivery_route_code,client_name=excluded.client_name,
        client_document=coalesce(excluded.client_document,erp_supply.orders.client_document),client_city=coalesce(excluded.client_city,erp_supply.orders.client_city),current_step_code=excluded.current_step_code,status=excluded.status,priority=excluded.priority,requires_cut=excluded.requires_cut,
        requires_purchase=excluded.requires_purchase,source='CSV_HISTORY',is_history=true,metadata=erp_supply.orders.metadata||excluded.metadata,updated_at=greatest(erp_supply.orders.updated_at,excluded.updated_at),closed_at=coalesce(excluded.closed_at,erp_supply.orders.closed_at),cancelled_at=coalesce(excluded.cancelled_at,erp_supply.orders.cancelled_at)
      where erp_supply.orders.is_history=true;
      v_ok:=v_ok+1;
    exception when others then
      v_bad:=v_bad+1;
      insert into erp_supply.import_errors(batch_id,row_number,error_code,error_message,raw_row) values(v_batch.id,v_batch.inserted_rows+v_batch.rejected_rows+v_n,sqlstate,sqlerrm,v_row);
    end;
  end loop;

  update erp_supply.import_batches set inserted_rows=inserted_rows+v_ok,rejected_rows=rejected_rows+v_bad,status=case when rejected_rows+v_bad=0 then 'COMPLETED' when inserted_rows+v_ok=0 then 'FAILED' else 'PARTIAL' end,completed_at=now(),summary=summary||jsonb_build_object('lastChunkRows',v_n,'lastChunkInserted',v_ok,'lastChunkRejected',v_bad,'updatedAt',now()) where id=v_batch.id returning * into v_batch;
  insert into erp_supply.system_audit(organization_id,actor_profile_id,action,entity_type,entity_id,after_data,metadata)
  values(v_org,v_actor,'IMPORT_HISTORY_CHUNK','IMPORT_BATCH',v_batch.id::text,jsonb_build_object('processed',v_n,'inserted',v_ok,'rejected',v_bad,'status',v_batch.status),jsonb_build_object('fileName',p_file_name));
  return jsonb_build_object('success',v_bad=0,'batchId',v_batch.id,'processed',v_n,'inserted',v_ok,'rejected',v_bad,'status',v_batch.status,'totals',jsonb_build_object('rows',v_batch.total_rows,'inserted',v_batch.inserted_rows,'rejected',v_batch.rejected_rows));
end;$$;
revoke execute on function public.erp_x_import_history(text,jsonb,uuid) from public,anon;
grant execute on function public.erp_x_import_history(text,jsonb,uuid) to authenticated;
