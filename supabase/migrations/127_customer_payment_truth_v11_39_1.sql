-- CRM SUMINISTROS V11.39.1
-- Corrección de verdad financiera y compatibilidad de prioridad:
--  * usa pago aprobado de Caja cuando existe;
--  * usa factura únicamente como respaldo explícito mientras no exista pago confirmado;
--  * evita HIGH, incompatible con el contrato actual LOW/MEDIUM/URGENT;
--  * conserva los segmentos comerciales BASIC/NORMAL/PREMIUM/URGENT.
begin;

create or replace function erp_supply.customer_order_value_v11391(p_order_id uuid)
returns table(
  ranking_value numeric,
  confirmed_paid numeric,
  invoice_fallback numeric,
  value_source text
)
language sql
stable
security definer
set search_path=erp_supply,public,auth,pg_catalog
as $$
  with latest_cash as(
    select fv.amount::numeric amount
    from erp_supply.financial_validations fv
    where fv.order_id=p_order_id
      and upper(fv.validation_type)='CAJA'
      and upper(fv.decision)='APPROVED'
      and fv.amount is not null
      and fv.amount>0
    order by fv.created_at desc,fv.id desc
    limit 1
  ),
  cash_invoice as(
    select coalesce(sum(i.amount) filter(where i.amount is not null and i.amount>0),0)::numeric amount
    from erp_supply.invoices i
    where i.order_id=p_order_id
      and upper(coalesce(i.metadata->>'registeredStep',''))='CAJA_FACTURACION'
  ),
  invoice_total as(
    select coalesce(sum(i.amount) filter(where i.amount is not null and i.amount>0),0)::numeric amount
    from erp_supply.invoices i
    where i.order_id=p_order_id
  ),
  confirmed as(
    select coalesce(
      (select amount from latest_cash),
      nullif((select amount from cash_invoice),0)
    )::numeric amount
  )
  select
    coalesce((select amount from confirmed),(select amount from invoice_total),0)::numeric ranking_value,
    coalesce((select amount from confirmed),0)::numeric confirmed_paid,
    case when (select amount from confirmed) is not null then 0::numeric
         else coalesce((select amount from invoice_total),0)::numeric end invoice_fallback,
    case
      when (select amount from confirmed) is not null then 'PAYMENT_AMOUNT'
      when coalesce((select amount from invoice_total),0)>0 then 'INVOICE_AMOUNT_FALLBACK'
      else 'NONE'
    end value_source
$$;

revoke all on function erp_supply.customer_order_value_v11391(uuid) from public,anon,authenticated;

