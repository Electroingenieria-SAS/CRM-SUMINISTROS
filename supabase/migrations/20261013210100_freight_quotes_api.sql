begin;
create or replace function erp_supply.require_freight_quote_access(p_action text default 'read') returns uuid
language plpgsql stable security definer set search_path=erp_supply,public,auth,pg_catalog as $$
declare actor uuid;
begin
 actor:=erp_supply.require_profile();
 if not erp_supply.can_access_module('freight_quotes',p_action) then raise exception 'No autorizado para cotizar fletes' using errcode='42501'; end if;
 return actor;
end $$;
revoke all on function erp_supply.require_freight_quote_access(text) from public,anon,authenticated;

-- Pure numeric helper: shared fixtures run against this exact backend implementation.
create or replace function erp_supply.tcc_reference_calculate(p_rate numeric,p_packages jsonb,p_declared numeric,p_rules jsonb) returns jsonb
language plpgsql immutable set search_path=erp_supply,public,pg_catalog as $$
declare p jsonb; w numeric; vol numeric; vw numeric; qty numeric; charge numeric; surcharge numeric; base numeric:=0; handling numeric; parts jsonb:='[]';
begin
 if p_rate is null then return jsonb_build_object('status','UNAVAILABLE','reason','RATE_UNAVAILABLE','official',false); end if;
 if p_rate<=0 or p_rate::text in ('NaN','Infinity','-Infinity') then raise exception 'Tarifa inválida'; end if;
 if p_declared is null or p_packages is null or p_packages='[]' then return jsonb_build_object('status','REQUIRES_INFORMATION','official',false); end if;
 if p_declared<0 or p_declared::text in ('NaN','Infinity','-Infinity') or jsonb_typeof(p_packages)<>'array' or jsonb_array_length(p_packages)>100 then raise exception 'Datos inválidos'; end if;
 for p in select value from jsonb_array_elements(p_packages) loop
  w:=nullif(p->>'weightKg','')::numeric; qty:=coalesce(nullif(p->>'quantity','')::numeric,1);
  vol:=coalesce(nullif(p->>'volumeM3','')::numeric,nullif(p->>'lengthM','')::numeric*nullif(p->>'widthM','')::numeric*nullif(p->>'heightM','')::numeric);
  if w is null or vol is null then return jsonb_build_object('status','REQUIRES_INFORMATION','official',false); end if;
  if w<=0 or vol<=0 or qty<1 or qty<>trunc(qty) or qty>10000 or w>1000000 or vol>100000 or w::text in ('NaN','Infinity','-Infinity') or vol::text in ('NaN','Infinity','-Infinity') or qty::text in ('NaN','Infinity','-Infinity') then raise exception 'Bulto inválido'; end if;
  vw:=vol*(p_rules->>'volumetricFactor')::numeric;charge:=greatest(w,vw);
  surcharge:=case when w>(p_rules->>'realThresholdKg')::numeric or vw>(p_rules->>'volumeThresholdKg')::numeric then (p_rules->>'surchargeCopKg')::numeric else 0 end;
  base:=base+charge*(p_rate+surcharge)*qty;
  parts:=parts||jsonb_build_array(jsonb_build_object('weightKg',w,'volumeM3',vol,'quantity',qty,'volumeWeightKg',vw,'billableKg',charge,'surchargeCopKg',surcharge,'baseCop',charge*(p_rate+surcharge)*qty));
 end loop;
 handling:=case when p_declared>=(p_rules->>'handlingThresholdCop')::numeric then p_declared*(p_rules->>'handlingRate')::numeric else 0 end;
 return jsonb_build_object('status','HISTORICAL_REFERENCE','official',false,'packages',parts,'baseCop',base,'handlingCop',handling,'subtotalCop',base+handling);
end $$;
revoke all on function erp_supply.tcc_reference_calculate(numeric,jsonb,numeric,jsonb) from public,anon,authenticated;

create or replace function public.erp_x_freight_quote_catalog(p_department text default null) returns jsonb
language plpgsql stable security definer set search_path=erp_supply,public,auth,pg_catalog as $$
declare result jsonb;
begin
 perform erp_supply.require_freight_quote_access();
 select jsonb_build_object('origins',(select jsonb_agg(origin_city order by origin_city) from (select distinct origin_city from erp_supply.freight_tariff_rows union select origin_city from erp_supply.freight_prediction_models where active and organization_id=erp_supply.current_org_id()) o),
 'departments',(select jsonb_agg(d order by d) from (select distinct destination_departamento_pdf d from erp_supply.freight_tariff_rows) depts),
 'destinations',coalesce((select jsonb_agg(jsonb_build_object('key',key,'name',destination_pdf,'department',destination_departamento_pdf,'center',tcc_co) order by destination_pdf,tcc_co,key) from (select distinct left(tcc_row_id,8) key,destination_pdf,destination_departamento_pdf,tcc_co from erp_supply.freight_tariff_rows where destination_departamento_pdf=p_department) d),'[]'),
 'modelOrigin',(select origin_city from erp_supply.freight_prediction_models where active and organization_id=erp_supply.current_org_id() order by updated_at desc limit 1)) into result;
 return result;
