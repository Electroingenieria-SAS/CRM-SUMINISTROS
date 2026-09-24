-- CRM SUMINISTROS V11.39.0
-- Permisos explícitos para inteligencia comercial y logística.
begin;

create or replace function public.erp_x_customer_intelligence(
  p_client_document text default null,
  p_client_name text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path=erp_supply,public,auth,pg_catalog
as $$
declare
  v_org uuid:=erp_supply.current_org_id();
begin
  perform erp_supply.require_profile();

  if not (
    erp_supply.can_access_module('orders','create')
    or erp_supply.can_access_module('sales','create')
    or erp_supply.has_role('super_admin')
    or erp_supply.has_role('gerencia')
    or erp_supply.has_role('auditoria')
  ) then
    raise exception 'No autorizado para consultar inteligencia comercial' using errcode='42501';
  end if;

  if nullif(trim(coalesce(p_client_name,'')),'') is null
     and nullif(trim(coalesce(p_client_document,'')),'') is null then
    return jsonb_build_object(
      'segment','NORMAL','priority','MEDIUM','score',0,'orderCount',0,'paidAmount',0,
      'confidence','LEARNING','learningActive',false,'version','11.39.0'
    );
  end if;

  return erp_supply.customer_value_profile(v_org,p_client_document,p_client_name,true);
end;
$$;

create or replace function public.erp_x_customer_ranking(p_limit integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path=erp_supply,public,auth,pg_catalog
as $$
declare
  v_org uuid:=erp_supply.current_org_id();
  v_limit integer:=greatest(1,least(coalesce(p_limit,30),100));
  v_rows jsonb;
  v_clients bigint:=0;
  v_orders bigint:=0;
  v_mature boolean:=false;
begin
  perform erp_supply.require_profile();

  if not (
    erp_supply.can_access_module('sales','read')
    or erp_supply.can_access_module('reports','read')
    or erp_supply.has_role('super_admin')
    or erp_supply.has_role('gerencia')
    or erp_supply.has_role('auditoria')
    or erp_supply.has_role('jefe_logistica')
  ) then
    raise exception 'No autorizado para consultar ranking de clientes' using errcode='42501';
  end if;

  with order_value as(
    select
      o.id,
      erp_supply.customer_key(o.client_document,o.client_name) customer_key,
      o.client_name customer_name,
      o.client_document customer_document,
      coalesce((
        select sum(i.amount)
        from erp_supply.invoices i
        where i.order_id=o.id and i.amount is not null and i.amount>0
      ),0)::numeric paid_amount
    from erp_supply.orders o
    where o.organization_id=v_org
      and not coalesce(o.is_test,false)
      and o.status<>'CANCELLED'
  ),
  base as(
    select customer_key,max(customer_name) customer_name,max(customer_document) customer_document,
           count(*)::bigint order_count,coalesce(sum(paid_amount),0)::numeric paid_amount
    from order_value group by customer_key
  )
  select count(*),coalesce(sum(order_count),0) into v_clients,v_orders from base;

  v_mature:=v_orders>=20 and v_clients>=5;

  with order_value as(
    select o.id,erp_supply.customer_key(o.client_document,o.client_name) customer_key,
           o.client_name customer_name,o.client_document customer_document,
           coalesce((select sum(i.amount) from erp_supply.invoices i
                     where i.order_id=o.id and i.amount is not null and i.amount>0),0)::numeric paid_amount
    from erp_supply.orders o
    where o.organization_id=v_org and not coalesce(o.is_test,false) and o.status<>'CANCELLED'
  ),
  base as(
    select customer_key,max(customer_name) customer_name,max(customer_document) customer_document,
           count(*)::bigint order_count,coalesce(sum(paid_amount),0)::numeric paid_amount
    from order_value group by customer_key
  ),
  ranked as(
    select *,percent_rank() over(order by order_count)::numeric frequency_rank,
             percent_rank() over(order by paid_amount)::numeric value_rank
    from base
  ),
  scored as(
    select *,round((50.0*frequency_rank+50.0*value_rank)::numeric,1) score
    from ranked
  ),
  segmented as(
    select *,
      case
        when not v_mature or order_count<3 then 'NORMAL'
        when score>=90 then 'URGENT'
        when score>=70 then 'PREMIUM'
        when score>=30 then 'NORMAL'
        else 'BASIC'
      end segment,
      case
        when not v_mature or order_count<3 then 'LEARNING'
        when order_count>=10 then 'HIGH'
        when order_count>=5 then 'MEDIUM'
        else 'LOW'
      end confidence
    from scored
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'customerKey',customer_key,'customerName',customer_name,'customerDocument',customer_document,
    'orderCount',order_count,'paidAmount',paid_amount,
    'frequencyPercentile',round((100*frequency_rank)::numeric,1),
    'valuePercentile',round((100*value_rank)::numeric,1),
    'score',score,'segment',segment,'confidence',confidence
  ) order by score desc,paid_amount desc,order_count desc),'[]'::jsonb)
  into v_rows
  from(select * from segmented order by score desc,paid_amount desc,order_count desc limit v_limit)q;

  return jsonb_build_object(
    'rows',v_rows,'learningActive',v_mature,'sampleClients',v_clients,'sampleOrders',v_orders,
    'weights',jsonb_build_object('orderCount',0.5,'paidAmount',0.5),'version','11.39.0'
  );
end;
$$;

create or replace function public.erp_x_freight_estimate(
  p_route text,
  p_department text default null,
  p_city text default null,
  p_weight_kg numeric default null,
  p_package_quantity numeric default null,
  p_volume_m3 numeric default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path=erp_supply,public,auth,pg_catalog
as $$
declare
  v_org uuid:=erp_supply.current_org_id();
begin
  perform erp_supply.require_profile();

  if not (
    erp_supply.can_access_module('orders','create')
    or erp_supply.can_access_module('sales','create')
    or erp_supply.can_access_module('shipping','read')
    or erp_supply.can_access_module('shipping','update')
    or erp_supply.has_role('super_admin')
    or erp_supply.has_role('gerencia')
    or erp_supply.has_role('auditoria')
  ) then
    raise exception 'No autorizado para estimar fletes' using errcode='42501';
  end if;

  return erp_supply.freight_estimate_internal(
    v_org,p_route,p_department,p_city,p_weight_kg,p_package_quantity,p_volume_m3
  );
end;
$$;

revoke all on function public.erp_x_customer_intelligence(text,text) from public,anon;
revoke all on function public.erp_x_customer_ranking(integer) from public,anon;
revoke all on function public.erp_x_freight_estimate(text,text,text,numeric,numeric,numeric) from public,anon;
grant execute on function public.erp_x_customer_intelligence(text,text) to authenticated;
grant execute on function public.erp_x_customer_ranking(integer) to authenticated;
grant execute on function public.erp_x_freight_estimate(text,text,text,numeric,numeric,numeric) to authenticated;

notify pgrst,'reload schema';
commit;
