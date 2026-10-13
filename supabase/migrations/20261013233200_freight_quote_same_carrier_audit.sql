-- Existing quote contracts preserved; calculated status requires a price for the requested carrier.
-- Real cost joins only its own carrier and only if the quote predates actual dispatch.
create or replace function public.erp_x_freight_quote_save(p_payload jsonb) returns jsonb
language plpgsql security definer set search_path=erp_supply,public,auth,pg_catalog as $$
declare actor uuid; org uuid:=erp_supply.current_org_id(); snapshot jsonb; q erp_supply.freight_quotes%rowtype; orderid uuid; carrier text; possible boolean;
begin
 actor:=erp_supply.require_freight_quote_access('create');snapshot:=public.erp_x_freight_quote_calculate(p_payload);orderid:=nullif(p_payload->>'orderId','')::uuid;carrier:=snapshot->>'carrier';
 if orderid is not null and not exists(select 1 from erp_supply.orders where id=orderid and organization_id=org and erp_supply.can_view_order(id)) then raise exception 'Pedido no autorizado' using errcode='42501';end if;
 if coalesce(p_payload->>'status','') not in ('DRAFT','CALCULATED') then raise exception 'Estado inválido' using errcode='22023';end if;
 possible:=case when p_payload->>'measurementVersion'='2' then coalesce((snapshot#>>'{commercialEstimate,available}')::boolean,false) when carrier='ENVIA' then snapshot#>>'{reference,status}'='ESTIMATED_REFERENCE' else snapshot#>>'{reference,status}'='HISTORICAL_REFERENCE' or coalesce((snapshot#>>'{prediction,available}')::boolean,false) end;
 if p_payload->>'status'='CALCULATED' and not coalesce(possible,false) then raise exception 'Sin liquidación disponible: guarda un borrador';end if;
 if jsonb_typeof(p_payload->'materials') is distinct from 'array' or jsonb_array_length(p_payload->'materials')>100 then raise exception 'Materiales inválidos' using errcode='22023';end if;
 insert into erp_supply.freight_quotes(organization_id,created_by,order_id,status,carrier,tariff_version,policy_version,input,snapshot)
 values(org,actor,orderid,p_payload->>'status',carrier,snapshot->>'tariffVersion',snapshot->>'policyVersion',p_payload,snapshot) returning * into q;
 return to_jsonb(q);
end $$;

create or replace function public.erp_x_freight_quote_list(p_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path=erp_supply,public,auth,pg_catalog as $$
begin
 perform erp_supply.require_freight_quote_access();
 return jsonb_build_object('total',(select count(*) from erp_supply.freight_quotes where organization_id=erp_supply.current_org_id()),'items',coalesce((select jsonb_agg(to_jsonb(q)) from (select q.*,o.order_number, d.carrier_cost actual_cost_cop,d.carrier actual_carrier from erp_supply.freight_quotes q left join erp_supply.orders o on o.id=q.order_id left join lateral(select carrier_cost,carrier from erp_supply.deliveries where order_id=q.order_id
  and carrier_cost>0 and carrier_cost_currency='COP'
  and case when q.carrier='ENVIA'
    then erp_supply.freight_norm_v1140(carrier) in ('ENVIA','COLVANES')
    else erp_supply.freight_norm_v1140(carrier)='TCC' end
  and q.created_at<=coalesce(dispatched_at,carrier_cost_recorded_at,now())
  order by updated_at desc limit 1)d on true where q.organization_id=erp_supply.current_org_id() order by q.created_at desc,q.id limit 30 offset (greatest(1,coalesce(p_page,1))-1)*30)q),'[]'));
end $$;

revoke all on function public.erp_x_freight_quote_save(jsonb),public.erp_x_freight_quote_list(integer) from public,anon;
grant execute on function public.erp_x_freight_quote_save(jsonb),public.erp_x_freight_quote_list(integer) to authenticated;
