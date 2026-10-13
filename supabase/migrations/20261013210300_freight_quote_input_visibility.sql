begin;
create or replace function public.erp_x_freight_quote_calculate(p_payload jsonb) returns jsonb
language plpgsql stable security definer set search_path=erp_supply,public,auth,pg_catalog as $$
declare r erp_supply.freight_tariff_rows%rowtype; dest erp_supply.freight_tariff_rows%rowtype; policy erp_supply.freight_quote_policies%rowtype; reference jsonb; prediction jsonb; w numeric; origin text; model_origin text; p jsonb; qty numeric; weight numeric; total_weight numeric:=0; complete_weight boolean:=true;
begin
 perform erp_supply.require_freight_quote_access();
 if octet_length(p_payload::text)>100000 then raise exception 'Cotización demasiado grande'; end if;
 if coalesce(p_payload->>'carrier','TCC')<>'TCC' then raise exception 'Transportadora sin contrato aportado'; end if;
 if jsonb_typeof(p_payload->'packages') is distinct from 'array' or jsonb_array_length(p_payload->'packages')>100 then raise exception 'Bultos inválidos' using errcode='22023'; end if;
 for p in select value from jsonb_array_elements(p_payload->'packages') loop
  qty:=coalesce(nullif(p->>'quantity','')::numeric,1);weight:=nullif(p->>'weightKg','')::numeric;
  if qty<1 or qty<>trunc(qty) or qty>10000 or qty::text in ('NaN','Infinity','-Infinity') then raise exception 'Cantidad de bultos inválida' using errcode='22023'; end if;
  if weight is null then complete_weight:=false;
  elsif weight<=0 or weight>1000000 or weight::text in ('NaN','Infinity','-Infinity') then raise exception 'Peso inválido' using errcode='22023';
  else total_weight:=total_weight+weight*qty; end if;
 end loop;
 origin:=p_payload->>'origin';
 if nullif(origin,'') is null then raise exception 'Origen requerido'; end if;
 select * into dest from erp_supply.freight_tariff_rows where left(tcc_row_id,8)=p_payload->>'destinationKey' order by tcc_row_id limit 1;
 if not found then raise exception 'Destino documental no existe'; end if;
 select * into r from erp_supply.freight_tariff_rows where left(tcc_row_id,8)=p_payload->>'destinationKey' and origin_city=origin;
 select * into policy from erp_supply.freight_quote_policies where version='TCC_WEB_REFERENCE_1';
 reference:=erp_supply.tcc_reference_calculate(r.paq_rate_cop_kg_reference,p_payload->'packages',nullif(p_payload->>'declaredValue','')::numeric,policy.rules);
 if r.tcc_row_id is null then reference:=jsonb_build_object('status','UNAVAILABLE','reason','ORIGIN_ROUTE_UNAVAILABLE','official',false); end if;
 w:=case when complete_weight and jsonb_array_length(p_payload->'packages')>0 then total_weight else null end;
 select origin_city into model_origin from erp_supply.freight_prediction_models where organization_id=erp_supply.current_org_id() and active order by updated_at desc limit 1;
 if origin=model_origin and w>0 then
  prediction:=public.erp_x_freight_predictions(dest.destination_departamento_pdf,regexp_replace(dest.destination_pdf,'\s*\([^)]*\)\s*$',''),w);
 else prediction:=jsonb_build_object('available',false,'reason','MODEL_ORIGIN_OR_WEIGHT_UNAVAILABLE'); end if;
 return jsonb_build_object('carrier','TCC','origin',origin,'destination',dest.destination_pdf,'department',dest.destination_departamento_pdf,'center',dest.tcc_co,'tariffVersion','TRADICIONALES_2023_2024','policyVersion',policy.version,'sourceSha256',dest.source_data->>'source_sha256','rowId',r.tcc_row_id,'rateCopKg',r.paq_rate_cop_kg_reference,'reference',reference,'prediction',prediction,'calculatedAt',now(),'warning','Referencia histórica 2023–2024. No es tarifa vigente ni total oficial. IVA, mínimos y adicionales sin confirmar.');
end $$;

create or replace function public.erp_x_freight_quote_save(p_payload jsonb) returns jsonb
language plpgsql security definer set search_path=erp_supply,public,auth,pg_catalog as $$
declare actor uuid; org uuid:=erp_supply.current_org_id(); snapshot jsonb; q erp_supply.freight_quotes%rowtype; orderid uuid;
begin
 actor:=erp_supply.require_freight_quote_access('create');
 snapshot:=public.erp_x_freight_quote_calculate(p_payload);orderid:=nullif(p_payload->>'orderId','')::uuid;
 if orderid is not null and not exists(select 1 from erp_supply.orders where id=orderid and organization_id=org and erp_supply.can_view_order(id)) then raise exception 'Pedido no autorizado' using errcode='42501'; end if;
 if p_payload->>'status' not in ('DRAFT','CALCULATED') then raise exception 'Estado inválido'; end if;
 if p_payload->>'status'='CALCULATED' and snapshot#>>'{reference,status}'<>'HISTORICAL_REFERENCE' and not coalesce((snapshot#>>'{prediction,available}')::boolean,false) then raise exception 'No hay cálculo disponible; guarda como borrador'; end if;
 if jsonb_typeof(p_payload->'materials')<>'array' or jsonb_array_length(p_payload->'materials')>100 then raise exception 'Materiales inválidos'; end if;
 insert into erp_supply.freight_quotes(organization_id,created_by,order_id,status,carrier,tariff_version,policy_version,input,snapshot)
 values(org,actor,orderid,p_payload->>'status','TCC',snapshot->>'tariffVersion',snapshot->>'policyVersion',p_payload,snapshot) returning * into q;
 return to_jsonb(q);
end $$;

create or replace function public.erp_x_freight_quote_list(p_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path=erp_supply,public,auth,pg_catalog as $$
begin
 perform erp_supply.require_freight_quote_access();
 return jsonb_build_object('total',(select count(*) from erp_supply.freight_quotes where organization_id=erp_supply.current_org_id()),'items',coalesce((select jsonb_agg(to_jsonb(q)) from (select q.*,o.order_number, d.carrier_cost actual_cost_cop,d.carrier actual_carrier from erp_supply.freight_quotes q left join erp_supply.orders o on o.id=q.order_id and erp_supply.can_view_order(o.id) left join lateral(select carrier_cost,carrier from erp_supply.deliveries where order_id=o.id order by updated_at desc limit 1)d on true where q.organization_id=erp_supply.current_org_id() order by q.created_at desc,q.id limit 30 offset (greatest(1,coalesce(p_page,1))-1)*30)q),'[]'));
end $$;

create or replace function public.erp_x_freight_quote_link(p_quote_id uuid,p_order_number text) returns jsonb
language plpgsql security definer set search_path=erp_supply,public,auth,pg_catalog as $$
declare org uuid:=erp_supply.current_org_id();orderid uuid;q erp_supply.freight_quotes%rowtype;
begin
 perform erp_supply.require_freight_quote_access('update');
 select id into orderid from erp_supply.orders where organization_id=org and order_number=trim(p_order_number) and erp_supply.can_view_order(id);
 if orderid is null then raise exception 'Pedido no existe'; end if;
 update erp_supply.freight_quotes set order_id=orderid,updated_at=now() where id=p_quote_id and organization_id=org returning * into q;
 if not found then raise exception 'Cotización no existe'; end if;
 return to_jsonb(q);
end $$;
commit;
