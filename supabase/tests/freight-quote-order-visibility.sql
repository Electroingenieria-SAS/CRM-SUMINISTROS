begin;
do $$
declare actor uuid; org uuid; hidden_order uuid; hidden_number text; payload jsonb; key text; quote_id uuid;
begin
 select p.auth_user_id,p.organization_id into actor,org from erp_supply.profiles p join erp_supply.profile_roles r on r.profile_id=p.id where p.active and p.auth_user_id is not null and r.role_code='ventas' and not exists(select 1 from erp_supply.profile_roles x where x.profile_id=p.id and x.role_code='super_admin') limit 1;
 if actor is null then raise exception 'Falta vendedor para verificar permisos reales'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);perform set_config('request.jwt.claim.sub',actor::text,true);
 select id,order_number into hidden_order,hidden_number from erp_supply.orders where organization_id=org and not erp_supply.can_view_order(id) limit 1;
 if hidden_order is null then raise exception 'Falta pedido oculto para vendedor'; end if;
 key:=(select left(tcc_row_id,8) from erp_supply.freight_tariff_rows where origin_city='CALI' and destination_pdf='TULUA (VALLE DEL CAUCA)' limit 1);
 payload:=jsonb_build_object('origin','CALI','destinationKey',key,'carrier','TCC','status','DRAFT','declaredValue',0,'materials','[]'::jsonb,'packages','[]'::jsonb);
 quote_id:=(public.erp_x_freight_quote_save(payload)->>'id')::uuid;
 begin perform public.erp_x_freight_quote_save(payload||jsonb_build_object('orderId',hidden_order));raise exception 'Hidden order accepted in save';exception when insufficient_privilege then null;end;
 begin perform public.erp_x_freight_quote_link(quote_id,hidden_number);raise exception 'Hidden order accepted in link';exception when raise_exception then if sqlerrm='Hidden order accepted in link' then raise;end if;end;
 -- A prior authorized link must not leak guide data after permissions change.
 update erp_supply.freight_quotes set order_id=hidden_order where id=quote_id;
 if exists(select 1 from jsonb_array_elements(public.erp_x_freight_quote_list()->'items') item where item->>'id'=quote_id::text and (item->>'order_number' is not null or item->>'actual_cost_cop' is not null or item->>'actual_carrier' is not null)) then raise exception 'Hidden order guide leaked'; end if;
end $$;
select 'PASS: seller cannot link or read hidden order freight' result;
rollback;
