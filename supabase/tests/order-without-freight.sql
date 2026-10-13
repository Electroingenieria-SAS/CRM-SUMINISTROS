begin;
do $$
declare actor uuid; org uuid; master erp_supply.material_master%rowtype; result jsonb; payload jsonb; oid uuid;
begin
 select p.auth_user_id,p.organization_id into actor,org from erp_supply.profiles p join erp_supply.profile_roles r on r.profile_id=p.id where p.active and p.auth_user_id is not null and r.role_code='super_admin' limit 1;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);perform set_config('request.jwt.claim.sub',actor::text,true);
 select * into master from erp_supply.material_master where organization_id=org and active limit 1;
 payload:=jsonb_build_object('orderNumber','QA-TCC-NOFREIGHT-'||extract(epoch from clock_timestamp())::bigint,'orderType','PVC','paymentCondition','CREDIT','deliveryRoute','NATIONAL_DISPATCH','clientName','Fixture reversible sin flete','clientDepartment','VALLE DEL CAUCA','clientCity','Tuluá','clientAddress','Dirección fixture reversible','items',jsonb_build_array(jsonb_build_object('sku',master.reference,'description',master.exact_name,'quantity',1,'unit',master.unit,'metadata',jsonb_build_object('materialMasterId',master.id))));
 result:=public.erp_x_create_order(payload,null);oid:=(result->>'orderId')::uuid;
 if oid is null then raise exception 'Pedido sin flete no creado %',result; end if;
 if exists(select 1 from erp_supply.orders where id=oid and (metadata ? 'freightPredictionAtCreation' or metadata ? 'freightPredictionVersion')) then raise exception 'Predicción inesperada en pedido'; end if;
 if exists(select 1 from erp_supply.freight_quotes where order_id=oid) then raise exception 'Cotización inesperada'; end if;
end $$;
select 'PASS: actual create-order RPC without freight or quotation' result;
rollback;