end $$;

create or replace function public.erp_x_freight_quote_calculate(p_payload jsonb) returns jsonb
language plpgsql stable security definer set search_path=erp_supply,public,auth,pg_catalog as $$
declare r erp_supply.freight_tariff_rows%rowtype; dest erp_supply.freight_tariff_rows%rowtype; policy erp_supply.freight_quote_policies%rowtype; reference jsonb; prediction jsonb; w numeric; origin text; model_origin text;
begin
 perform erp_supply.require_freight_quote_access();
 if octet_length(p_payload::text)>100000 then raise exception 'Cotización demasiado grande'; end if;
 if coalesce(p_payload->>'carrier','TCC')<>'TCC' then raise exception 'Transportadora sin contrato aportado'; end if;
 origin:=p_payload->>'origin';
 if nullif(origin,'') is null then raise exception 'Origen requerido'; end if;
 select * into dest from erp_supply.freight_tariff_rows where left(tcc_row_id,8)=p_payload->>'destinationKey' order by tcc_row_id limit 1;
 if not found then raise exception 'Destino documental no existe'; end if;
 select * into r from erp_supply.freight_tariff_rows where left(tcc_row_id,8)=p_payload->>'destinationKey' and origin_city=origin;
 select * into policy from erp_supply.freight_quote_policies where version='TCC_WEB_REFERENCE_1';
 reference:=erp_supply.tcc_reference_calculate(r.paq_rate_cop_kg_reference,p_payload->'packages',nullif(p_payload->>'declaredValue','')::numeric,policy.rules);
 if r.tcc_row_id is null then reference:=jsonb_build_object('status','UNAVAILABLE','reason','ORIGIN_ROUTE_UNAVAILABLE','official',false); end if;
 select sum((p->>'weightKg')::numeric*coalesce((p->>'quantity')::numeric,1)) into w from jsonb_array_elements(coalesce(p_payload->'packages','[]')) p;
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
 if orderid is not null and not exists(select 1 from erp_supply.orders where id=orderid and organization_id=org) then raise exception 'Pedido no autorizado' using errcode='42501'; end if;
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
 return jsonb_build_object('total',(select count(*) from erp_supply.freight_quotes where organization_id=erp_supply.current_org_id()),'items',coalesce((select jsonb_agg(to_jsonb(q)) from (select q.*,o.order_number, d.carrier_cost actual_cost_cop,d.carrier actual_carrier from erp_supply.freight_quotes q left join erp_supply.orders o on o.id=q.order_id left join lateral(select carrier_cost,carrier from erp_supply.deliveries where order_id=q.order_id order by updated_at desc limit 1)d on true where q.organization_id=erp_supply.current_org_id() order by q.created_at desc,q.id limit 30 offset (greatest(1,coalesce(p_page,1))-1)*30)q),'[]'));
end $$;
create or replace function public.erp_x_freight_quote_link(p_quote_id uuid,p_order_number text) returns jsonb
language plpgsql security definer set search_path=erp_supply,public,auth,pg_catalog as $$
declare org uuid:=erp_supply.current_org_id();orderid uuid;q erp_supply.freight_quotes%rowtype;
begin
 perform erp_supply.require_freight_quote_access('update');
 select id into orderid from erp_supply.orders where organization_id=org and order_number=trim(p_order_number);
 if orderid is null then raise exception 'Pedido no existe'; end if;
 update erp_supply.freight_quotes set order_id=orderid,updated_at=now() where id=p_quote_id and organization_id=org returning * into q;
 if not found then raise exception 'Cotización no existe'; end if;
 return to_jsonb(q);
end $$;
revoke all on function public.erp_x_freight_quote_catalog(text),public.erp_x_freight_quote_calculate(jsonb),public.erp_x_freight_quote_save(jsonb),public.erp_x_freight_quote_list(integer),public.erp_x_freight_quote_link(uuid,text) from public,anon;
grant execute on function public.erp_x_freight_quote_catalog(text),public.erp_x_freight_quote_calculate(jsonb),public.erp_x_freight_quote_save(jsonb),public.erp_x_freight_quote_list(integer),public.erp_x_freight_quote_link(uuid,text) to authenticated;
commit;
