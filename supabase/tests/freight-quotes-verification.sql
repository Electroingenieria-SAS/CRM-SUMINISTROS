begin;
-- Assertions use the production calculation function, and rollback all fixtures.
do $$
declare result jsonb; rules jsonb;
begin
 select p.rules into rules from erp_supply.freight_quote_policies p where version='TCC_WEB_REFERENCE_1';
 result:=erp_supply.tcc_reference_calculate(953,'[{"weightKg":20,"lengthM":0.5,"widthM":0.4,"heightM":0.3,"quantity":1}]',100000,rules);
 if (result->>'subtotalCop')::numeric<>22872 then raise exception 'Fixture falló %',result; end if;
 result:=erp_supply.tcc_reference_calculate(953,'[{"weightKg":50,"volumeM3":0.215,"quantity":1}]',199999,rules);
 if result#>>'{packages,0,surchargeCopKg}'<>'0' or result->>'handlingCop'<>'0' then raise exception 'Umbral exacto falló'; end if;
 result:=erp_supply.tcc_reference_calculate(953,'[{"weightKg":50.01,"volumeM3":0.01,"quantity":2}]',200000,rules);
 if result#>>'{packages,0,surchargeCopKg}'<>'50' or (result->>'handlingCop')::numeric<>2000 then raise exception 'Recargo/manejo falló'; end if;
 result:=erp_supply.tcc_reference_calculate(953,'[{"weightKg":1,"volumeM3":0.215025,"quantity":1}]',0,rules);
 if result#>>'{packages,0,surchargeCopKg}'<>'50' then raise exception 'Recargo volumétrico falló'; end if;
 result:=erp_supply.tcc_reference_calculate(null,'[{"weightKg":20,"volumeM3":0.06}]',0,rules);
 if result->>'reason'<>'RATE_UNAVAILABLE' then raise exception 'NULL falló'; end if;
 if (select count(*) from erp_supply.freight_tariff_rows)<>30107 or (select count(paq_rate_cop_kg_reference) from erp_supply.freight_tariff_rows)<>30086 then raise exception 'Conteos inválidos'; end if;
end $$;
-- Bind an existing active ERP administrator only inside this rolled-back test session.
select set_config('request.jwt.claims',jsonb_build_object('sub',p.auth_user_id,'role','authenticated')::text,true),set_config('request.jwt.claim.sub',p.auth_user_id::text,true)
 from erp_supply.profiles p join erp_supply.profile_roles pr on pr.profile_id=p.id where p.active and p.auth_user_id is not null and pr.role_code='super_admin' limit 1;
set local role authenticated;
do $$
declare key text; q jsonb; payload jsonb; count_before bigint; result jsonb;
begin
 key:=(select value->>'key' from jsonb_array_elements(public.erp_x_freight_quote_catalog('VALLE DEL CAUCA')->'destinations') where value->>'name'='TULUA (VALLE DEL CAUCA)' limit 1);
 payload:=jsonb_build_object('origin','CALI','destinationKey',key,'department','VALLE DEL CAUCA','carrier','TCC','declaredValue',100000,'status','CALCULATED','materials',jsonb_build_array(jsonb_build_object('manual',true,'description','Material de prueba','quantity',1,'unit','UND')),'packages','[{"weightKg":20,"volumeM3":0.06,"quantity":1}]'::jsonb);
 result:=public.erp_x_freight_quote_calculate(payload);
 if (result#>>'{reference,subtotalCop}')::numeric<>22872 or result#>>'{reference,official}'<>'false' then raise exception 'RPC fixture falló %',result; end if;
 if result#>>'{prediction,available}'<>'false' then raise exception 'Modelo Tuluá aplicado a Cali'; end if;
 count_before:=(public.erp_x_freight_quote_list()->>'total')::bigint;
 q:=public.erp_x_freight_quote_save(payload);
 if q->>'order_id' is not null then raise exception 'Cotización creó vínculo inesperado'; end if;
 perform public.erp_x_freight_quote_save(payload);
 if (public.erp_x_freight_quote_list()->>'total')::bigint<>count_before+2 then raise exception 'Persistencia/duplicación falló'; end if;
 result:=public.erp_x_freight_quote_calculate(payload||'{"origin":"TULUA"}');
 if result#>>'{reference,reason}'<>'ORIGIN_ROUTE_UNAVAILABLE' then raise exception 'Equivalencia inventada de origen'; end if;
 begin perform public.erp_x_import_tcc_reference('[]');raise exception 'Importador accesible';exception when insufficient_privilege then null;end;
 begin perform public.erp_x_freight_quote_save(payload||'{"orderId":"00000000-0000-0000-0000-000000000001"}');raise exception 'Pedido externo permitido';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claims','{"role":"anon"}',true),set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$ begin
 begin perform public.erp_x_freight_quote_catalog();raise exception 'Anon permitido';exception when insufficient_privilege then null;end;
 begin perform public.erp_x_freight_quote_save('{}');raise exception 'Anon write permitido';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'PASS: numeric fixtures, save without order, duplicate, Tuluá, anonymous denial, importer denial, foreign-order denial' result;
rollback;