create or replace function erp_supply.customer_value_profile(
  p_org uuid,
  p_document text,
  p_name text,
  p_include_pending boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path=erp_supply,public,auth,pg_catalog
as $$
declare
  v_key text:=erp_supply.customer_key(p_document,p_name);
  v_orders bigint:=0;
  v_value numeric:=0;
  v_confirmed_paid numeric:=0;
  v_invoice_fallback numeric:=0;
  v_payment_orders bigint:=0;
  v_fallback_orders bigint:=0;
  v_clients bigint:=0;
  v_total_orders bigint:=0;
  v_freq numeric:=0;
  v_value_rank numeric:=0;
  v_score numeric:=0;
  v_segment text:='NORMAL';
  v_priority text:='MEDIUM';
  v_confidence text:='LEARNING';
  v_mature boolean:=false;
  v_value_source text:='NONE';
begin
  with order_value as(
    select
      o.id,
      erp_supply.customer_key(o.client_document,o.client_name) customer_key,
      v.ranking_value,
      v.confirmed_paid,
      v.invoice_fallback,
      v.value_source
    from erp_supply.orders o
    cross join lateral erp_supply.customer_order_value_v11391(o.id) v
    where o.organization_id=p_org
      and not coalesce(o.is_test,false)
      and o.status<>'CANCELLED'
  ),
  client_base as(
    select
      customer_key,
      count(*)::bigint order_count,
      coalesce(sum(ranking_value),0)::numeric ranking_value,
      coalesce(sum(confirmed_paid),0)::numeric confirmed_paid,
      coalesce(sum(invoice_fallback),0)::numeric invoice_fallback,
      count(*) filter(where value_source='PAYMENT_AMOUNT')::bigint payment_orders,
      count(*) filter(where value_source='INVOICE_AMOUNT_FALLBACK')::bigint fallback_orders
    from order_value
    group by customer_key
  ),
  target_adjusted as(
    select
      c.customer_key,
      c.order_count + case when c.customer_key=v_key and p_include_pending then 1 else 0 end order_count,
      c.ranking_value,
      c.confirmed_paid,
      c.invoice_fallback,
      c.payment_orders,
      c.fallback_orders
    from client_base c
    union all
    select
      v_key,
      case when p_include_pending then 1 else 0 end,
      0::numeric,0::numeric,0::numeric,0::bigint,0::bigint
    where not exists(select 1 from client_base where customer_key=v_key)
  ),
  ranked as(
    select
      customer_key,
      order_count,
      ranking_value,
      confirmed_paid,
      invoice_fallback,
      payment_orders,
      fallback_orders,
      percent_rank() over(order by order_count)::numeric frequency_rank,
      percent_rank() over(order by ranking_value)::numeric value_rank,
      count(*) over()::bigint client_count,
      sum(order_count) over()::bigint total_orders
    from target_adjusted
  )
  select
    order_count,
    ranking_value,
    confirmed_paid,
    invoice_fallback,
    payment_orders,
    fallback_orders,
    client_count,
    total_orders,
    frequency_rank,
    value_rank
  into
    v_orders,
    v_value,
    v_confirmed_paid,
    v_invoice_fallback,
    v_payment_orders,
    v_fallback_orders,
    v_clients,
    v_total_orders,
    v_freq,
    v_value_rank
  from ranked
  where customer_key=v_key;

  v_orders:=coalesce(v_orders,case when p_include_pending then 1 else 0 end);
  v_value:=coalesce(v_value,0);
  v_confirmed_paid:=coalesce(v_confirmed_paid,0);
  v_invoice_fallback:=coalesce(v_invoice_fallback,0);
  v_payment_orders:=coalesce(v_payment_orders,0);
  v_fallback_orders:=coalesce(v_fallback_orders,0);
  v_clients:=coalesce(v_clients,1);
  v_total_orders:=coalesce(v_total_orders,v_orders);
  v_freq:=coalesce(v_freq,0);
  v_value_rank:=coalesce(v_value_rank,0);
  v_score:=round((50.0*v_freq+50.0*v_value_rank)::numeric,1);

  v_value_source:=case
    when v_payment_orders>0 and v_fallback_orders>0 then 'PAYMENT_WITH_INVOICE_FALLBACK'
    when v_payment_orders>0 then 'PAYMENT_AMOUNT'
    when v_fallback_orders>0 then 'INVOICE_AMOUNT_FALLBACK'
    else 'NONE'
  end;

  v_mature:=v_total_orders>=20 and v_clients>=5 and v_orders>=3;

  if v_mature then
    if v_score>=90 then
      v_segment:='URGENT';
      v_priority:='URGENT';
    elsif v_score>=70 then
      v_segment:='PREMIUM';
      -- El motor productivo solo admite LOW/MEDIUM/URGENT.
      -- Premium conserva su segmento comercial y entra a la banda operativa prioritaria.
      v_priority:='URGENT';
    elsif v_score>=30 then
      v_segment:='NORMAL';
      v_priority:='MEDIUM';
    else
      v_segment:='BASIC';
      v_priority:='LOW';
    end if;

    v_confidence:=case
      when v_orders>=10 then 'HIGH'
      when v_orders>=5 then 'MEDIUM'
      else 'LOW'
    end;
  end if;

  return jsonb_build_object(
    'customerKey',v_key,
    'segment',v_segment,
    'priority',v_priority,
    'score',v_score,
    'orderCount',v_orders,
    'rankingValue',v_value,
    'paidAmount',v_confirmed_paid,
    'invoiceFallbackAmount',v_invoice_fallback,
    'frequencyPercentile',round((100*v_freq)::numeric,1),
    'valuePercentile',round((100*v_value_rank)::numeric,1),
    'confidence',v_confidence,
    'learningActive',v_mature,
    'sampleClients',v_clients,
    'sampleOrders',v_total_orders,
    'actualPaymentOrders',v_payment_orders,
    'invoiceFallbackOrders',v_fallback_orders,
    'paymentCoveragePct',case when v_orders>0 then round((100.0*v_payment_orders/v_orders)::numeric,1) else 0 end,
    'valueSource',v_value_source,
    'weights',jsonb_build_object('orderCount',0.5,'paidOrDocumentedValue',0.5),
    'version','11.39.1'
  );
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
  v_payment_orders bigint:=0;
  v_fallback_orders bigint:=0;
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
      v.ranking_value,
      v.confirmed_paid,
      v.invoice_fallback,
      v.value_source
    from erp_supply.orders o
    cross join lateral erp_supply.customer_order_value_v11391(o.id) v
    where o.organization_id=v_org
      and not coalesce(o.is_test,false)
      and o.status<>'CANCELLED'
  ),
  base as(
    select
      customer_key,
      max(customer_name) customer_name,
      max(customer_document) customer_document,
      count(*)::bigint order_count,
      coalesce(sum(ranking_value),0)::numeric ranking_value,
      coalesce(sum(confirmed_paid),0)::numeric paid_amount,
      coalesce(sum(invoice_fallback),0)::numeric invoice_fallback_amount,
      count(*) filter(where value_source='PAYMENT_AMOUNT')::bigint payment_orders,
      count(*) filter(where value_source='INVOICE_AMOUNT_FALLBACK')::bigint fallback_orders
    from order_value
    group by customer_key
  )
  select
    count(*),
    coalesce(sum(order_count),0),
    coalesce(sum(payment_orders),0),
    coalesce(sum(fallback_orders),0)
  into v_clients,v_orders,v_payment_orders,v_fallback_orders
  from base;

  v_mature:=v_orders>=20 and v_clients>=5;

  with order_value as(
    select
      o.id,
      erp_supply.customer_key(o.client_document,o.client_name) customer_key,
      o.client_name customer_name,
      o.client_document customer_document,
      v.ranking_value,
      v.confirmed_paid,
      v.invoice_fallback,
      v.value_source
    from erp_supply.orders o
    cross join lateral erp_supply.customer_order_value_v11391(o.id) v
    where o.organization_id=v_org
      and not coalesce(o.is_test,false)
      and o.status<>'CANCELLED'
  ),
  base as(
    select
      customer_key,
      max(customer_name) customer_name,
      max(customer_document) customer_document,
      count(*)::bigint order_count,
      coalesce(sum(ranking_value),0)::numeric ranking_value,
      coalesce(sum(confirmed_paid),0)::numeric paid_amount,
      coalesce(sum(invoice_fallback),0)::numeric invoice_fallback_amount,
      count(*) filter(where value_source='PAYMENT_AMOUNT')::bigint payment_orders,
      count(*) filter(where value_source='INVOICE_AMOUNT_FALLBACK')::bigint fallback_orders
    from order_value
    group by customer_key
  ),
  ranked as(
    select
      *,
      percent_rank() over(order by order_count)::numeric frequency_rank,
      percent_rank() over(order by ranking_value)::numeric value_rank
    from base
  ),
  scored as(
    select *,round((50.0*frequency_rank+50.0*value_rank)::numeric,1) score
    from ranked
  ),
  segmented as(
    select
      *,
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
      end confidence,
      case
        when payment_orders>0 and fallback_orders>0 then 'PAYMENT_WITH_INVOICE_FALLBACK'
        when payment_orders>0 then 'PAYMENT_AMOUNT'
        when fallback_orders>0 then 'INVOICE_AMOUNT_FALLBACK'
        else 'NONE'
      end value_source
    from scored
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'customerKey',customer_key,
    'customerName',customer_name,
    'customerDocument',customer_document,
    'orderCount',order_count,
    'rankingValue',ranking_value,
    'paidAmount',paid_amount,
    'invoiceFallbackAmount',invoice_fallback_amount,
    'actualPaymentOrders',payment_orders,
    'invoiceFallbackOrders',fallback_orders,
    'paymentCoveragePct',case when order_count>0 then round((100.0*payment_orders/order_count)::numeric,1) else 0 end,
    'valueSource',value_source,
    'frequencyPercentile',round((100*frequency_rank)::numeric,1),
    'valuePercentile',round((100*value_rank)::numeric,1),
    'score',score,
    'segment',segment,
    'confidence',confidence
  ) order by score desc,ranking_value desc,order_count desc),'[]'::jsonb)
  into v_rows
  from(
    select *
    from segmented
    order by score desc,ranking_value desc,order_count desc
    limit v_limit
  )q;

  return jsonb_build_object(
    'rows',v_rows,
    'learningActive',v_mature,
    'sampleClients',v_clients,
    'sampleOrders',v_orders,
    'actualPaymentOrders',v_payment_orders,
    'invoiceFallbackOrders',v_fallback_orders,
    'paymentCoveragePct',case when v_orders>0 then round((100.0*v_payment_orders/v_orders)::numeric,1) else 0 end,
    'weights',jsonb_build_object('orderCount',0.5,'paidOrDocumentedValue',0.5),
    'version','11.39.1'
  );
end;
$$;

revoke all on function public.erp_x_customer_ranking(integer) from public,anon;
grant execute on function public.erp_x_customer_ranking(integer) to authenticated;

comment on function erp_supply.customer_order_value_v11391(uuid)
is 'V11.39.1: pago aprobado de Caja o factura de CAJA_FACTURACION como evidencia de contado; otras facturas solo respaldan provisionalmente el valor.';

comment on function erp_supply.customer_value_profile(uuid,text,text,boolean)
is 'V11.39.1: score 50% frecuencia + 50% valor económico; prioriza pago real de Caja y evita HIGH incompatible con orders.priority.';

notify pgrst,'reload schema';
commit;
